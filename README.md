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

## 🧪 Scientific Methodology

### 3.1 Source data & materialization

The pipeline consumes the **BANC v888 materialization** (snapshot date
2026-04-17) — the fixed, DOI-citable release accompanying the *Nature*
publication — directly from the consortium's public GCS bucket:

- `banc_888_meta.feather` — 188,508 CNS cell rows × 81 annotation columns
  (soma positions, `root_region` neuropil, `side`, `super_class`,
  `cell_class`, `cell_type`, hemilineage, NT predictions, connectivity counts)
- `banc_888_edgelist_simple_v3.feather` — 13,620,865 neuron-level
  connections (≥10-voxel synapse threshold; the project's recommended
  table for new analyses — the paper itself used v2, ≥5 voxels)
- `banc_888_metrics.feather` — per-cell morphometrics (L2 cable length,
  axonal/dendritic length, in/out degree, branchpoints, segregation index)
- `banc_banc_space_split_swc/*.swc` — proofread skeleton morphologies,
  fetched lazily per cell
- `behavior/BANC_fly_behavior/` — measured locomotion of the BANC specimen
  (BANCr Y-maze tracking)

All exported artifacts are **lossless with respect to the loaded scope**:
every meta row and every cell-type pair is preserved.

### 3.2 Coordinate frame

Soma centroids (`root_position_nm`, nm) are centered on the per-axis
bounding-box midpoint and scaled by half the largest extent
(`scale = 537,312 nm`). The display convention was validated against the
independent `side` annotation: anatomical **left = +x**, **right = −x**;
axis1 (brain→VNC) is negated so the brain is dorsal in the view; +z is
dorsal (verified: MB calyx +z, gnathal neuropils −z).

### 3.3 Neuropil delineation

Each rendered region is the bounding geometry of the real soma point cloud
of one annotated neuropil (`root_region`, Ito et al. 2014 nomenclature),
split by `side`:

```
center = ⟨positions⟩;   semi-axes = 2·σ per axis (≈95% envelope, floor 0.02)
```

ITO_optic_* → optic lobe · ITO_midbrain_MB*/AL*/GNG → mushroom body /
antennal lobe / gnathal · COURT_vnc_*, MANC_vnc_* → VNC neuromeres
(T1–T3, A1–A10) · the cervical connective is derived from the real gap
between the GNG and the dorsal VNC soma band.

### 3.4 Network reduction

The simulation runs on **one representative node per annotated cell type**
(11,497 types), positioned at the true centroid of that type's somata,
with hemisphere and majority-neuropil from its member cells. Glia and
non-neuronal objects (`super_class ∈ {glia, trachea, not_a_neuron}`,
~13K rows) are excluded from the neuron cloud and the network.

### 3.5 Neuron model (LIF)

```
C_m dV/dt = −(V − E_L)/τ_m + Σ_j w_j·s_j·δ(t − t_j) + I_noise + I_inj

V ≥ V_th ⇒ spike; V ← V_reset; absolute refractory τ_ref ≈ 2 ms
```

Spontaneous drive is class-specific (visual ~15, intrinsic ~20, KC ~3,
MBON ~8, DA ~3, motor ~10, sensory ~5 Hz), with slower baselines for
serotonergic/octopaminergic/tyraminergic cells — consistent with known
modulatory-neuron physiology.

### 3.6 Synaptic conductance — magnitude *and* sign from the connectome

```
w_ij  = clamp(⟨synapses per connection⟩_ij / 50, 0.01, 1)

s_j   = +1.00  acetylcholine   (excitatory nicotinic AChR)
        −1.00  GABA            (Rdl/GABA-A chloride)
        −0.90  glutamate       (GluCl — principal fast inhibition in insects)
        −1.00  histamine       (HisCl1/Ort — photoreceptor output)
        +0.15  dopamine        (modulatory; handled via DA(t) pathway)
        +0.10  serotonin       (modulatory)
        +0.15  octopamine      (modulatory)
        +0.15  tyramine        (modulatory)
        +0.40  unknown         (majority-cholinergic prior)

delay_ij = τ_syn + ‖r_i − r_j‖/v      (τ_syn = 0.5 ms; v ≈ 0.75 m/s)
```

NT identities are the **v888 8-class predictions** (Eckstein et al. 2024)
attached to the pre-synaptic cell type — predictions, not EM-confirmed
labels, and are treated as such.

### 3.7 Dopamine-gated plasticity

Only KC→MBON synapses are plastic — the canonical MB learning motif
(Aso et al. 2014; Handler et al. 2019):

```
Δw = η · DA(t) · a_KC(t) · Δt,   w ∈ [0.01, 5]
```

Reward events raise a decaying global dopamine level `DA(t)`; coincidence
of KC activity with reward strengthens the association — the same
mechanism the paper's circuit analysis describes for distributed learning.

### 3.8 Sensory encoding & motor decode

A simplified 8-sector visual field (~135° FOV per side) encodes
brightness/motion/chromatic content and injects current into the real
first-order visual pathway — lamina output neurons L1–L5, Mi1, Tm*, C2/C3,
Lawf* (the true postsynaptic targets of R1–6, whose somata lie outside the
reconstructed volume) — and real R7/R8 photoreceptor types for color.
Motor output pools real `leg_motor_neuron`, `wing_motor_neuron`,
`haltere_motor_neuron` and `descending_neuron` cell classes; turning is the
left/right asymmetry across *real* hemisphere labels. Locomotion replay
drives the fly along the recorded BANCr centroid track.

### 3.9 Validation performed

