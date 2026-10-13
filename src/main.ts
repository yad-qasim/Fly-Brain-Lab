// Main app: split-view 3D world + 3D brain, minimalistic UI

import { World3D } from './world';
import { NeuralVisualization } from './neural_viz';
import { ExperimentController } from './experiment';
import { buildConnectomeFromBanc } from './connectome';
import { generateBrainNeuronsFromBanc, BrainNeuron, getRegionShapes, REGION_COLORS } from './brain_data';
import { loadBancData, hasBancData, BancData } from './banc_loader';
import { MODE_DESCRIPTIONS } from './config';

class App {
  world!: World3D;
  neuralViz!: NeuralVisualization;
  controller!: ExperimentController;
  connectome!: ReturnType<typeof buildConnectomeFromBanc>;
  brainNeurons!: BrainNeuron[];
  bancData: BancData | null = null;

  // UI
  loading: HTMLElement;
  loadingFill: HTMLElement;
  loadingText: HTMLElement;
  topbar: HTMLElement;
  bottomBar: HTMLElement;
  inspector: HTMLElement;

  // Graph canvases
  gLearning: HTMLCanvasElement;
  gDopamine: HTMLCanvasElement;
  gActivity: HTMLCanvasElement;

  // Region pulse tracking
  regionActivity: Map<string, number> = new Map();
  regionNames: string[] = [];
  // Live brain broadcast — the fullscreen brain tab listens on this channel
  brainChannel: BroadcastChannel = new BroadcastChannel('banc-brain-live');

  // Animation
  lastTime = 0;
  fps = 0;
  fpsFrames = 0;
  fpsLast = 0;

  constructor() {
    this.loading = document.getElementById('loading')!;
    this.loadingFill = document.getElementById('loading-fill')!;
    this.loadingText = document.getElementById('loading-text')!;
    this.topbar = document.getElementById('topbar')!;
    this.bottomBar = document.getElementById('bottom-bar')!;
    this.inspector = document.getElementById('inspector')!;

    this.gLearning = document.getElementById('g-learning') as HTMLCanvasElement;
    this.gDopamine = document.getElementById('g-dopamine') as HTMLCanvasElement;
    this.gActivity = document.getElementById('g-activity') as HTMLCanvasElement;
  }

