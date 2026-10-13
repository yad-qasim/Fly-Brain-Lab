// Sensory system: Converts 3D world state into neural input signals
// Implements simplified fly-like visual sensing instead of perfect symbolic information
//
// DATA SOURCE CLASSIFICATION:
// - Visual pathway architecture: REAL (from FlyWire optic lobe connectome, Matsliah et al. 2024)
// - Photoreceptor → lamina → medulla mapping: REAL (from Drosophila visual system literature)
// - Sensory encoding model: APPROXIMATED (simplified rate coding)
// - Distance/angle computation: INVENTED (our 3D environment abstraction)
//
// The fly does NOT receive "flag_is_down = true". Instead:
// 1. The flag's position, color, and motion are computed in 3D space
// 2. A simplified visual field is computed (what the fly's eyes can "see")
// 3. Visual features (brightness, color, motion) are encoded as photoreceptor activity
// 4. This feeds into the visual neurons of the connectome

import { NeuralNetwork } from './neural';
import { FlyState, FlagState } from './types';
import { WORLD } from './config';

export class SensorySystem {
  network: NeuralNetwork;
  // Visual field representation (simplified)
  // The fly has a ~270° field of view, divided into 8 sectors
  visualSectors: number = 8;
  sectorBrightness: Float32Array;
  sectorMotion: Float32Array;
  sectorColorRed: Float32Array;
  sectorColorGreen: Float32Array;
  // Photoreceptor neuron IDs (indexed by sector)
  photoreceptorIds: number[];
  colorPhotoreceptorIds: number[];

  constructor(network: NeuralNetwork) {
    this.network = network;
    this.sectorBrightness = new Float32Array(this.visualSectors);
    this.sectorMotion = new Float32Array(this.visualSectors);
    this.sectorColorRed = new Float32Array(this.visualSectors);
    this.sectorColorGreen = new Float32Array(this.visualSectors);

    // Find real BANC visual input neurons in the connectome.
    // R1-R6 somata sit in the retina (outside the BANC CNS volume), so the
    // brightness/motion channel targets their real postsynaptic partners:
    // lamina output neurons (L1-L5, Mi1, Tm*, C2/C3, Lawf*, Lai).
    // Color channels target real R7/R8 photoreceptor cell types.
    const LAMINA_OUTPUT_TYPES = new Set([
      'L1', 'L2', 'L3', 'L4', 'L5', 'Mi1', 'Tm1', 'Tm2', 'Tm3', 'Tm4',
      'C2', 'C3', 'Lawf1', 'Lawf2', 'Lai',
    ]);
    this.photoreceptorIds = [];
    this.colorPhotoreceptorIds = [];
    for (const n of network.neurons) {
      if (!n.cellType) continue;
      if (n.cellClass === 'photoreceptor_neuron' && (n.cellType.startsWith('R7') || n.cellType.startsWith('R8'))) {
        this.colorPhotoreceptorIds.push(n.id);
      } else if (n.neuronClass === 'visual' && LAMINA_OUTPUT_TYPES.has(n.cellType)) {
        this.photoreceptorIds.push(n.id);
      }
    }
  }

  // Compute what the fly sees based on its position and orientation
  // This is a simplified visual model - NOT perfect symbolic information
  computeVisualInput(fly: FlyState, flag: FlagState, flagWorldPos: [number, number, number]): void {
    // Reset sectors
    this.sectorBrightness.fill(0.1); // baseline ambient
    this.sectorMotion.fill(0);
    this.sectorColorRed.fill(0);
    this.sectorColorGreen.fill(0);

    // Compute angle from fly to flag
    const dx = flagWorldPos[0] - fly.position[0];
    const dz = flagWorldPos[2] - fly.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    const angleToFlag = Math.atan2(dx, dz);

    // Relative angle (accounting for fly orientation)
    let relAngle = angleToFlag - fly.orientation;
    // Normalize to [-PI, PI]
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;

    // Check if flag is in field of view (fly has ~270° FOV, centered forward)
    const fov = Math.PI * 0.75; // ~135° each side
    if (Math.abs(relAngle) < fov && dist < 15) {
      // Determine which sector the flag falls into
      const sectorIdx = Math.floor(((relAngle + fov) / (fov * 2)) * this.visualSectors) % this.visualSectors;
      const safeIdx = Math.max(0, Math.min(this.visualSectors - 1, sectorIdx));

      // Brightness: brighter when closer and flag is raised
      const proximity = 1 / (1 + dist * 0.3);
      const raisedBoost = flag.raised ? 1.5 : 0.8;
      this.sectorBrightness[safeIdx] = Math.min(1.0, proximity * raisedBoost);

      // Color: Kurdish flag has red, green, white
      // Simplified: encode as red and green channel activity
      this.sectorColorRed[safeIdx] = proximity * 0.7;
      this.sectorColorGreen[safeIdx] = proximity * (flag.raised ? 0.5 : 0.3);

      // Motion: based on flag wave amplitude
      this.sectorMotion[safeIdx] = flag.waveAmplitude * proximity;

      // Also activate neighboring sectors (blur)
      const blur = 0.3;
      const left = (safeIdx - 1 + this.visualSectors) % this.visualSectors;
      const right = (safeIdx + 1) % this.visualSectors;
      this.sectorBrightness[left] = Math.max(this.sectorBrightness[left], this.sectorBrightness[safeIdx] * blur);
      this.sectorBrightness[right] = Math.max(this.sectorBrightness[right], this.sectorBrightness[safeIdx] * blur);
      this.sectorColorRed[left] = Math.max(this.sectorColorRed[left], this.sectorColorRed[safeIdx] * blur);
      this.sectorColorRed[right] = Math.max(this.sectorColorRed[right], this.sectorColorRed[safeIdx] * blur);
    }

    // Add ambient visual noise (other objects, environment)
    for (let i = 0; i < this.visualSectors; i++) {
      this.sectorBrightness[i] += Math.random() * 0.05;
    }
  }

  // Inject visual signals into the neural network's photoreceptor neurons
  injectIntoNetwork(): void {
    // Inject brightness into motion photoreceptors (R1-R6)
    for (let i = 0; i < this.photoreceptorIds.length && i < this.visualSectors; i++) {
      const brightness = this.sectorBrightness[i];
      const motion = this.sectorMotion[i];
      // Photoreceptors respond to brightness changes and motion
      const signal = (brightness + motion * 0.5) * 3.0;
      this.network.injectCurrent([this.photoreceptorIds[i]], signal);
    }

    // Inject color into color photoreceptors (R7-R8)
    for (let i = 0; i < this.colorPhotoreceptorIds.length && i < this.visualSectors / 2; i++) {
      const red = this.sectorColorRed[i * 2];
      const green = this.sectorColorGreen[i * 2];
      this.network.injectCurrent([this.colorPhotoreceptorIds[i]], (red + green) * 2.0);
    }
  }

  // Get visual field summary for debug display
  getVisualFieldSummary(): { brightness: number; motion: number; flagVisible: boolean; flagAngle: number } {
    const maxBrightness = Math.max(...this.sectorBrightness);
    const totalMotion = this.sectorMotion.reduce((a, b) => a + b, 0);
    const flagVisible = maxBrightness > 0.2;
    const flagSector = this.sectorBrightness.indexOf(maxBrightness);
    const flagAngle = (flagSector / this.visualSectors - 0.5) * Math.PI * 1.5;
    return {
      brightness: maxBrightness,
      motion: totalMotion,
      flagVisible,
      flagAngle,
    };
  }
}
