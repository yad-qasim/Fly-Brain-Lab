// Type definitions for the Fly Connectome Lab (BANC v888)

export type NeuronClass = 'sensory' | 'visual' | 'interneuron' | 'kenyon' | 'mbon' | 'dopamine' | 'motor' | 'descending' | 'ascending';
export type Neurotransmitter = 'acetylcholine' | 'gaba' | 'glutamate' | 'dopamine' | 'octopamine' | 'serotonin' | 'histamine' | 'tyramine' | 'unknown';
export type BrainRegion = 'optic_lobe' | 'central_brain' | 'mushroom_body' | 'antennal_lobe' | 'suboesophageal_zone' | 'ventral_nerve_cord' | 'cervical_connective';

export interface NeuronData {
  id: number;
  bancId?: string;
  cellType?: string;
  cellClass?: string;
  neuronClass: NeuronClass;
  neurotransmitter: Neurotransmitter;
  region: BrainRegion;
  // 3D position for visualization (normalized brain space)
  position: [number, number, number];
  // Biological metadata
  knownName?: string;
  hemisphere?: 'left' | 'right' | 'center';
  // Simulation state
  membranePotential: number;
  threshold: number;
  restingPotential: number;
  decayTau: number;
  refractoryUntil: number;
  // Activity tracking
  spikeHistory: number[];
  lastSpikeTime: number;
  // Synaptic weights (indices into connections array)
  incoming: number[];
  outgoing: number[];
  // Whether this neuron's data is from real biological data
  dataSource: 'real' | 'approximated' | 'invented';
}

export interface SynapseData {
  id: number;
  pre: number;  // presynaptic neuron index
  post: number; // postsynaptic neuron index
  weight: number;
  delay: number; // ms
  neurotransmitter: Neurotransmitter;
  // Whether this connection is from real connectome data
  dataSource: 'real' | 'approximated' | 'invented';
}

export interface ConnectomeData {
  neurons: NeuronData[];
  synapses: SynapseData[];
  metadata: {
    source: string;
    version: string;
    neuronCount: number;
    synapseCount: number;
    realNeuronCount: number;
    approximatedNeuronCount: number;
    inventedNeuronCount: number;
    description: string;
  };
}

export type ExperimentMode = 'random' | 'reward' | 'high_reward' | 'low_reward' | 'delayed_reward' | 'reward_removed' | 'random_reward';
export type ViewMode = 'world' | 'fly' | 'neural' | 'debug';
export type PerformanceMode = 'fast' | 'balanced' | 'accurate';

export interface ExperimentConfig {
  mode: ExperimentMode;
  rewardStrength: number;
  dopamineDecay: number;
  rewardCooldown: number;
  learningRate: number;
  flagLowerTime: number; // seconds before flag auto-lowers
  maxEpisodes: number;
  seed: number;
}

export interface FlyState {
  position: [number, number, number];
  velocity: [number, number, number];
  orientation: number; // yaw angle in radians
  behavior: string;
  speed: number;
}

export interface FlagState {
  raised: boolean;
  height: number; // 0 = lowered, 1 = fully raised
  wind: number;
  interactionState: 'none' | 'approaching' | 'touching' | 'raising';
  waveAmplitude: number;
}

export interface TimelineEntry {
  time: number;
  category: 'visual' | 'neural' | 'motor' | 'reward' | 'flag';
  event: string;
}

export interface ExperimentStats {
  episode: number;
  attempts: number;
  successes: number;
  failures: number;
  timeToFirstSuccess: number;
  successIntervals: number[];
  movementDistance: number;
  rewardEvents: { time: number; magnitude: number }[];
  dopamineHistory: { time: number; level: number }[];
  neuralActivityHistory: { time: number; activeCount: number; spikeRate: number }[];
  flagInteractions: { time: number; success: boolean }[];
  learningCurve: { episode: number; successRate: number }[];
  totalReward: number;
  startTime: number;
}

export interface SimulationState {
  time: number;
  running: boolean;
  speed: number;
  perfMode: PerformanceMode;
  viewMode: ViewMode;
  config: ExperimentConfig;
  fly: FlyState;
  flag: FlagState;
  stats: ExperimentStats;
  dopamineLevel: number;
  rewardCooldownRemaining: number;
}

export interface SavedExperiment {
  version: string;
  seed: number;
  config: ExperimentConfig;
  neuralState: {
    membranePotentials: number[];
    synapticWeights: number[];
  };
  stats: ExperimentStats;
  simulationTime: number;
  savedAt: string;
}