  async init() {
    // Load real BANC data - NO FALLBACK
    this.loadingFill.style.width = '10%';
    this.loadingText.textContent = 'Loading real BANC v888 data...';
    const dataAvailable = await hasBancData('/data');

    if (!dataAvailable) {
      this.loadingText.textContent = 'ERROR: BANC data not found. Run: python scripts/download_banc_data.py';
      console.error('BANC data files not found in /data. Run: python scripts/download_banc_data.py');
      return;
    }

    this.loadingText.textContent = 'Loading real BANC v888 neuron data...';
    try {
      this.bancData = await loadBancData('/data');
      console.log(`BANC data loaded: ${this.bancData.neurons.length} neurons, ${this.bancData.connections.count} connection pairs`);
    } catch (e) {
      this.loadingText.textContent = 'ERROR: Failed to load BANC data: ' + e;
      console.error('Failed to load BANC data:', e);
      return;
    }

    // Build connectome from real BANC data
    this.loadingFill.style.width = '25%';
    this.loadingText.textContent = 'Building connectome from real BANC data...';
    this.connectome = buildConnectomeFromBanc(this.bancData);
    console.log(`Connectome: ${this.connectome.neurons.length} sim neurons, ${this.connectome.synapses.length} synapses`);

    // Generate brain neurons from real BANC data
    this.loadingFill.style.width = '45%';
    this.loadingText.textContent = `Loading ${this.bancData.neurons.length} real BANC neurons...`;
    this.brainNeurons = generateBrainNeuronsFromBanc(this.connectome, this.bancData);

    // Init 3D world (left side)
    this.loadingFill.style.width = '60%';
    this.loadingText.textContent = 'Creating 3D world...';
    const worldContainer = document.getElementById('world-view')!;
    this.world = new World3D(worldContainer);

    // Init 3D CNS visualization (right side)
    this.loadingFill.style.width = '80%';
    this.loadingText.textContent = 'Building 3D CNS...';
    const brainContainer = document.getElementById('brain-view')!;
    this.neuralViz = new NeuralVisualization(brainContainer, this.brainNeurons, this.connectome, this.bancData.regions);

    // Init experiment
    this.loadingFill.style.width = '92%';
    this.loadingText.textContent = 'Starting simulation...';
    this.controller = new ExperimentController(this.connectome);

    // Load the REAL BANC fly trajectory (measured Y-maze locomotion)
    try {
      const traj = await (await fetch('/data/fly_trajectory.json')).json();
      this.controller.setRealTrajectory(traj);
      console.log(`Real BANC fly trajectory loaded: ${traj.t.length} frames`);
    } catch {
      console.warn('Real fly trajectory unavailable');
    }

    // Populate mode selector
    const modeSel = document.getElementById('sim-mode') as HTMLSelectElement;
    for (const [key, desc] of Object.entries(MODE_DESCRIPTIONS)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key;
      modeSel.appendChild(opt);
    }
    modeSel.value = 'reward';

    // Setup region names for pulse tracking (one row per display region;
    // bilateral sides share a region)
    const shapes = getRegionShapes(this.bancData.regions);
    this.regionNames = [...new Set(shapes.map(s => s.region))];
    for (const name of this.regionNames) {
      this.regionActivity.set(name, 0);
    }
    this.setupRegionPulses();

    // Show sim model stats
    (document.getElementById('s-sim-neurons') as HTMLElement).textContent = `${this.connectome.neurons.length}`;
    (document.getElementById('s-sim-synapses') as HTMLElement).textContent = `${this.connectome.synapses.length}`;

    this.setupUI();
    this.setupGraphs();

    // Done
    this.loadingFill.style.width = '100%';
    this.loadingText.textContent = 'Ready! (Real BANC v888 data)';
    setTimeout(() => {
      this.loading.classList.add('hidden');
      this.topbar.classList.remove('hidden');
      this.bottomBar.classList.remove('hidden');
    }, 400);

    this.animate();
    window.addEventListener('resize', () => this.onResize());
  }

  private onResize() {
    const worldEl = document.getElementById('world-view')!;
    const brainEl = document.getElementById('brain-view')!;
    this.world.onResize();
    this.neuralViz.onResize(brainEl.clientWidth, brainEl.clientHeight);
    // Re-setup graph canvases
    for (const c of [this.gLearning, this.gDopamine, this.gActivity]) {
      c.width = c.clientWidth * 2;
      c.height = c.clientHeight * 2;
    }
  }

  private setupRegionPulses() {
    const container = document.getElementById('region-pulses')!;
    const shapes = getRegionShapes(this.bancData?.regions || []);
    const seenRegions = new Set<string>();
    for (const { name, region, color } of shapes) {
      if (seenRegions.has(region)) continue;
      seenRegions.add(region);
      const row = document.createElement('div');
      row.className = 'region-row';
      const hex = `rgb(${Math.round(color[0]*255)},${Math.round(color[1]*255)},${Math.round(color[2]*255)})`;
      row.innerHTML = `
        <div class="region-dot" id="dot-${region}" style="background:${hex};color:${hex}"></div>
        <span class="region-name">${region.replace(/_/g, ' ')}</span>
        <span class="region-val" id="val-${region}">0</span>
      `;
      container.appendChild(row);
    }
  }

