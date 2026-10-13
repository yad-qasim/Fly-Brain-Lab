// Standalone full-screen BANC connectome viewer (opens in its own tab).
// Shows the ACTIVE FRUITFLY'S live brain: the main tab broadcasts its real
// LIF network activity over a BroadcastChannel and this view renders it.
// Falls back to spontaneous activity if the main tab isn't running.

import { loadBancData, BancData, bancSwcUrl, loadNeuronMetrics, BancNorm } from './banc_loader';
import { buildConnectomeFromBanc } from './connectome';
import { generateBrainNeuronsFromBanc } from './brain_data';
import { NeuralVisualization } from './neural_viz';
import { NeuralNetwork } from './neural';
import { SIM_DT } from './config';

// Educational explanations per display region (real Drosophila neuroanatomy)
const REGION_INFO: Record<string, { title: string; text: string }> = {
  all: {
    title: 'Drosophila melanogaster CNS',
    text: 'The complete central nervous system of one adult female fruit fly — brain and ventral nerve cord — reconstructed at synapse resolution in the BANC connectome (Bates et al. 2026, Nature). Every dot is a real neuron at its real soma position; colors show neuron classes, brightness shows live activity.',
  },
  optic_lobe: {
    title: 'Optic Lobe',
    text: 'Retinotopic visual processing: lamina, medulla, lobula and lobula plate. Contains ~58% of all CNS neurons — the fly devotes most of its brain to vision. Motion pathways (T4/T5), color and form channels originate here.',
  },
  central_brain: {
    title: 'Central Brain',
    text: 'Multisensory integration and action selection: protocerebrum, lateral horn, superior neuropils and the central complex — the fly\'s navigation and heading-direction system.',
  },
  mushroom_body: {
    title: 'Mushroom Body',
    text: 'The fly\'s learning-and-memory center. Kenyon cells (KCs) encode sparse sensory representations; MB output neurons (MBONs) read them out; dopaminergic PAM/PPL neurons write associations — the same KC→MBON dopamine-modulated circuit this simulation models.',
  },
  antennal_lobe: {
    title: 'Antennal Lobe',
    text: 'Primary olfactory processing — the insect analog of the olfactory bulb. Olfactory receptor neurons converge on ~50 glomeruli, relayed by projection neurons to the mushroom body and lateral horn.',
  },
  suboesophageal_zone: {
    title: 'Suboesophageal Zone (Gnathal Ganglion)',
    text: 'Gustatory input and feeding control — taste receptor neurons from the proboscis terminate here; motor neurons for proboscis extension and mouthparts originate here.',
  },
  cervical_connective: {
    title: 'Cervical Connective',
    text: 'The neck bundle — descending neurons carry brain commands to the VNC; ascending neurons report body state back to the brain. The only information channel between brain and ventral nerve cord.',
  },
  ventral_nerve_cord: {
    title: 'Ventral Nerve Cord',
    text: 'The fly\'s spinal cord: leg, wing and neck motor neurons plus the central pattern generators for walking, flying and grooming. BANC is the first connectome to unite it with the brain.',
  },
};

