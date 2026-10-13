<div align="center">

# 🪰 Fly Brain Lab

### An interactive window into a complete fly brain — all 188,508 real neurons

**The first browser-native exploration of the *BANC v888* connectome:**
every dot is a real cell, every wireframe a real neuropil, every connection
a real synapse count — and a leaky integrate-and-fire brain wired on it all,
driving a fly in a 3D world.

[![BANC v888](https://img.shields.io/badge/data-BANC%20v888-2a8cff)](https://banc.community)
[![Neurons](https://img.shields.io/badge/neurons-188%2C508-00d97e)](https://doi.org/10.1038/s41586-026-10735-w)
[![Connections](https://img.shields.io/badge/connectome%20pairs-2.8M-a855f7)](public/data/banc_connections.bin)
[![Three.js](https://img.shields.io/badge/three.js-0.169-000000)](https://threejs.org)
[![Vite](https://img.shields.io/badge/vite-5.4-646cff)](https://vitejs.dev)
[![Deploy](https://img.shields.io/badge/deploy-vercel-000000)](vercel.json)

[Run locally](#-quickstart) · [Full research writeup](RESEARCH.pdf) · [BANC portal](https://banc.community) · [Original paper](https://doi.org/10.1038/s41586-026-10735-w)

</div>

---

## What is this?

**BANC — Brain And Nerve Cord** is the first synapse-resolution connectome
of an entire *Drosophila* central nervous system: brain **and** ventral nerve
cord, one adult female fly, ~199 million predicted synapses. Until now you
explored it in neuroglancer.

**Fly Brain Lab** puts the whole CNS in a browser window — and brings it alive:

- 🧠 **188,508 neurons** rendered at their true soma coordinates as a live,
  deep-zoomable 3D point cloud
- 🕸️ **2,819,440 cell-type pairs** of real connectivity (lossless binary format)
- 🗺️ **Real neuropil boundaries** computed from `root_region` anatomical
  annotations — optic lobes, mushroom bodies, antennal lobes, SEZ, VNC
- ⚡ **A living brain** — LIF spiking dynamics on the real wiring, with
  **sign-correct synapses** (GABA/Glu/histamine inhibit, ACh excites) and
  **dopamine-gated KC→MBON plasticity** — the actual learning circuit
- 🔬 **Click any neuron** → real annotation + morphology metrics + its
  **real SWC skeleton** streamed from the BANC repository
- 🪰 **A real fly** — movement decoded from real motor neuron pools, or
  replay the *recorded locomotion of the BANC specimen itself*
- 🖥️ **Fullscreen live-brain tab** — the active fly's neural activity
  broadcast to a dedicated viewer, with region-by-region explanations

> Built on the *Nature* 2026 paper snapshot: **Bates, Phelps, Kim, Yang et
> al., “Distributed control circuits across a brain-and-cord connectome.”**
> DOI [`10.1038/s41586-026-10735-w`](https://doi.org/10.1038/s41586-026-10735-w)

---

## ✨ Feature tour

| | |
|---|---|
| 🌐 **Whole-CNS view** | Brain + ventral nerve cord together — the connectome as it really is |
| 🎯 **Region filters** | Optic lobe, central brain, mushroom body, antennal lobe, SEZ, neck, VNC — each mapped to real neuropil annotations |
| 🔭 **Deep zoom** | From whole brain down to single neuropils; neuron-level inspection |
| 🧬 **Real skeletons** | Click a neuron → its real SWC morphology overlays (axon / dendrite colored) |
| 📊 **Real metrics** | Cable length (µm), in/out synapses, axon/dendrite lengths, branchpoints |
| 📡 **Live sync** | Main tab broadcasts the fly's brain activity at ~15 Hz to `brain.html` |
| 🐝 **Real behavior** | Toggle between neural-decoded movement and the *actual* BANCr fly trajectory |
| 📈 **Region pulses** | Live per-neuropil activity, dopamine, learning curve |

---

## 🚀 Quickstart

```bash
npm install
npm run dev          # http://localhost:3000  — brain tab: /brain.html
```

Everything is real data — no generation step needed. The exported dataset
(~135 MB) is committed in `public/data/` so the repo works out of the box.

<details>
<summary><b>Regenerate the data from source</b> (optional)</summary>

```bash
pip install pandas pyarrow numpy
python scripts/download_banc_data.py     # ~415 MB cached into data/raw/
python scripts/export_realism_data.py    # norm + metrics + trajectory
python scripts/make_pdf.py               # regenerate RESEARCH.pdf
```

</details>

## ☁️ Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yad-qasim/fruitfly)

`vercel.json` is already configured — Vite builds `dist/` (multi-page) and
`public/data` is served statically. First load is ~135 MB; the browser
caches it.

---

## 📐 How it works (the science)

### Real data in

- **Positions:** BANC `root_position_nm` → normalized to display units
  (`scale = 537,312 nm`), `+x = left`, brain up / VNC down — verified
  against the real `side` metadata
- **Regions:** `root_region` (Ito et al. 2014 neuropil codes) → bounding
  geometry from the real point cloud (`mean ± 2σ`, tubes for VNC/neck)
- **Connectivity:** all 2,819,440 cell-type pairs of the v3 edgelist
  (synapse counts, connection counts, mean, median) in a 64 MB binary

### Real dynamics on top

```
dV/dt = (V_rest − V)/τ  +  Σ w·s(nt)·δ(t − t_arr)  +  I_noise + I_inj

   w     = clamp(mean_synapses / 50)
   s(nt) = +1 ACh · −1 GABA · −0.9 Glu · −1 histamine · +0.1..0.15 modulatory
   delay = 0.5 ms + distance × 0.72 ms          (real inter-centroid distance)
   Δw    = η · DA(t) · a_KC · Δt                (KC→MBON plastic synapses only)
```

Everything is documented — with honest labeling of what is ground truth
versus model — in **[RESEARCH.pdf](RESEARCH.pdf)**.

---

## 🔬 What we got right (and what's still research)

✅ **Real:** positions, regions, sides, counts, connectivity, NT classes,
morphology metrics, skeletons, locomotion, learning-circuit identity
(KC / MBON / PAM·PPL dopamine / motor pools)

⚠️ **Modeled:** LIF dynamics and injected currents (simplified), one sim
neuron per cell type, bounding-ellipsoid wireframes (not EM surface meshes),
predicted NTs are predictions

📌 **Under development:** neuropil surface meshes, per-synapse spatial
locations, full-skeleton coverage, fitted delays

See the complete, precise honest-assessment table in
[RESEARCH.pdf](RESEARCH.pdf) §6–7.

---

## 🧭 Repo map

```
index.html  brain.html      two-page app (world+brain | fullscreen brain)
src/         TypeScript modules: loader, connectome, LIF, viz, world, sim
scripts/     BANC data pipeline + PDF generator
public/data/ exported research dataset (committed)
RESEARCH.pdf long-form documentation
vercel.json  deploy config
```

---

## 📚 References

- **Bates et al. 2026**, *Nature* — BANC connectome — [paper](https://doi.org/10.1038/s41586-026-10735-w) · [snapshot](https://doi.org/10.7910/DVN/7WTH1N)
- [banc.community](https://banc.community) · [ng.banc.community](https://ng.banc.community/view) · [codex.flywire.ai](https://codex.flywire.ai)
- Ito et al. 2014 — neuropil nomenclature (`root_region` codes)
- FlyWire · MANC · Hemibrain connectomes · natverse · Virtual Fly Brain

---

<div align="center">

**A fly's whole nervous system, in your browser.**

⭐ Star if this made you think about brains a little differently.

</div>
