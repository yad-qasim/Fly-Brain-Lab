// Configuration constants for the Fly Connectome Lab

import { ExperimentConfig, PerformanceMode } from './types';

export const SIM_VERSION = '1.0.0';

// LIF neuron parameters (from Shiu et al. 2024)
export const LIF_PARAMS = {
  restingPotential: -52.0,   // mV
  threshold: -45.0,          // mV
  resetPotential: -52.0,     // mV
  decayTau: 20.0,             // ms (membrane time constant)
  refractoryPeriod: 2.0,     // ms
  Wsyn: 0.275,               // mV (single free parameter from Shiu et al.)
  excitatoryFactor: 1.0,
  inhibitoryFactor: -1.0,
};

// Simulation timing
export const SIM_DT = 0.1;          // ms per timestep
export const REAL_TIME_FACTOR = 1.0; // target real-time speed

// Performance mode configurations
export const PERF_MODE_CONFIG: Record<PerformanceMode, {
  neuronScale: number;
  synapseScale: number;
  stepsPerFrame: number;
  renderEveryN: number;
}> = {
  fast: { neuronScale: 0.5, synapseScale: 0.3, stepsPerFrame: 20, renderEveryN: 2 },
  balanced: { neuronScale: 1.0, synapseScale: 0.6, stepsPerFrame: 10, renderEveryN: 1 },
  accurate: { neuronScale: 1.0, synapseScale: 1.0, stepsPerFrame: 5, renderEveryN: 1 },
};

// Default experiment configuration
export const DEFAULT_CONFIG: ExperimentConfig = {
  mode: 'reward',
  rewardStrength: 1.0,
  dopamineDecay: 0.02,
  rewardCooldown: 3.0,
  learningRate: 0.01,
  flagLowerTime: 15,
  maxEpisodes: 1000,
  seed: 42,
};

// World dimensions
export const WORLD = {
  floorSize: 20,
  floorY: 0,
  flagPoleHeight: 5,
  flagPoleX: 0,
  flagPoleZ: -3,
  flagSize: { width: 2.4, height: 1.6 },
  flyStartPos: [4, 0.1, 4] as [number, number, number],
  interactionDistance: 2.0,
  maxFlySpeed: 0.05,
  turnRate: 0.03,
};

// Neural visualization
export const NEURAL_VIZ = {
  brainRadius: 2.0,
  neuronSize: 0.04,
  activeNeuronSize: 0.08,
  synapseOpacity: 0.15,
  activeSynapseOpacity: 0.6,
  maxRenderedSynapses: 2000,
  spikeGlowDuration: 200, // ms
};

// Colors for neuron classes
export const NEURON_COLORS: Record<string, [number, number, number]> = {
  sensory: [0.0, 0.85, 0.49],    // green
  visual: [0.0, 0.85, 0.49],     // green
  interneuron: [0.29, 0.62, 1.0], // blue
  kenyon: [1.0, 0.84, 0.0],       // yellow
  mbon: [1.0, 0.28, 0.34],        // red
  dopamine: [0.66, 0.33, 0.97],   // purple
  motor: [1.0, 0.55, 0.26],       // orange
  descending: [0.29, 0.62, 1.0],  // blue
  ascending: [0.55, 0.82, 0.55],  // light green
};

// Colors for neurotransmitters (from BANC 8-class NT predictions, Eckstein, Bates et al. 2024)
export const NT_COLORS: Record<string, [number, number, number]> = {
  acetylcholine: [0.0, 0.8, 0.0],   // green (excitatory)
  gaba: [0.8, 0.0, 0.0],           // red (inhibitory)
  glutamate: [0.9, 0.5, 0.0],       // orange (mixed)
  dopamine: [0.6, 0.2, 0.8],        // purple (modulatory)
  serotonin: [0.2, 0.4, 0.9],      // blue (modulatory)
  octopamine: [0.9, 0.7, 0.1],     // gold (modulatory)
  histamine: [0.0, 0.7, 0.7],      // cyan (photoreceptor)
  tyramine: [0.8, 0.6, 0.8],        // pink (modulatory, BANC-only)
  unknown: [0.5, 0.5, 0.5],        // gray
};

