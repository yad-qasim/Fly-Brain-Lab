// Real-time graph rendering using Canvas 2D
// Draws learning curves, reward/dopamine traces, neural activity, and interaction counts

import { ExperimentController } from './experiment';

export class GraphRenderer {
  controller: ExperimentController;
  canvases: Map<string, HTMLCanvasElement> = new Map();
  contexts: Map<string, CanvasRenderingContext2D> = new Map();

  constructor(controller: ExperimentController) {
    this.controller = controller;
    this.setupCanvases();
  }

  private setupCanvases() {
    const ids = ['graph-interactions', 'graph-success-rate', 'graph-reward', 'graph-neural-activity'];
    for (const id of ids) {
      const canvas = document.getElementById(id) as HTMLCanvasElement;
      if (canvas) {
        canvas.width = canvas.clientWidth * 2;
        canvas.height = canvas.clientHeight * 2;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          this.canvases.set(id, canvas);
          this.contexts.set(id, ctx);
        }
      }
    }
  }

  update() {
    this.drawInteractions();
    this.drawSuccessRate();
    this.drawReward();
    this.drawNeuralActivity();
  }

  private drawLine(ctx: CanvasRenderingContext2D, data: number[], color: string, w: number, h: number, max: number) {
    if (data.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1)) * w;
      const y = h - (data[i] / max) * h * 0.9 - h * 0.05;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  private drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  private drawInteractions() {
    const ctx = this.contexts.get('graph-interactions');
    if (!ctx) return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);
    this.drawGrid(ctx, w, h);

    const interactions = this.controller.stats.flagInteractions;
    if (interactions.length < 2) return;

    // Bin interactions by time
    const maxTime = interactions[interactions.length - 1].time;
    const bins = 50;
    const binSize = maxTime / bins || 1;
    const counts = new Array(bins).fill(0);
    for (const inter of interactions) {
      const bin = Math.min(bins - 1, Math.floor(inter.time / binSize));
      counts[bin]++;
    }
    const maxCount = Math.max(...counts, 1);
    this.drawLine(ctx, counts, '#4a9eff', w, h, maxCount);
  }

  private drawSuccessRate() {
    const ctx = this.contexts.get('graph-success-rate');
    if (!ctx) return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);
    this.drawGrid(ctx, w, h);

    const curve = this.controller.stats.learningCurve;
    if (curve.length < 2) return;

    const data = curve.map(c => c.successRate * 100);
    this.drawLine(ctx, data, '#00d97e', w, h, 100);

    // Draw current rate line
    ctx.strokeStyle = 'rgba(0, 217, 126, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    const currentRate = this.controller.stats.attempts > 0
      ? (this.controller.stats.successes / this.controller.stats.attempts) * 100 : 0;
    const y = h - (currentRate / 100) * h * 0.9 - h * 0.05;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawReward() {
    const ctx = this.contexts.get('graph-reward');
    if (!ctx) return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);
    this.drawGrid(ctx, w, h);

    // Dopamine history
    const dopamine = this.controller.reward.dopamineHistory;
    if (dopamine.length > 1) {
      const data = dopamine.slice(-200).map(d => d.level);
      this.drawLine(ctx, data, '#a855f7', w, h, 1);
    }

    // Reward history
    const rewards = this.controller.reward.rewardHistory;
    if (rewards.length > 1) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      const maxTime = rewards[rewards.length - 1].time;
      for (const r of rewards) {
        const x = (r.time / Math.max(maxTime, 1)) * w;
        const y = h - r.magnitude * h * 0.9 - h * 0.05;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private drawNeuralActivity() {
    const ctx = this.contexts.get('graph-neural-activity');
    if (!ctx) return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);
    this.drawGrid(ctx, w, h);

    const history = this.controller.stats.neuralActivityHistory;
    if (history.length < 2) return;

    const recent = history.slice(-200);
    const total = this.controller.connectome.neurons.length;

    // Active neurons
    const activeData = recent.map(a => a.activeCount);
    this.drawLine(ctx, activeData, '#4a9eff', w, h, Math.max(total, 1));

    // Spike rate
    const spikeData = recent.map(a => a.spikeRate / 100);
    this.drawLine(ctx, spikeData, '#ff8c42', w, h, Math.max(...spikeData, 1));
  }
}
