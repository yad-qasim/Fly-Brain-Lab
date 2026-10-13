// Neural simulation engine - Leaky Integrate-and-Fire (LIF) model
// Based on Shiu et al. (2024) "A Drosophila computational brain model reveals sensorimotor processing"
//
// The LIF model uses the following dynamics:
//   dV/dt = (V_rest - V) / tau_m + I_syn / C
//   if V >= V_threshold: spike, V -> V_reset, enter refractory period
//
// Synaptic currents use alpha-function dynamics:
//   I_syn = sum over presynaptic spikes: W_syn * exp(-(t - t_spike) / tau_syn)
//
// Dopamine modulation:
//   Dopamine modifies synaptic plasticity at KC>MBON synapses
//   Following the biological circuit: DAN activity → dopamine release →
//   modification of KC>MBON synaptic efficacy for active KCs
//
// DATA SOURCE CLASSIFICATION:
// - LIF parameters: REAL (from Shiu et al. 2024, Drosophila electrophysiology)
// - Synaptic weights: APPROXIMATED (derived from FlyWire connection counts)
// - Dopamine circuit: REAL (from Aso et al. 2014, Takemura et al. 2017)
// - Plasticity rule: APPROXIMATED (Hebbian with dopamine modulation)

import { NeuronData, SynapseData, ConnectomeData } from './types';
import { LIF_PARAMS, SIM_DT } from './config';

export class NeuralNetwork {
  neurons: NeuronData[];
  synapses: SynapseData[];
  // Sparse adjacency: pre_synapse_indices[neuronId] = array of synapse indices
  preSynapseIndices: number[][];
  postSynapseIndices: number[][];
  // Plastic synapses (KC→MBON connections that can be modified by dopamine)
  plasticSynapses: Set<number>;
  // Spike queue: { synapseId, arrivalTime }
  spikeQueue: { synapseId: number; arrivalTime: number }[];
  // Signed postsynaptic effect per synapse (from real predicted NT)
  synSigns: Float32Array;
  // Activity tracking
  activeNeurons: Set<number>;
  spikeCount: number;
  spikesPerSecond: number;
  // Dopamine
  dopamineLevel: number;
  dopamineTarget: number;
  dopamineDecay: number;
  // Plasticity
  learningRate: number;
  // Time
  time: number; // ms
  // KC→MBON weight tracking for learning
  kcMbonWeights: Map<number, { weight: number; kcActivity: number; lastModified: number }>;

  constructor(connectome: ConnectomeData, learningRate: number = 0.01, dopamineDecay: number = 0.02) {
    this.neurons = connectome.neurons.map(n => ({ ...n, spikeHistory: [], incoming: [], outgoing: [] }));
    this.synapses = connectome.synapses.map(s => ({ ...s }));
    this.time = 0;
    this.spikeCount = 0;
    this.spikesPerSecond = 0;
    this.dopamineLevel = 0;
    this.dopamineTarget = 0;
    this.dopamineDecay = dopamineDecay;
    this.learningRate = learningRate;
    this.activeNeurons = new Set();
    this.spikeQueue = [];
    this.kcMbonWeights = new Map();

    // Build adjacency lists
    this.preSynapseIndices = Array(this.neurons.length).fill(null).map(() => []);
    this.postSynapseIndices = Array(this.neurons.length).fill(null).map(() => []);

    this.synapses.forEach((syn, idx) => {
      this.preSynapseIndices[syn.pre].push(idx);
      this.postSynapseIndices[syn.post].push(idx);
    });

      // Signed synaptic effect per synapse from the PRE-synaptic neuron's real
    // predicted neurotransmitter (BANC 8-class predictions):
    //   acetylcholine: excitatory (nAChR)              +1.0
    //   gaba:          inhibitory (Rdl/GABA-A)         -1.0
    //   glutamate:     inhibitory (GluCl — the dominant
    //                  fast inhibitory channel in flies) -0.9
    //   histamine:     inhibitory (HisCl, photoreceptor output) -1.0
    //   dopamine/serotonin/octopamine/tyramine: modulatory — weak,
    //                  non-driving; their real role is gain/plasticity
    //   unknown:       moderately excitatory (most CNS neurons are cholinergic)
    const NT_SIGN: Record<string, number> = {
      acetylcholine: 1.0, gaba: -1.0, glutamate: -0.9, histamine: -1.0,
      dopamine: 0.15, serotonin: 0.1, octopamine: 0.15, tyramine: 0.15,
      unknown: 0.4,
    };
    this.synSigns = new Float32Array(this.synapses.length);
    this.synapses.forEach((syn, idx) => {
      const pre = this.neurons[syn.pre];
      this.synSigns[idx] = NT_SIGN[pre?.neurotransmitter ?? 'unknown'] ?? 0.4;
    });

    // Identify plastic synapses (KC → MBON)
    this.plasticSynapses = new Set();
    this.synapses.forEach((syn, idx) => {
      const pre = this.neurons[syn.pre];
      const post = this.neurons[syn.post];
      if (pre.neuronClass === 'kenyon' && post.neuronClass === 'mbon') {
        this.plasticSynapses.add(idx);
        this.kcMbonWeights.set(idx, {
          weight: syn.weight,
          kcActivity: 0,
          lastModified: 0,
        });
      }
    });
  }

