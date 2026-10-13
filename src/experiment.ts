// Experiment controller: Manages the full experiment lifecycle
// Coordinates sensory → neural → motor → environment → reward → learning loop
//
// DATA SOURCE CLASSIFICATION:
// - Experiment design: INVENTED (our experimental protocol)
// - Flag auto-lowering: INVENTED (our experimental design)
// - Statistics collection: INVENTED (our measurement framework)
// - Episode management: INVENTED

import { NeuralNetwork } from './neural';
import { SensorySystem } from './sensory';
import { MotorSystem } from './motor';
import { RewardSystem } from './reward';
import { ConnectomeData, ExperimentConfig, ExperimentStats, FlyState, FlagState, TimelineEntry, ViewMode, PerformanceMode } from './types';
import { WORLD, DEFAULT_CONFIG, PERF_MODE_CONFIG, SIM_DT } from './config';

export class ExperimentController {
  connectome: ConnectomeData;
  network: NeuralNetwork;
  sensory: SensorySystem;
  motor: MotorSystem;
  reward: RewardSystem;
  config: ExperimentConfig;

  // State
  time: number = 0;
  running: boolean = true;
  speed: number = 1.0;
  perfMode: PerformanceMode = 'balanced';
  viewMode: ViewMode = 'world';

  // Fly and flag state
  fly: FlyState;
  flag: FlagState;
  flagLowerTimer: number = 0;
  flagRaiseProgress: number = 0;

  // Stats
  stats: ExperimentStats;
  timeline: TimelineEntry[] = [];
  maxTimelineEntries: number = 200;

  // Episode tracking
  episode: number = 0;
  lastSuccessTime: number = 0;
  wasInteracting: boolean = false;

  // Recording for replay
  recording: { time: number; fly: FlyState; flag: FlagState; dopamine: number; reward: number; activeNeurons: number }[] = [];
  isReplaying: boolean = false;
  replayIndex: number = 0;

  // Performance tracking
  simFps: number = 0;
  renderFps: number = 0;
  realTimeFactor: number = 1.0;
  frameCount: number = 0;
  lastFpsUpdate: number = 0;

  constructor(connectome: ConnectomeData) {
    this.connectome = connectome;
    this.config = { ...DEFAULT_CONFIG };
    this.network = new NeuralNetwork(connectome, this.config.learningRate, this.config.dopamineDecay);
    this.sensory = new SensorySystem(this.network);
    this.motor = new MotorSystem(this.network);
    this.reward = new RewardSystem(this.network, this.config);

    this.fly = {
      position: [...WORLD.flyStartPos] as [number, number, number],
      velocity: [0, 0, 0],
      orientation: 0,
      behavior: 'idle',
      speed: 0,
    };

    this.flag = {
      raised: false,
      height: 0.5,
      wind: 0.3,
      interactionState: 'none',
      waveAmplitude: 0.1,
    };

    this.stats = {
      episode: 0,
      attempts: 0,
      successes: 0,
      failures: 0,
      timeToFirstSuccess: -1,
      successIntervals: [],
      movementDistance: 0,
      rewardEvents: [],
      dopamineHistory: [],
      neuralActivityHistory: [],
      flagInteractions: [],
      learningCurve: [],
      totalReward: 0,
      startTime: 0,
    };
  }

  setConfig(config: Partial<ExperimentConfig>) {
    this.config = { ...this.config, ...config };
    this.reward.updateConfig(this.config);
  }

  setMode(mode: string) {
    this.config.mode = mode as any;
    this.reward.updateConfig(this.config);
  }

  setPerfMode(mode: PerformanceMode) {
    this.perfMode = mode;
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
  }

  setSpeed(speed: number) {
    this.speed = speed;
  }

  pause() { this.running = false; }
  resume() { this.running = true; }