// Parse a real BANC SWC skeleton into display-space line segments.
// SWC columns: id label x y z radius parent. Labels: 1=soma, 2=axon,
// 3/4=dendrite, others=unspecified neurite (natverse split skeletons).
function parseSwc(text: string, norm: BancNorm): { verts: Float32Array; colors: Float32Array } {
  const nodes = new Map<number, [number, number, number, number]>();
  const edges: [number, number][] = [];
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const p = s.split(/\s+/);
    if (p.length < 7) continue;
    const id = +p[0], label = +p[1], x = +p[2], y = +p[3], z = +p[4], parent = +p[6];
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;
    nodes.set(id, [x, y, z, label]);
    if (parent !== -1) edges.push([id, parent]);
  }
  const verts = new Float32Array(edges.length * 6);
  const colors = new Float32Array(edges.length * 6);
  const LABEL_COLORS: Record<number, [number, number, number]> = {
    1: [1, 1, 1],          // soma — white
    2: [1, 0.55, 0.25],    // axon — warm
    3: [0.3, 0.7, 1],      // dendrite — cool
    4: [0.4, 0.85, 1],     // dendrite — cool
  };
  const fallback: [number, number, number] = [0.65, 0.8, 0.9];
  const disp = (v: number[]): [number, number, number] => [
    (v[0] - norm.x_center) / norm.scale,
    -(v[1] - norm.y_center) / norm.scale,
    (v[2] - norm.z_center) / norm.scale,
  ];
  edges.forEach(([a, b], i) => {
    const A = nodes.get(a)!, B = nodes.get(b)!;
    const da = disp(A), db = disp(B);
    verts.set([...da, ...db], i * 6);
    const c = LABEL_COLORS[A[3]] || fallback;
    colors.set([...c, ...c], i * 6);
  });
  return { verts, colors };
}

interface LiveMsg {
  activity: Float32Array;
  behavior: string;
  speed: number;
  dopamine: number;
  spikesPerSecond: number;
  simTime: number;
  mode: string;
}

