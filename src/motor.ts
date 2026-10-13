// Motor system: Converts neural motor neuron activity into physical fly movement
//
// DATA SOURCE CLASSIFICATION:
// - Motor neuron → leg/wing mapping: REAL (from Drosophila VNC connectome, MANC)
// - Descending neuron → motor neuron pathway: REAL (from comparative DN/AN connectomics)
// - Movement dynamics: APPROXIMATED (simplified kinematic model)
// - Behavior classification: INVENTED (our abstraction for the experiment)
//
// The fly does NOT have "fly.raise_flag()". Instead:
// 1. Motor neuron activity is read from the neural simulation
// 2. Activity patterns are decoded into movement commands
// 3. Movement commands drive the fly's position/orientation in 3D
// 4. If the fly is close enough to the flag and produces "reaching" motor patterns,
//    the flag interaction occurs naturally through proximity

import { NeuralNetwork } from './neural';
import { FlyState, FlagState } from './types';
import { WORLD } from './config';

export class MotorSystem {
  network: NeuralNetwork;
  // Motor neuron IDs by body part
  legMotorIds: number[];
  wingMotorIds: number[];
  dnIds: number[];
  // Motor output
  forwardDrive: number = 0;
  turnRate: number = 0;
  reachSignal: number = 0;
  // Previous position for distance tracking
  prevPosition: [number, number, number];

  constructor(network: NeuralNetwork) {
    this.network = network;
    this.legMotorIds = [];
    this.wingMotorIds = [];
    this.dnIds = [];

    // Identify motor neurons by REAL BANC cell_class labels
    for (const n of network.neurons) {
      if (n.neuronClass === 'motor') {
        if (n.cellClass === 'leg_motor_neuron') this.legMotorIds.push(n.id);
        if (n.cellClass === 'wing_motor_neuron' || n.cellClass === 'haltere_motor_neuron') {
          this.wingMotorIds.push(n.id);
        }
      }
      if (n.neuronClass === 'descending' || n.cellClass === 'descending_neuron') {
        this.dnIds.push(n.id);
      }
    }

    this.prevPosition = [...WORLD.flyStartPos] as [number, number, number];
  }

  // Decode neural activity into motor commands
  // This is the key translation from neural activity to behavior
  decodeMotorOutput(): { forward: number; turn: number; reach: number; behavior: string } {
    // Get motor neuron activity
    const motorActivity = this.network.getMotorActivity();

    // Sum activity across motor neurons
    let legActivity = 0;
    let leftLegActivity = 0;
    let rightLegActivity = 0;
    let wingActivity = 0;
    let dnActivity = 0;

    for (const id of this.legMotorIds) {
      const a = motorActivity[id] || 0;
      legActivity += a;
      if (this.network.neurons[id].hemisphere === 'left') {
        leftLegActivity += a;
      } else {
        rightLegActivity += a;
      }
    }

    for (const id of this.wingMotorIds) {
      wingActivity += motorActivity[id] || 0;
    }

    for (const id of this.dnIds) {
      dnActivity += motorActivity[id] || 0;
    }

    // Decode into movement, normalized by real neuron pool sizes
    const legCount = Math.max(1, this.legMotorIds.length);
    const wingCount = Math.max(1, this.wingMotorIds.length);
    const dnCount = Math.max(1, this.dnIds.length);
    const avgLeg = legActivity / legCount;
    const avgWing = wingActivity / wingCount;

    // Forward drive = overall leg/wing motor activity
    this.forwardDrive = Math.min(1.0, Math.max(0, (avgLeg * 0.7 + avgWing * 0.3) * 5.0));

    // Turn = left/right asymmetry of real leg motor pools (real hemispheres)
    const leftAvg = leftLegActivity / legCount;
    const rightAvg = rightLegActivity / legCount;
    this.turnRate = Math.max(-1, Math.min(1, (rightAvg - leftAvg) * 8.0));

    // Reach signal = descending neuron activity (brain -> VNC motor commands)
    this.reachSignal = Math.min(1.0, (dnActivity / dnCount) * 6.0);

    // Classify behavior
    let behavior = 'idle';
    if (this.forwardDrive > 0.3 && wingActivity > legActivity) {
      behavior = 'flying';
    } else if (this.forwardDrive > 0.15) {
      behavior = 'walking';
    } else if (this.reachSignal > 0.3) {
      behavior = 'reaching';
    } else if (this.turnRate !== 0 && this.forwardDrive > 0.05) {
      behavior = 'turning';
    }

    return {
      forward: this.forwardDrive,
      turn: this.turnRate,
      reach: this.reachSignal,
      behavior,
    };
  }

  // Apply motor commands to fly state
  applyMovement(fly: FlyState, dt: number): void {
    const motor = this.decodeMotorOutput();

    // Apply turning
    fly.orientation += motor.turn * WORLD.turnRate * dt * 60;

    // Apply forward movement
    const speed = motor.forward * WORLD.maxFlySpeed * dt * 60;
    fly.velocity[0] = Math.sin(fly.orientation) * speed;
    fly.velocity[2] = Math.cos(fly.orientation) * speed;
    fly.speed = speed;

    // Update position
    fly.position[0] += fly.velocity[0];
    fly.position[2] += fly.velocity[2];

    // Keep fly on the ground (simplified - no flying height for now)
    fly.position[1] = 0.05;

    // Boundary check
    const half = WORLD.floorSize / 2 - 0.5;
    fly.position[0] = Math.max(-half, Math.min(half, fly.position[0]));
    fly.position[2] = Math.max(-half, Math.min(half, fly.position[2]));

    // Update behavior
    fly.behavior = motor.behavior;
  }

  // Check if fly is close enough to flag for interaction
  canInteractWithFlag(fly: FlyState): boolean {
    const dx = fly.position[0] - WORLD.flagPoleX;
    const dz = fly.position[2] - WORLD.flagPoleZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    return dist < WORLD.interactionDistance;
  }

  // Check if the fly is producing "reaching" motor patterns near the flag
  // This is NOT a hard-coded "if near flag, raise it" rule.
  // The neural system must produce sufficient motor activity that we interpret as reaching.
  isAttemptingInteraction(fly: FlyState): boolean {
    if (!this.canInteractWithFlag(fly)) return false;
    // The reach signal must be above threshold - this comes from neural activity
    return this.reachSignal > 0.25;
  }

  // Get motor output summary for debug display
  getMotorSummary(): { forward: number; turn: number; reach: number; behavior: string } {
    return {
      forward: this.forwardDrive,
      turn: this.turnRate,
      reach: this.reachSignal,
      behavior: this.decodeMotorOutput().behavior,
    };
  }
}