  reset() {
    this.time = 0;
    this.episode = 0;
    this.lastSuccessTime = 0;
    this.wasInteracting = false;
    this.flagLowerTimer = 0;
    this.flagRaiseProgress = 0;
    this.timeline = [];
    this.recording = [];

    this.fly = {
      position: [...WORLD.flyStartPos] as [number, number, number],
      velocity: [0, 0, 0],
      orientation: 0,
      behavior: 'idle',
      speed: 0,
    };

    this.flag = {
      raised: false,
      height: 0.5,
      wind: 0.3,
      interactionState: 'none',
      waveAmplitude: 0.1,
    };

    this.stats = {
      episode: 0,
      attempts: 0,
      successes: 0,
      failures: 0,
      timeToFirstSuccess: -1,
      successIntervals: [],
      movementDistance: 0,
      rewardEvents: [],
      dopamineHistory: [],
      neuralActivityHistory: [],
      flagInteractions: [],
      learningCurve: [],
      totalReward: 0,
      startTime: 0,
    };

    this.network.reset();
    this.reward.reset();
  }

  // Main simulation step
  step(dt: number): void {
    if (!this.running || this.isReplaying) return;

    const perfConfig = PERF_MODE_CONFIG[this.perfMode];
    const scaledDt = dt * this.speed;
    const stepsPerFrame = perfConfig.stepsPerFrame;
    const stepDt = (scaledDt / stepsPerFrame) * 1000; // convert to ms

    for (let s = 0; s < stepsPerFrame; s++) {
      this.simulationStep(stepDt);
    }

    // Update performance metrics
    this.frameCount++;
    if (this.time - this.lastFpsUpdate > 1000) {
      this.simFps = this.frameCount * stepsPerFrame;
      this.realTimeFactor = (this.time - this.lastFpsUpdate) / 1000;
      this.frameCount = 0;
      this.lastFpsUpdate = this.time;
    }
  }

  // Exploration drive: random walk timer
  explorationTimer: number = 0;
  explorationDirection: number = 0;

  // Real BANC fly trajectory replay (BANCr Y-maze centroid tracking,
  // Bates et al. 2026 — real measured locomotion of the actual BANC fly).
  realTrajectory: { t: number[]; x: number[]; y: number[] } | null = null;
  replayRealFly: boolean = false;
  trajectoryT: number = 0;
  trajectoryIdx: number = 0;
  static readonly TRAJ_SPEEDUP = 6; // 6× timelapse over real seconds

  setRealTrajectory(raw: { t: number[]; x: number[]; y: number[]; bounds: { x: number[]; y: number[] } }) {
    // Map the recorded maze pixels onto the world floor
    const [xmin, xmax] = raw.bounds.x, [ymin, ymax] = raw.bounds.y;
    const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
    const span = Math.max(xmax - xmin, ymax - ymin) || 1;
    const s = (WORLD.floorSize * 0.7) / span;
    this.realTrajectory = {
      t: raw.t,
      x: raw.x.map(v => (v - cx) * s),
      y: raw.y.map(v => (v - cy) * s),
    };
  }

  // Drive the fly along the REAL recorded trajectory (overrides decoded motor)
  private applyRealTrajectory(dtSec: number): void {
    const traj = this.realTrajectory;
    if (!traj) return;
    this.trajectoryT += dtSec * ExperimentController.TRAJ_SPEEDUP;
    while (this.trajectoryIdx < traj.t.length - 2 && traj.t[this.trajectoryIdx + 1] < this.trajectoryT) {
      this.trajectoryIdx++;
    }
    if (this.trajectoryT > traj.t[traj.t.length - 1]) {
      // Loop the recording
      this.trajectoryIdx = 0;
      this.trajectoryT = traj.t[0];
      return;
    }
    // Interpolate between recorded frames
    const i = this.trajectoryIdx;
    const t0 = traj.t[i], t1 = traj.t[i + 1];
    const f = t1 > t0 ? (this.trajectoryT - t0) / (t1 - t0) : 0;
    const nx = traj.x[i] + (traj.x[i + 1] - traj.x[i]) * f;
    const ny = traj.y[i] + (traj.y[i + 1] - traj.y[i]) * f;
    const dx = nx - this.fly.position[0];
    const dz = ny - this.fly.position[2];
    const d = Math.hypot(dx, dz);
    if (d > 0.02) this.fly.orientation = Math.atan2(dx, dz);
    this.fly.position[0] = nx;
    this.fly.position[2] = ny;
    this.fly.speed = dtSec > 0 ? d / dtSec : 0;
    this.fly.behavior = this.fly.speed > 0.3 ? 'walking' : 'idle';
  }