// Real BANC v888 statistics (Bates et al. 2026) — PRIMARY DATA SOURCE
export const BANC_STATS = {
  totalNeurons: 188000,
  totalSynapses: 199000000, // v3
  totalConnections: 13500000, // v3
  ntClasses: 8, // includes tyramine
  coverage: 'Brain + VNC + Cervical Connective',
  // Neurotransmitter neuron counts (BANC 8-class, Eckstein, Bates et al. 2024)
  ntNeuronCounts: {
    acetylcholine: 51559,
    gaba: 8962,
    glutamate: 11408,
    dopamine: 1411,
    serotonin: 102,
    octopamine: 62,
    histamine: 12120,
    tyramine: 1500, // BANC-only, not in FlyWire 7-class
  },
  // Network statistics (BANC v888)
  avgDegree: 72, // ~13.5M connections / ~188K neurons
  avgSynapsesPerConnection: 15,
  synapseThreshold: 5,
  // Key findings (Bates et al. 2026)
  distributedControl: true,
  influenceMetric: true,
  localSensorimotorLoops: true,
  supervisoryMB_CX: true,
};

// FlyWire v783 statistics (Dorkenwald et al. 2024) — PREDECESSOR TO BANC, brain only
export const FLYWIRE_STATS = {
  totalNeurons: 139255,
  totalSynapses: 54500000,
  totalConnections: 3732460,
  cellTypes: 8453,
  // Neuron superclass distribution (Schlegel et al. 2024)
  superclasses: {
    sensory: 'afferent (periphery → brain)',
    motor: 'efferent (brain → periphery)',
    endocrine: 'brain → corpora allata/cardiaca',
    ascending: 'VNC → brain',
    descending: 'brain → VNC',
    visual_projection: 'optic lobes → central brain',
    visual_centrifugal: 'central brain → optic lobes',
    intrinsic_optic: 'intrinsic to optic lobes',
    intrinsic_central: 'intrinsic to central brain',
  },
  // Neurotransmitter neuron counts (FAFB-783, Eckstein et al. 2024)
  ntNeuronCounts: {
    acetylcholine: 51559,
    gaba: 8962,
    glutamate: 11408,
    dopamine: 1411,
    serotonin: 102,
    octopamine: 62,
    histamine: 12120,
  },
  // Network statistics (Gallego et al. 2024)
  avgDegree: 20.5,
  avgSynapsesPerConnection: 12.6,
  connectionProbability: 0.000161,
  synapseThreshold: 5,
};

// Kurdish flag colors
export const KURDISH_FLAG = {
  red: [0.82, 0.078, 0.196],    // #D2141F
  white: [1.0, 1.0, 1.0],
  green: [0.0, 0.549, 0.247],   // #008C3F
  sunYellow: [0.929, 0.788, 0.176], // #EDC92D
  sunRays: 21,
};

// Experiment mode descriptions
export const MODE_DESCRIPTIONS: Record<string, string> = {
  random: 'No reward. Fly behaves according to baseline neural model only.',
  reward: 'Successful flag interaction produces dopamine/reward signal.',
  high_reward: 'Large reward signal (3x normal).',
  low_reward: 'Weak reward signal (0.3x normal).',
  delayed_reward: 'Reward occurs after a 2-second delay.',
  reward_removed: 'Train with reward, then remove it. Measure if behavior persists.',
  random_reward: 'Rewards given randomly, unrelated to behavior. Control condition.',
};

// Reward magnitudes by mode
export const MODE_REWARD_MULTIPLIERS: Record<string, number> = {
  random: 0.0,
  reward: 1.0,
  high_reward: 3.0,
  low_reward: 0.3,
  delayed_reward: 1.0,
  reward_removed: 0.0,
  random_reward: 1.0,
};