async function init() {
  const loading = document.getElementById('loading')!;
  const loadingFill = document.getElementById('loading-fill')!;
  const loadingText = document.getElementById('loading-text')!;
  const infoEl = document.getElementById('brain-info')!;
  const liveEl = document.getElementById('live-stats')!;

  loadingFill.style.width = '15%';
  loadingText.textContent = 'Loading real BANC v888 data...';
  const bancData: BancData = await loadBancData('/data');

  loadingFill.style.width = '40%';
  loadingText.textContent = 'Building connectome from real BANC data...';
  const connectome = buildConnectomeFromBanc(bancData);

  loadingFill.style.width = '60%';
  loadingText.textContent = `Loading ${bancData.neurons.length.toLocaleString()} real BANC neurons...`;
  const brainNeurons = generateBrainNeuronsFromBanc(connectome, bancData);

  loadingFill.style.width = '80%';
  loadingText.textContent = 'Building 3D CNS...';
  const container = document.getElementById('brain-full')!;
  const viz = new NeuralVisualization(container, brainNeurons, connectome, bancData.regions);

  loadingText.textContent = 'Loading real morphology metrics...';
  const metrics = await loadNeuronMetrics('/data');

  // Fallback spontaneous network (used only when no live broadcast arrives)
  const network = new NeuralNetwork(connectome);

  // Neuron counts per display region (real soma counts from the data)
  const regionCounts = new Map<string, number>();
  for (const n of brainNeurons) regionCounts.set(n.region, (regionCounts.get(n.region) || 0) + 1);

  const infoTitle = infoEl.querySelector('.info-title')!;
  const infoText = infoEl.querySelector('.info-text')!;
  function showRegionInfo(filter: string) {
    const ri = REGION_INFO[filter] || REGION_INFO['all'];
    const count = filter === 'all' ? brainNeurons.length : (regionCounts.get(filter) || 0);
    infoTitle.textContent = ri.title;
    infoText.textContent = `${ri.text} — ${count.toLocaleString()} neurons shown`;
  }
  showRegionInfo('all');

  // Region filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = (btn as HTMLElement).dataset.filter || 'all';
      viz.setFilter(filter);
      showRegionInfo(filter);
    });
  });

  // Live brain activity broadcast from the main tab (the active fly's brain)
  let live: LiveMsg | null = null;
  let liveAt = 0;
  const channel = new BroadcastChannel('banc-brain-live');
  channel.onmessage = (e) => { live = e.data; liveAt = performance.now(); };

  // Click inspector — real BANC annotation + real morphology metrics, and
  // lazy-fetch of the neuron's REAL skeleton (SWC) from the BANC repository.
  const inspector = document.getElementById('inspector')!;
  let inspectorTimer = 0;
  let fetchSeq = 0;
  function renderInspector(info: NonNullable<ReturnType<typeof viz.inspectNeuron>>, skelStatus: string) {
    const m = info.bancId ? metrics.get(info.bancId) : undefined;
    let html = `<div class="ins-title">Neuron ${info.bancId || '#' + info.id}</div>`;
    const rows: Record<string, string> = {
      'Cell Type': info.cellType,
      'Cell Class': info.cellClass,
      Neuropil: info.rootRegion,
      Region: info.region.replace(/_/g, ' '),
      Class: info.neuronClass,
      Neurotransmitter: info.neurotransmitter,
      Hemisphere: info.hemisphere,
      Skeleton: skelStatus,
    };
    if (m) {
      rows['Cable length'] = `${m.cable_um.toFixed(0)} µm`;
      rows['Synapses'] = `${m.in_conn.toLocaleString()} in / ${m.out_conn.toLocaleString()} out`;
      rows['Axon / Dendrite'] = `${m.axon_um.toFixed(0)} / ${m.dend_um.toFixed(0)} µm`;
    }
    for (const [k, v] of Object.entries(rows)) {
      html += `<div class="ins-row"><span>${k}</span><b>${v}</b></div>`;
    }
    inspector.innerHTML = html;
    inspector.classList.remove('hidden');
    inspector.style.left = '50%';
    inspector.style.top = '60px';
    inspector.style.transform = 'translateX(-50%)';
  }
  viz.onClickCallback = async (id: number) => {
    const info = viz.inspectNeuron(id);
    if (!info) return;
    const seq = ++fetchSeq;
    renderInspector(info, info.bancId ? 'fetching real morphology…' : 'no BANC id');
    if (!info.bancId || !bancData.norm) return;
    try {
      const res = await fetch(bancSwcUrl(info.bancId));
      if (!res.ok) {
        if (seq === fetchSeq) renderInspector(info, 'not skeletonized in v888 release');
        return;
      }
      const { verts, colors } = parseSwc(await res.text(), bancData.norm);
      if (seq !== fetchSeq) return;
      if (verts.length) {
        viz.showSkeleton(verts, colors);
        renderInspector(info, `REAL morphology · ${verts.length / 2} segments`);
      } else {
        renderInspector(info, 'empty skeleton file');
      }
    } catch {
      if (seq === fetchSeq) renderInspector(info, 'fetch failed (offline?)');
    }
    clearTimeout(inspectorTimer);
    inspectorTimer = window.setTimeout(() => inspector.classList.add('hidden'), 8000);
  };

  loadingFill.style.width = '100%';
  loadingText.textContent = 'Ready! (Real BANC v888 data)';
  setTimeout(() => loading.classList.add('hidden'), 400);

  function animate() {
    requestAnimationFrame(animate);
    const isLive = live && performance.now() - liveAt < 2000;
    if (isLive && live) {
      // Render the active fly's real brain activity
      viz.updateActivity(network, live.activity);
      liveEl.textContent =
        `LIVE — fly is ${live.behavior} · dopamine ${live.dopamine.toFixed(2)} · ` +
        `${live.spikesPerSecond.toLocaleString()} spikes/s · mode: ${live.mode}`;
    } else {
      // Fallback: spontaneous activity on the real connectome
      for (let i = 0; i < 10; i++) network.step(SIM_DT);
      viz.updateActivity(network);
      liveEl.textContent = 'No live fly — showing spontaneous activity (open the main tab to sync)';
    }
    viz.update();
  }
  animate();

  window.addEventListener('resize', () => {
    viz.onResize(container.clientWidth, container.clientHeight);
  });
}

init().catch(e => {
  const loadingText = document.getElementById('loading-text');
  if (loadingText) loadingText.textContent = 'ERROR: ' + e;
  console.error(e);
});