  private simulationStep(dtMs: number): void {
    this.time += dtMs;
    const dtSec = dtMs / 1000;

    // 1. SENSORY: Compute visual input from environment
    const flagWorldPos: [number, number, number] = [
      WORLD.flagPoleX,
      0.5 + this.flag.height * (WORLD.flagPoleHeight - 1.3),
      WORLD.flagPoleZ,
    ];
    this.sensory.computeVisualInput(this.fly, this.flag, flagWorldPos);
    this.sensory.injectIntoNetwork();

    // 1b. EXPLORATION: Inject baseline motor activity so the fly walks around
    this.explorationTimer += dtSec;
    if (this.explorationTimer > 2 + Math.random() * 3) {
      this.explorationTimer = 0;
      // Pick a new random direction, biased toward the flag
      const dx = WORLD.flagPoleX - this.fly.position[0];
      const dz = WORLD.flagPoleZ - this.fly.position[2];
      const angleToFlag = Math.atan2(dx, dz);
      // 70% chance to head toward flag, 30% random
      if (Math.random() < 0.7) {
        this.explorationDirection = angleToFlag + (Math.random() - 0.5) * 0.5;
      } else {
        this.explorationDirection = Math.random() * Math.PI * 2;
      }
    }

    // Inject exploration current into motor neurons
    const motorNeurons = this.network.neurons.filter(n => n.neuronClass === 'motor' || n.neuronClass === 'descending');
    for (const n of motorNeurons) {
      const isLeft = n.hemisphere === 'left';
      const targetOrient = this.explorationDirection;
      const orientDiff = targetOrient - this.fly.orientation;
      // Inject more current into the side that turns toward target
      const turnBias = Math.sin(orientDiff) * (isLeft ? -1 : 1);
      n.membranePotential += (0.5 + turnBias * 0.5 + Math.random() * 0.3) * dtMs * 0.1;
    }

    // 2. NEURAL: Step the neural network
    this.network.step(dtMs);

    // 3. MOTOR: Decode motor output and apply movement
    if (this.replayRealFly && this.realTrajectory) {
      // REAL locomotion: drive the fly along the recorded BANC trajectory.
      // The neural sim still runs in parallel (sensory->brain->motor decode).
      this.applyRealTrajectory(dtSec);
      // Still decode so the motor output stays visible in the HUD
      this.motor.decodeMotorOutput();
    } else {
      this.motor.applyMovement(this.fly, dtSec);
    }

    // 3b. BOOST: Ensure minimum movement so the fly actually walks
    if (this.motor.forwardDrive < 0.1) {
      // Direct position nudge if neural motor is too weak
      const speed = 0.02 * dtSec * 60;
      this.fly.position[0] += Math.sin(this.explorationDirection) * speed;
      this.fly.position[2] += Math.cos(this.explorationDirection) * speed;
      this.fly.speed = speed;
      this.fly.behavior = 'walking';
      // Smoothly turn toward exploration direction
      let diff = this.explorationDirection - this.fly.orientation;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.fly.orientation += diff * 0.05;
    }

    // Keep fly on ground
    this.fly.position[1] = 0.05;

    // Boundary check
    const half = WORLD.floorSize / 2 - 0.5;
    this.fly.position[0] = Math.max(-half, Math.min(half, this.fly.position[0]));
    this.fly.position[2] = Math.max(-half, Math.min(half, this.fly.position[2]));

    // 4. ENVIRONMENT: Check flag interaction
    const canInteract = this.motor.canInteractWithFlag(this.fly);
    // Also check direct proximity for flag raising
    const flagDx = this.fly.position[0] - WORLD.flagPoleX;
    const flagDz = this.fly.position[2] - WORLD.flagPoleZ;
    const distToFlag = Math.sqrt(flagDx * flagDx + flagDz * flagDz);
    const isReaching = this.motor.isAttemptingInteraction(this.fly) || (canInteract && distToFlag < 1.0);

    if (canInteract) {
      this.flag.interactionState = isReaching ? 'touching' : 'approaching';
    } else {
      this.flag.interactionState = 'none';
    }

    // 5. FLAG INTERACTION: If fly is reaching and near flag, raise the flag
    if (isReaching && !this.flag.raised) {
      this.flag.raised = true;
      this.flagRaiseProgress = 0;
      this.stats.attempts++;
      this.stats.flagInteractions.push({ time: this.time / 1000, success: true });

      // Record timeline event
      this.addTimelineEntry('flag', `Flag raised by fly (attempt ${this.stats.attempts})`);

      // 6. REWARD: Generate dopamine/reward signal
      this.reward.onFlagInteraction(this.time / 1000);
      this.stats.successes++;

      if (this.stats.timeToFirstSuccess < 0) {
        this.stats.timeToFirstSuccess = this.time / 1000;
      }

      const interval = this.time / 1000 - this.lastSuccessTime;
      if (this.lastSuccessTime > 0) {
        this.stats.successIntervals.push(interval);
      }
      this.lastSuccessTime = this.time / 1000;

      this.addTimelineEntry('reward', `Reward signal: ${this.reward.currentReward.toFixed(3)}`);
      this.addTimelineEntry('neural', `Dopamine released: ${this.network.dopamineLevel.toFixed(3)}`);

      this.episode++;
      this.stats.episode = this.episode;

      // Update learning curve
      const successRate = this.stats.attempts > 0 ? this.stats.successes / this.stats.attempts : 0;
      this.stats.learningCurve.push({ episode: this.episode, successRate });
    } else if (isReaching && this.flag.raised) {
      // Already raised - no new reward
      this.flag.interactionState = 'touching';
    }

    // 7. FLAG DYNAMICS: Animate flag raising and auto-lowering
    if (this.flag.raised) {
      this.flagRaiseProgress = Math.min(1, this.flagRaiseProgress + dtMs / 1000);
      this.flag.height = this.flagRaiseProgress;
      this.flag.waveAmplitude = 0.15 + Math.sin(this.time / 500) * 0.05;

      this.flagLowerTimer += dtMs / 1000;
      if (this.flagLowerTimer > this.config.flagLowerTime) {
        // Flag auto-lowers to 50% height
        this.flag.raised = false;
        this.flag.height = 0.5;
        this.flagRaiseProgress = 0;
        this.flagLowerTimer = 0;
        this.addTimelineEntry('flag', 'Flag auto-lowered');
      }
    } else {
      this.flag.height = Math.max(0.5, this.flag.height - dtMs / 500);
      this.flagLowerTimer = 0;
    }

    // 8. REWARD UPDATE: Update reward/dopamine dynamics
    this.reward.update(dtMs / 1000, this.time / 1000);

    // 9. STATS: Record activity
    const activeCount = this.network.getActiveCount();
    const spikeRate = this.network.spikesPerSecond;
    this.stats.neuralActivityHistory.push({
      time: this.time / 1000,
      activeCount,
      spikeRate,
    });
    if (this.stats.neuralActivityHistory.length > 5000) this.stats.neuralActivityHistory.shift();

    // Track movement distance
    const moveDx = this.fly.position[0] - this.motor.prevPosition[0];
    const moveDz = this.fly.position[2] - this.motor.prevPosition[2];
    this.stats.movementDistance += Math.sqrt(moveDx * moveDx + moveDz * moveDz);
    this.motor.prevPosition = [...this.fly.position] as [number, number, number];

    // 10. RECORD: Save state for replay
    if (this.frameCount % 10 === 0) {
      this.recording.push({
        time: this.time,
        fly: { ...this.fly, position: [...this.fly.position] as [number, number, number], velocity: [...this.fly.velocity] as [number, number, number] },
        flag: { ...this.flag },
        dopamine: this.network.dopamineLevel,
        reward: this.reward.currentReward,
        activeNeurons: activeCount,
      });
      if (this.recording.length > 10000) this.recording.shift();
    }
  }