  // Inject current into specific neurons (sensory input)
  injectCurrent(neuronIds: number[], current: number) {
    for (const id of neuronIds) {
      if (id >= 0 && id < this.neurons.length) {
        const n = this.neurons[id];
        n.membranePotential += current * LIF_PARAMS.Wsyn;
      }
    }
  }

  // Trigger dopamine release (reward signal)
  releaseDopamine(amount: number) {
    this.dopamineTarget = Math.min(1.0, this.dopamineTarget + amount);
    // Activate dopamine neurons
    for (const n of this.neurons) {
      if (n.neuronClass === 'dopamine') {
        n.membranePotential = n.threshold + 5;
      }
    }
  }

  // Step the simulation forward by dt ms
  step(dt: number = SIM_DT) {
    this.time += dt;
    this.activeNeurons.clear();
    const newSpikes: number[] = [];

    // Process spike queue (deliver delayed synaptic inputs)
    while (this.spikeQueue.length > 0 && this.spikeQueue[0].arrivalTime <= this.time) {
      const event = this.spikeQueue.shift()!;
      const syn = this.synapses[event.synapseId];
      if (syn && syn.post < this.neurons.length) {
        const post = this.neurons[syn.post];
        // Apply signed synaptic current — inhibitory NTs hyperpolarize
        const current = syn.weight * LIF_PARAMS.Wsyn * this.synSigns[event.synapseId];
        post.membranePotential += current;

        // Track KC activity for plasticity
        if (this.plasticSynapses.has(event.synapseId)) {
          const w = this.kcMbonWeights.get(event.synapseId);
          if (w) w.kcActivity = 1.0;
        }
      }
    }

    // Update all neurons
    for (let i = 0; i < this.neurons.length; i++) {
      const n = this.neurons[i];

      // Skip if in refractory period
      if (this.time < n.refractoryUntil) {
        continue;
      }

      // Biological background noise: real fly brains have spontaneous activity
      // Neurons receive ongoing synaptic noise from unmodeled inputs
      // Different classes have different baseline firing rates (Hz):
      //   visual: ~5-20 Hz, interneurons: ~10-30 Hz, KC: ~0.5-5 Hz (sparse),
      //   dopamine: ~1-5 Hz, motor: ~5-15 Hz, sensory: ~2-10 Hz
      const noiseRates: Record<string, number> = {
        visual: 15, interneuron: 20, kenyon: 3, mbon: 8,
        dopamine: 3, motor: 10, descending: 8, sensory: 5, ascending: 8,
      };
      let noiseRate = noiseRates[n.neuronClass] || 10;
      // Serotonergic and octopaminergic neurons fire slowly (1-5 Hz)
      if (n.neurotransmitter === 'serotonin') noiseRate *= 0.2;
      if (n.neurotransmitter === 'octopamine') noiseRate *= 0.3;
      if (n.neurotransmitter === 'tyramine') noiseRate *= 0.25;
      const noiseCurrent = (Math.random() - 0.5) * noiseRate * 0.01 * dt;
      n.membranePotential += noiseCurrent;

      // Leak: decay toward resting potential
      const alpha = dt / n.decayTau;
      n.membranePotential += (n.restingPotential - n.membranePotential) * alpha;

      // Check for spike
      if (n.membranePotential >= n.threshold) {
        // Spike!
        n.membranePotential = LIF_PARAMS.resetPotential;
        n.refractoryUntil = this.time + LIF_PARAMS.refractoryPeriod;
        n.lastSpikeTime = this.time;
        n.spikeHistory.push(this.time);
        if (n.spikeHistory.length > 100) n.spikeHistory.shift();

        newSpikes.push(i);
        this.activeNeurons.add(i);
        this.spikeCount++;

        // Queue synaptic events for downstream neurons
        for (const synIdx of this.preSynapseIndices[i]) {
          const syn = this.synapses[synIdx];
          this.spikeQueue.push({
            synapseId: synIdx,
            arrivalTime: this.time + syn.delay,
          });
        }
      }

      // Track activity (neurons above threshold - some subthreshold activity)
      if (n.membranePotential > n.restingPotential + 2) {
        this.activeNeurons.add(i);
      }
    }

    // Sort spike queue by arrival time
    if (newSpikes.length > 0) {
      this.spikeQueue.sort((a, b) => a.arrivalTime - b.arrivalTime);
    }

    // Apply dopamine-modulated plasticity
    if (this.dopamineLevel > 0.01) {
      this.applyPlasticity(dt);
    }

    // Update dopamine dynamics
    this.dopamineLevel += (this.dopamineTarget - this.dopamineLevel) * 0.1;
    this.dopamineTarget *= (1 - this.dopamineDecay * dt);
    this.dopamineLevel *= (1 - this.dopamineDecay * dt * 0.5);

    // Update spikes per second (running average)
    const windowSize = 1000; // 1 second window
    const recentSpikes = this.neurons.reduce((sum, n) => {
      return sum + n.spikeHistory.filter(t => t > this.time - windowSize).length;
    }, 0);
    this.spikesPerSecond = recentSpikes;

    // Decay KC activity tracking
    for (const [idx, w] of this.kcMbonWeights) {
      w.kcActivity *= (1 - 0.01 * dt);
    }
  }