- Hemisphere sign checked against `side` column (left ↔ +x) — caught and
  fixed an inversion
- Region envelopes vs. meta counts per `root_region`
- Full dataset counts preserved end-to-end (188,508 rows; 2,819,440 pairs)
- Missing-position rows (19,193) excluded rather than fabricated
- Binary container round-trips all four pair statistics

---

## 🔬 What we got right (and what's still research)

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

## � Glossary (for newcomers)

| Term | Meaning |
|---|---|
| **Connectome** | The complete map of neurons and their synaptic connections |
| **Materialization** | A fixed, queryable snapshot of the EM segmentation + annotations (v888) |
| **Neuropil** | A named synaptic region (e.g. medulla, MB calyx); our wireframe unit |
| **Neuromere** | A segmental VNC unit (T1–T3 thoracic, A1–A10 abdominal) |
| **Soma** | Cell body — the dots you see are real soma positions |
| **root_region** | Ito-atlas neuropil code annotating each cell's dendritic home |
| **super_class / cell_class / cell_type** | Coarse→fine BANC annotation hierarchy |
| **Hemilineage** | Developmental origin class (paired with NT identity in BANC) |
| **KC / MBON / DAN** | Kenyon cell · MB output neuron · dopaminergic neuron — the MB learning trio |
| **LIF** | Leaky integrate-and-fire — the spiking-neuron model used for dynamics |
| **GluCl** | Glutamate-gated chloride channel — why fly glutamate *inhibits* |
| **NBLAST** | Morphological similarity metric used for cell typing |
| **DN / AN** | Descending / ascending neuron — brain↔cord communication tracts |

---

## �📚 References

**Primary data**
1. **Bates, A.S., Phelps, J.S., Kim, S.M., Yang, H.H., et al.** (2026). Distributed control circuits across a brain-and-cord connectome. *Nature*. [doi:10.1038/s41586-026-10735-w](https://doi.org/10.1038/s41586-026-10735-w)
2. **BANC v888 materialization** (2026-04-17). Harvard Dataverse. [doi:10.7910/DVN/7WTH1N](https://doi.org/10.7910/DVN/7WTH1N)
3. BANC public data bucket: `gs://lee-lab_brain-and-nerve-cord-fly-connectome` — [banc.community](https://banc.community) · [ng.banc.community/view](https://ng.banc.community/view)

**Methodology & annotations**
4. **Ito, K., et al.** (2014). A systematic nomenclature for the insect brain. *Neuron* 81:755–765. [doi:10.1016/j.neuron.2013.12.017](https://doi.org/10.1016/j.neuron.2013.12.017) — the `root_region` neuropil codes (ITO_*)
5. **Eckstein, N., et al.** (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in *Drosophila melanogaster*. *Cell* 187. [doi:10.1016/j.cell.2024.03.016](https://doi.org/10.1016/j.cell.2024.03.016) — the 8-class NT predictions
6. **Costa, M., et al.** (2016). NBLAST: rapid, sensitive comparisons of neuronal structure and construction of neuron family databases. *Neuron* 90. [doi:10.1016/j.neuron.2016.06.012](https://doi.org/10.1016/j.neuron.2016.06.012)
7. **Bates, A.S., Manton, J.D., et al.** (2020). The natverse, a versatile toolbox for combining and analysing neuroanatomical data. *eLife* 9:e53350. [doi:10.7554/eLife.53350](https://doi.org/10.7554/eLife.53350)
8. **Gerstner, W., Kistler, W.M.** (2002). *Spiking Neuron Models.* Cambridge University Press — LIF formulation
9. **Plaza, S.M.** (2022). neuPrint: analysis software for connectomics. *Nature Methods* 19. [doi:10.1038/s41592-021-01394-y](https://doi.org/10.1038/s41592-021-01394-y)

**Connectomes & atlases**
10. **Dorkenwald, S., et al.** (2024). Neuronal wiring diagram of an adult brain (FlyWire). *Nature* 634. [doi:10.1038/s41586-024-05810-y](https://doi.org/10.1038/s41586-024-05810-y)
11. **Marin, E.C., et al.** (2024). Systematic annotation of a complete adult male Drosophila nerve cord connectome (MANC). *Nature* 634. [doi:10.1038/s41586-024-07266-x](https://doi.org/10.1038/s41586-024-07266-x)
12. **Scheffer, L.K., et al.** (2020). A connectome and analysis of the adult Drosophila central brain (hemibrain). *eLife* 9:e57443. [doi:10.7554/eLife.57443](https://doi.org/10.7554/eLife.57443)
13. **Court, R., et al.** (2020). Virtual Fly Brain atlas of the ventral nerve cord — the COURT_vnc_* region codes. [virtualflybrain.org](https://virtualflybrain.org)
14. **Milyaev, N., et al.** (2012). The Virtual Fly Brain browser and query interface. *Bioinformatics* 28. [doi:10.1093/bioinformatics/bts677](https://doi.org/10.1093/bioinformatics/bts677)

**Mushroom-body learning circuit**
15. **Aso, Y., et al.** (2014). The neuronal architecture of the mushroom body provides a logic for associative learning. *eLife* 3:e04577. [doi:10.7554/eLife.04577](https://doi.org/10.7554/eLife.04577)
16. **Handler, A., et al.** (2019). Distinct dopamine receptor pathways underlie the temporal sensitivity of associative learning. *Cell* 179. [doi:10.1016/j.cell.2019.10.024](https://doi.org/10.1016/j.cell.2019.10.024)

---

<div align="center">

**A fly's whole nervous system, in your browser.**

⭐ Star if this made you think about brains a little differently.

</div>