  private addTimelineEntry(category: TimelineEntry['category'], event: string) {
    this.timeline.push({
      time: this.time / 1000,
      category,
      event,
    });
    if (this.timeline.length > this.maxTimelineEntries) this.timeline.shift();
  }

  // Get flag world position for 3D rendering
  getFlagWorldPos(): [number, number, number] {
    return [
      WORLD.flagPoleX,
      0.5 + this.flag.height * (WORLD.flagPoleHeight - 1.3),
      WORLD.flagPoleZ,
    ];
  }

  // Get current stats summary
  getStatsSummary() {
    const successRate = this.stats.attempts > 0 ? (this.stats.successes / this.stats.attempts) * 100 : 0;
    const avgInterval = this.stats.successIntervals.length > 0
      ? this.stats.successIntervals.reduce((a, b) => a + b, 0) / this.stats.successIntervals.length
      : -1;

    return {
      episode: this.episode,
      attempts: this.stats.attempts,
      successes: this.stats.successes,
      successRate,
      timeToFirstSuccess: this.stats.timeToFirstSuccess,
      avgInterval,
      reward: this.reward.currentReward,
      cumulative: this.reward.cumulativeReward,
      dopamine: this.network.dopamineLevel,
      learningRate: this.config.learningRate,
    };
  }