  private setupUI() {
    document.getElementById('btn-brain')!.addEventListener('click', () => {
      window.open('brain.html', '_blank');
    });

    // Toggle REAL recorded BANC fly locomotion vs. neural-decoded movement
    const realFlyBtn = document.getElementById('btn-realfly') as HTMLButtonElement;
    const updateRealFlyBtn = () => {
      realFlyBtn.style.opacity = this.controller.replayRealFly ? '1' : '0.5';
      realFlyBtn.title = this.controller.replayRealFly
        ? 'Replaying REAL recorded BANC locomotion — click to return to neural-decoded movement'
        : 'Replay REAL recorded BANC fly locomotion (Y-maze tracking)';
    };
    realFlyBtn.addEventListener('click', () => {
      this.controller.replayRealFly = !this.controller.replayRealFly;
      if (this.controller.replayRealFly) {
        this.controller.trajectoryIdx = 0;
        this.controller.trajectoryT = 0;
      }
      updateRealFlyBtn();
    });
    realFlyBtn.style.opacity = '0.5';

    document.getElementById('btn-play')!.addEventListener('click', () => {
      if (this.controller.running) {
        this.controller.pause();
        (document.getElementById('btn-play') as HTMLButtonElement).textContent = '▶';
      } else {
        this.controller.resume();
        (document.getElementById('btn-play') as HTMLButtonElement).textContent = '⏸';
      }
    });

    document.getElementById('btn-reset')!.addEventListener('click', () => {
      this.controller.reset();
      (document.getElementById('btn-play') as HTMLButtonElement).textContent = '⏸';
    });

    document.getElementById('sim-mode')!.addEventListener('change', (e) => {
      this.controller.setMode((e.target as HTMLSelectElement).value);
    });

    document.getElementById('speed')!.addEventListener('change', (e) => {
      this.controller.setSpeed(parseFloat((e.target as HTMLSelectElement).value));
    });

    // Brain region filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = (btn as HTMLElement).dataset.filter || 'all';
        this.neuralViz.setFilter(filter);
      });
    });

    // Panel toggle buttons (open/close each panel independently)
    document.querySelectorAll('.panel-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const panel = (btn as HTMLElement).closest('.draggable-panel');
        if (panel) panel.classList.toggle('minimized');
        btn.textContent = panel?.classList.contains('minimized') ? '+' : '−';
      });
    });

    // Card toggle buttons (open/close each card independently)
    document.querySelectorAll('.card-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = (btn as HTMLElement).closest('.collapsible-card');
        if (card) card.classList.toggle('collapsed');
        btn.textContent = card?.classList.contains('collapsed') ? '+' : '−';
      });
    });

    // Also allow clicking card header to toggle
    document.querySelectorAll('.card-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('card-btn')) return;
        const card = header.closest('.collapsible-card');
        if (!card) return;
        card.classList.toggle('collapsed');
        const btn = header.querySelector('.card-toggle');
        if (btn) btn.textContent = card.classList.contains('collapsed') ? '+' : '−';
      });
    });

    // Nav tab buttons (Statistics / References)
    const tabPanel = document.getElementById('tab-panel')!;
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = (btn as HTMLElement).dataset.tab;
        // Toggle panel visibility
        if (tabPanel.classList.contains('hidden')) {
          tabPanel.classList.remove('hidden');
        } else {
          // If clicking the already-active tab, close the panel
          const activeNav = document.querySelector('.nav-tab.active') as HTMLElement;
          if (activeNav && activeNav.dataset.tab === tabName) {
            tabPanel.classList.add('hidden');
            return;
          }
        }
        // Switch nav tab active state
        document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Switch tab content
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        const content = tabPanel.querySelector(`.tab-content[data-tab="${tabName}"]`);
        if (content) content.classList.add('active');
        // Switch inner tab buttons
        document.querySelectorAll('.tab-btn').forEach(tb => {
          tb.classList.toggle('active', (tb as HTMLElement).dataset.tab === tabName);
        });
      });
    });

    // Inner tab buttons (within the panel)
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = (btn as HTMLElement).dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        const content = tabPanel.querySelector(`.tab-content[data-tab="${tabName}"]`);
        if (content) content.classList.add('active');
        // Sync nav tab
        document.querySelectorAll('.nav-tab').forEach(nt => {
          nt.classList.toggle('active', (nt as HTMLElement).dataset.tab === tabName);
        });
      });
    });

    // Close button for tab panel
    document.getElementById('tab-panel-close')!.addEventListener('click', () => {
      tabPanel.classList.add('hidden');
      document.querySelectorAll('.nav-tab').forEach(nt => nt.classList.remove('active'));
    });

    // Panel dragging
    this.setupPanelDragging();

    // World click
    this.world.onClickCallback = (obj: string) => {
      if (obj === 'fly') this.showInspector('Fly', {
        Behavior: this.controller.fly.behavior,
        Speed: this.controller.fly.speed.toFixed(4),
        Position: this.controller.fly.position.map(v => v.toFixed(2)).join(', '),
      });
      else if (obj === 'flag') this.showInspector('Flag', {
        Status: this.controller.flag.raised ? 'Raised' : 'Lowered',
        Height: `${(this.controller.flag.height * 100).toFixed(0)}%`,
        Interaction: this.controller.flag.interactionState,
      });
    };

    // Brain click
    this.neuralViz.onClickCallback = (id: number) => {
      const info = this.neuralViz.inspectNeuron(id);
      if (info) {
        this.showInspector(`Neuron #${info.id.toLocaleString()}`, {
          'Cell Type': info.cellType,
          'Cell Class': info.cellClass,
          Neuropil: info.rootRegion,
          Region: info.region.replace(/_/g, ' '),
          Class: info.neuronClass,
          Neurotransmitter: info.neurotransmitter,
          Hemisphere: info.hemisphere,
        });
      }
    };
  }

  private setupPanelDragging() {
    document.querySelectorAll<HTMLElement>('.draggable-panel').forEach(panel => {
      const header = panel.querySelector('.panel-header') as HTMLElement;
      if (!header) return;

      let isDragging = false;
      let startX = 0, startY = 0;
      let panelX = 0, panelY = 0;

      header.addEventListener('mousedown', (e) => {
        if ((e.target as HTMLElement).classList.contains('panel-btn')) return;
        isDragging = true;
        const rect = panel.getBoundingClientRect();
        panelX = rect.left;
        panelY = rect.top;
        startX = e.clientX;
        startY = e.clientY;
        panel.style.position = 'fixed';
        panel.style.left = panelX + 'px';
        panel.style.top = panelY + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panelX += e.clientX - startX;
        panelY += e.clientY - startY;
        startX = e.clientX;
        startY = e.clientY;
        panel.style.left = panelX + 'px';
        panel.style.top = panelY + 'px';
      });

      document.addEventListener('mouseup', () => {
        isDragging = false;
      });
    });
  }

  private showInspector(title: string, rows: Record<string, string>) {
    let html = `<div class="ins-title">${title}</div>`;
    for (const [k, v] of Object.entries(rows)) {
      html += `<div class="ins-row"><span>${k}</span><b>${v}</b></div>`;
    }
    this.inspector.innerHTML = html;
    this.inspector.classList.remove('hidden');
    this.inspector.style.left = '50%';
    this.inspector.style.top = '60px';
    this.inspector.style.transform = 'translateX(-50%)';
    setTimeout(() => this.inspector.classList.add('hidden'), 4000);
  }

  private setupGraphs() {
    for (const c of [this.gLearning, this.gDopamine, this.gActivity]) {
      c.width = c.clientWidth * 2;
      c.height = c.clientHeight * 2;
    }
  }

  private drawGraph(canvas: HTMLCanvasElement, data: number[], color: string, maxVal: number) {
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(180,200,220,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    if (data.length < 2) return;

    const max = Math.max(maxVal, ...data, 0.001);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1)) * w;
      const y = h - (data[i] / max) * h * 0.85 - h * 0.08;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill under curve
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = color.replace('rgb', 'rgba').replace(')', ',0.1)');
    ctx.fill();
  }

  private updateGraphs() {
    // Learning curve
    const curve = this.controller.stats.learningCurve;
    const learningData = curve.length > 0 ? curve.map(c => c.successRate * 100) : [];
    this.drawGraph(this.gLearning, learningData, 'rgb(0,217,126)', 100);

    // Dopamine
    const daHistory = this.controller.reward.dopamineHistory;
    const daData = daHistory.length > 0 ? daHistory.slice(-200).map(d => d.level) : [];
    this.drawGraph(this.gDopamine, daData, 'rgb(168,85,247)', 1);

    // Neural activity
    const actHistory = this.controller.stats.neuralActivityHistory;
    const actData = actHistory.length > 0 ? actHistory.slice(-200).map(a => a.activeCount) : [];
    this.drawGraph(this.gActivity, actData, 'rgb(42,140,255)', this.connectome.neurons.length);
  }

  private updateRegionPulses() {
    // Compute per-region activity from brain neurons
    const activity = this.controller.network.getNeuronActivity();
    const regionSums = new Map<string, number>();
    const regionCounts = new Map<string, number>();

    for (const bn of this.brainNeurons) {
      const a = activity[bn.simulationGroupId] || 0;
      regionSums.set(bn.region, (regionSums.get(bn.region) || 0) + a);
      regionCounts.set(bn.region, (regionCounts.get(bn.region) || 0) + 1);
    }

    for (const name of this.regionNames) {
      const sum = regionSums.get(name) || 0;
      const count = regionCounts.get(name) || 1;
      const avg = sum / count;
      this.regionActivity.set(name, avg);

      const dot = document.getElementById(`dot-${name}`);
      const val = document.getElementById(`val-${name}`);
      if (dot) {
        if (avg > 0.2) dot.classList.add('active');
        else dot.classList.remove('active');
      }
      if (val) {
        val.textContent = (avg * 100).toFixed(0);
      }
    }
  }

  private updateUI() {
    // Top bar stats
    (document.getElementById('s-fps') as HTMLElement).textContent = `${this.fps}`;
    (document.getElementById('s-attempts') as HTMLElement).textContent = `${this.controller.stats.attempts}`;
    const sr = this.controller.stats.attempts > 0
      ? (this.controller.stats.successes / this.controller.stats.attempts * 100).toFixed(0) : '0';
    (document.getElementById('s-success') as HTMLElement).textContent = `${sr}%`;
    (document.getElementById('s-da') as HTMLElement).textContent = this.controller.network.dopamineLevel.toFixed(2);

    // Left overlay
    const fly = this.controller.fly;
    (document.getElementById('o-behavior') as HTMLElement).textContent = fly.behavior;
    (document.getElementById('o-speed') as HTMLElement).textContent = fly.speed.toFixed(3);
    (document.getElementById('o-pos') as HTMLElement).textContent = `${fly.position[0].toFixed(1)},${fly.position[2].toFixed(1)}`;

    const flag = this.controller.flag;
    (document.getElementById('o-flag') as HTMLElement).textContent = flag.raised ? 'raised' : 'lowered';
    (document.getElementById('o-height') as HTMLElement).textContent = `${(flag.height * 100).toFixed(0)}%`;
    (document.getElementById('o-button') as HTMLElement).textContent = flag.interactionState;
  }

  private animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    // FPS
    this.fpsFrames++;
    if (now - this.fpsLast > 1000) {
      this.fps = this.fpsFrames;
      this.fpsFrames = 0;
      this.fpsLast = now;
    }

    // Step simulation
    this.controller.step(dt);

    // Update 3D world
    this.world.updateFlyState(
      this.controller.fly.position,
      this.controller.fly.orientation,
      this.controller.fly.behavior,
      this.controller.fly.speed,
    );
    this.world.updateFlagState(
      this.controller.flag.raised,
      this.controller.flag.height,
      this.controller.flag.wind,
      this.controller.flag.interactionState,
    );
    this.world.update(dt);

    // Update brain visualization (always visible on right side)
    this.neuralViz.updateActivity(this.controller.network);
    this.neuralViz.update();

    // Broadcast the fly's live brain activity to the fullscreen brain tab
    if (this.fpsFrames % 4 === 0) {
      this.brainChannel.postMessage({
        activity: this.neuralViz.simActivity.slice(),
        behavior: this.controller.fly.behavior,
        speed: this.controller.fly.speed,
        dopamine: this.controller.network.dopamineLevel,
        spikesPerSecond: this.controller.network.spikesPerSecond,
        simTime: this.controller.network.time,
        mode: this.controller.config.mode,
      });
    }

    // Update UI (throttled)
    if (this.fpsFrames % 3 === 0) {
      this.updateUI();
    }

    // Update graphs (throttled)
    if (this.fpsFrames % 10 === 0) {
      this.updateGraphs();
    }

    // Update region pulses (throttled)
    if (this.fpsFrames % 5 === 0) {
      this.updateRegionPulses();
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