  // Dopamine-modulated Hebbian plasticity at KC→MBON synapses
  // Following the biological circuit: when dopamine is present and KCs are active,
  // the KC→MBON synaptic strength is modified
  private applyPlasticity(dt: number) {
    for (const [synIdx, weightInfo] of this.kcMbonWeights) {
      if (weightInfo.kcActivity > 0.1 && this.dopamineLevel > 0.01) {
        // Hebbian + dopamine: strengthen active KC→MBON connections
        const delta = this.learningRate * this.dopamineLevel * weightInfo.kcActivity * dt;
        const newWeight = weightInfo.weight + delta;
        // Clamp weights to prevent runaway
        weightInfo.weight = Math.max(0.01, Math.min(5.0, newWeight));
        // Update actual synapse weight
        this.synapses[synIdx].weight = weightInfo.weight;
        weightInfo.lastModified = this.time;
      }
    }
  }

  // Get neuron activity for visualization
  getNeuronActivity(): Float32Array {
    const activity = new Float32Array(this.neurons.length);
    for (let i = 0; i < this.neurons.length; i++) {
      const n = this.neurons[i];
      // Activity = normalized membrane potential with baseline
      const range = n.threshold - n.restingPotential;
      const rawActivity = Math.max(0, Math.min(1, (n.membranePotential - n.restingPotential) / range));
      // Add small baseline activity so brain doesn't look dead
      // Real brains have ongoing subthreshold fluctuations
      activity[i] = rawActivity * 0.85 + 0.05 + Math.random() * 0.03;
      // Boost for recently spiked neurons
      if (this.time - n.lastSpikeTime < 50) {
        activity[i] = 1.0;
      } else if (this.time - n.lastSpikeTime < 100) {
        activity[i] = Math.max(activity[i], 0.7);
      }
    }
    return activity;
  }

  // Get active neuron count
  getActiveCount(): number {
    return this.activeNeurons.size;
  }

  // Get motor neuron activity (for motor output)
  getMotorActivity(): Float32Array {
    const motorActivity = new Float32Array(this.neurons.length);
    for (let i = 0; i < this.neurons.length; i++) {
      const n = this.neurons[i];
      if (n.neuronClass === 'motor' || n.neuronClass === 'descending') {
        const range = n.threshold - n.restingPotential;
        motorActivity[i] = Math.max(0, Math.min(1, (n.membranePotential - n.restingPotential) / range));
        if (this.time - n.lastSpikeTime < 100) {
          motorActivity[i] = 1.0;
        }
      }
    }
    return motorActivity;
  }

  // Get dopamine neuron activity
  getDopamineActivity(): number {
    let total = 0;
    let count = 0;
    for (const n of this.neurons) {
      if (n.neuronClass === 'dopamine') {
        const range = n.threshold - n.restingPotential;
        total += Math.max(0, Math.min(1, (n.membranePotential - n.restingPotential) / range));
        count++;
      }
    }
    return count > 0 ? total / count : 0;
  }

  // Reset network state
  reset() {
    for (const n of this.neurons) {
      n.membranePotential = n.restingPotential;
      n.refractoryUntil = 0;
      n.spikeHistory = [];
      n.lastSpikeTime = -1;
    }
    this.time = 0;
    this.spikeCount = 0;
    this.spikesPerSecond = 0;
    this.dopamineLevel = 0;
    this.dopamineTarget = 0;
    this.activeNeurons.clear();
    this.spikeQueue = [];
    // Reset plastic weights
    for (const [idx, w] of this.kcMbonWeights) {
      // Keep learned weights on reset (they represent memory)
    }
  }

  // Get learned KC→MBON weight matrix (for save/load)
  getLearnedWeights(): number[] {
    return this.synapses.map(s => s.weight);
  }

  // Restore learned weights
  setLearnedWeights(weights: number[]) {
    for (let i = 0; i < this.synapses.length && i < weights.length; i++) {
      this.synapses[i].weight = weights[i];
    }
    // Rebuild kcMbonWeights
    this.synapses.forEach((syn, idx) => {
      if (this.plasticSynapses.has(idx)) {
        const existing = this.kcMbonWeights.get(idx);
        if (existing) existing.weight = syn.weight;
      }
    });
  }

  // Get membrane potentials (for save/load)
  getMembranePotentials(): number[] {
    return this.neurons.map(n => n.membranePotential);
  }

  // Restore membrane potentials
  setMembranePotentials(potentials: number[]) {
    for (let i = 0; i < this.neurons.length && i < potentials.length; i++) {
      this.neurons[i].membranePotential = potentials[i];
    }
  }
}