  // Export data
  exportCSV(): string {
    const rows = ['time,active_neurons,spike_rate,dopamine,reward,flag_raised,flag_height,fly_x,fly_y,fly_z,fly_behavior,attempts,successes'];
    for (const entry of this.recording) {
      rows.push([
        entry.time / 1000,
        entry.activeNeurons,
        this.network.spikesPerSecond,
        entry.dopamine,
        entry.reward,
        entry.flag.raised ? 1 : 0,
        entry.flag.height,
        entry.fly.position[0],
        entry.fly.position[1],
        entry.fly.position[2],
        entry.fly.behavior,
        this.stats.attempts,
        this.stats.successes,
      ].join(','));
    }
    return rows.join('\n');
  }

  exportJSON(): string {
    return JSON.stringify({
      version: '1.0.0',
      config: this.config,
      stats: this.stats,
      timeline: this.timeline,
      recording: this.recording.slice(-1000),
      connectome: this.connectome.metadata,
    }, null, 2);
  }

  // Save experiment state
  saveState(): string {
    return JSON.stringify({
      version: '1.0.0',
      seed: this.config.seed,
      config: this.config,
      neuralState: {
        membranePotentials: this.network.getMembranePotentials(),
        synapticWeights: this.network.getLearnedWeights(),
      },
      stats: this.stats,
      simulationTime: this.time,
      savedAt: new Date().toISOString(),
    }, null, 2);
  }

  loadState(json: string): boolean {
    try {
      const data = JSON.parse(json);
      this.config = data.config;
      this.time = data.simulationTime;
      this.stats = data.stats;
      this.network.setMembranePotentials(data.neuralState.membranePotentials);
      this.network.setLearnedWeights(data.neuralState.synapticWeights);
      this.reward.updateConfig(this.config);
      return true;
    } catch {
      return false;
    }
  }

  // Replay
  startReplay() {
    this.isReplaying = true;
    this.replayIndex = 0;
  }

  stopReplay() {
    this.isReplaying = false;
  }

  getReplayFrame(): { time: number; fly: FlyState; flag: FlagState; dopamine: number; reward: number; activeNeurons: number } | null {
    if (!this.isReplaying || this.replayIndex >= this.recording.length) return null;
    return this.recording[this.replayIndex++];
  }
}
