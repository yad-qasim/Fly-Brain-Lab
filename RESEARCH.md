# Research: Drosophila Connectome & Simulation Resources

## 0. BANC — Brain And Nerve Cord Connectome (RECOMMENDED PRIMARY SOURCE)

### Primary Source
- **Name**: BANC (Brain And Nerve Cord) Connectome (CAVE materialization v888)
- **URL**: https://codex.flywire.ai/banc / https://banc.community
- **Paper**: Bates, Phelps, Kim, Yang et al. (2026). "Distributed control circuits across a brain-and-cord connectome." *Nature*. doi:10.1038/s41586-026-10735-w
- **Preprint**: https://www.biorxiv.org/content/10.1101/2025.07.31.667571v3
- **License**: Open access, public data
- **Contents**: ~188,000 neurons, ~199 million synapses (v3), ~13.5 million neuron-neuron connections
- **Coverage**: Entire CNS — brain + suboesophageal zone + cervical connective + complete ventral nerve cord
- **Sex**: Adult female *Drosophila melanogaster*
- **Resolution**: 4×4×45 nm serial-section TEM (GridTape)
- **Format**: Parquet tables, CAVE annotation tables, Codex CSV exports
- **Data Products**:
  - `banc_888_synapses_v2_enriched.parquet` (~9.6 GB) — 169M synapses with NT, neuropil, region
  - `banc_888_synapses_v3_enriched.parquet` (~5.6 GB) — 199M synapses (updated detector)
  - `banc_888_edgelist_v2.parquet` — 11.5M neuron-neuron connections (size ≥ 5)
  - `banc_888_edgelist_v3.parquet` — 13.5M connections (size ≥ 10)
  - Per-neuron metadata: cell type, neurotransmitter, hemilineage, body part, behavioral function
  - All-to-all influence matrix (24 billion pairwise scores)
  - NBLAST cross-dataset similarity (BANC ↔ FAFB, FANC, MANC, HemiBrain, maleCNS)
  - Neuron meshes, SWC skeletons, colorMIP images

### Neurotransmitter Classifier (synister_banc)
- **8 classes**: GABA, acetylcholine, glutamate, serotonin, octopamine, dopamine, histamine, **tyramine**
- **Paper**: Eckstein, Bates et al. (2024). *Cell*. doi:10.1016/j.cell.2024.03.016
- **Code**: https://github.com/htem/synister_banc
- **Zenodo**: doi:10.5281/zenodo.20350570
- **Accuracy**: ~91% (FAFB), ~91% (HemiBrain) on test set

### Key Scientific Findings (Bates et al. 2026)
1. **Distributed control architecture**: Effector neurons (motor, endocrine, visceral) are primarily influenced by local sensory neurons from the same body part, forming tight feedback loops
2. **Long-range coordination**: Ascending/descending neurons (ANs/DNs) link local loops into behavior-centric modules (flight, walking, grooming, feeding, reproduction, etc.)
3. **Supervisory brain regions**: Mushroom body and central complex act as supervisors of motor clusters, not as a single central controller
4. **Influence metric**: Linear dynamical systems model for quantifying indirect functional connections; precomputed for all 24B neuron pairs
5. **Embodied architecture**: Connectome is tightly coupled to body effectors — distributed, parallelized, embodied

### Why BANC is Superior to FlyWire for Our Simulation
1. **Includes VNC**: Our simulation already models motor neurons in the ventral nerve cord. FlyWire doesn't cover the VNC; BANC unifies brain + VNC + neck.
2. **3.6× more synapses**: 199M vs 54.5M — far more realistic connectivity density.
3. **8-class NT classifier**: Adds tyramine (7th modulatory transmitter missing from FlyWire's 7-class).
4. **Influence metric**: Precomputed functional connectivity — can weight our simulation edges by real influence scores.
5. **Distributed control analysis**: Directly validates our sensorimotor loop architecture (local loops + supervisory MB/CX).
6. **Newer**: 2026 publication, builds on and supersedes FlyWire's foundation.
7. **Same ecosystem**: Accessible via same Codex API (codex.flywire.ai/banc), same CAVE backend.

### Access
- **Interactive**: https://codex.flywire.ai/banc (neuron browser, connectivity download)
- **Programmatic**: CAVE API (datastack: `brain_and_nerve_cord_public`)
- **Bulk data**: gs://lee-lab_brain-and-nerve-cord-fly-connectome/
- **Harvard Dataverse**: https://doi.org/10.7910/DVN/7WTH1N
- **EM images**: BossDB https://bossdb.org/project/bates_phelps_kim_yang2025
- **Cross-dataset viewer**: https://ng.banc.community/view

---

## 1. FlyWire Whole-Brain Connectome (PREDECESSOR TO BANC)

### Primary Source
- **Name**: FlyWire Whole-Brain Connectome (FAFB v783)
- **URL**: https://flywire.ai / https://codex.flywire.ai
- **Paper**: Dorkenwald et al. (2024). "Neuronal wiring diagram of an adult brain." *Nature*, 634, 124-138.
- **Companion Paper**: Schlegel et al. (2024). "Whole-brain annotation and multi-connectome cell typing of Drosophila." *Nature*, 634, 139-152.
- **License**: Public release, open data (CC-BY for derived data products)
- **Contents**: 139,255 neurons, 54.5 million synapses, complete adult female *Drosophila melanogaster* brain
- **Format**: Feather files (pandas DataFrames), CSV via Codex API
- **Data Products**:
  - `flywire_synapses_783.feather` (9.5 GB) - All ~130M synapses with locations, neurotransmitter predictions
  - `proofread_connections_783.feather` (852 MB) - Proofread neuron-neuron connections summarized
  - `proofread_root_ids_783.npy` (1.1 MB) - Array of proofread neuron IDs
  - `per_neuron_neuropil_count_pre/post_783.feather` - Synapse counts per neuropil
  - Codex CSV downloads: `connections_princeton`, `consolidated_cell_types`
- **Usability**: Fully usable. Data is publicly downloadable from Zenodo and Codex API.
- **Biological Data**: YES - actual neuron identities, actual synaptic connectivity, actual neurotransmitter predictions

### Codex API Access
- **URL**: https://codex.flywire.ai/api/download?dataset=fafb
- **Pattern**: Fetch gzipped CSV via `https://codex.flywire.ai/api/download_resource?data_product=...&dataset=fafb`
- **Key data products**: `connections_princeton` (neuron-neuron connections), `consolidated_cell_types` (cell type annotations)
- **Note**: Requires Google account login for interactive use; static downloads available programmatically

### Zenodo Mirror
- **URL**: https://zenodo.org/records/10676866
- **Version**: 783.0 (latest)
- **Total size**: 10.6 GB

---

## 2. Shiu et al. LIF Brain Model

### Primary Source
- **Name**: Drosophila Brain Model (LIF computational model)
- **URL**: https://github.com/philshiu/Drosophila_brain_model
- **Paper**: Shiu et al. (2024). "A Drosophila computational brain model reveals sensorimotor processing." *Nature*, 634, 153-161.
- **Preprint**: https://www.biorxiv.org/content/10.1101/2023.05.02.539144v1
- **License**: Open source (repository)
- **Contents**: Leaky integrate-and-fire model of entire Drosophila central brain
- **Key Parameters**:
  - W_syn = 0.275 mV (single free parameter - synaptic weight)
  - Based on FlyWire connectome v630 (later updated to v783)
  - Uses neurotransmitter predictions for excitatory/inhibitory classification
  - Implemented in Brian2 spiking neural network simulator
- **Biological Data**: YES - uses actual FlyWire connectivity and neurotransmitter predictions
- **Usability**: Reproducible. Code available on GitHub. Requires Brian2 + Python.

### Key Findings
- Activation of sugar-sensing gustatory neurons accurately predicts taste-responsive neurons
- Computational activation of feeding region neurons predicts motor neuron firing
- Model accurately describes complete sensorimotor transformations from connectivity alone
- Single parameter (W_syn) fits all simulations

---

## 3. eonsystemspbc/fly-brain (Multi-Backend LIF)

- **URL**: https://github.com/eonsystemspbc/fly-brain
- **License**: GNU General Public License v2.0
- **Contents**: Multi-backend LIF simulation of FlyWire connectome v783 (~138K neurons, ~5M synapses)
- **Backends**: Brian2 (CPU), Brian2CUDA (GPU), PyTorch (GPU), NEST GPU, GeNN (GPU)
- **Usability**: Requires CUDA GPU for GPU backends; Brian2 CPU works on standard hardware
- **Biological Data**: YES - uses actual FlyWire v783 connectome

---

## 4. snedea/flybrain (Browser Simulation)

- **URL**: https://github.com/snedea/flybrain
- **License**: MIT License
- **Contents**: Interactive browser simulation of 139,255 neurons from FlyWire FAFB v783
- **Tech**: Web Workers for LIF simulation, WebGL for visualization
- **Key Innovation**: Runs full 139K neuron simulation in browser using Web Workers
- **Data**: Binary connectome file derived from FlyWire Codex (FAFB v783)
- **Neuron Classification**: Sensory, Central, Drives, Motor (based on FlyWire cell type annotations)
- **Usability**: Excellent reference for browser-based connectome simulation
- **Biological Data**: YES - actual FlyWire connectome data

---

## 5. Mushroom Body Circuit (Learning & Reward)

### Key Papers
- **Aso et al. (2014)**: "Mushroom body output neurons encode valence and guide memory-based action selection in Drosophila." *eLife*, 3:e04580
- **Takemura et al. (2017)**: "A connectome of a learning and memory center in the adult Drosophila brain." *eLife*, 6:e26975
- **Eichler et al. (2017)**: "The complete connectome of a learning and memory centre in an insect brain." *Nature*, 548, 175-182

### Circuit Architecture
- **Kenyon Cells (KCs)**: ~2000 per hemisphere, sparse coding of sensory information
- **MB Output Neurons (MBONs)**: 21 types, encode valence, guide action selection
- **Dopaminergic Neurons (DANs)**: 20 types, reinforce memories
  - PAM cluster: reward signaling (appetitive memory)
  - PPL1 cluster: aversive reinforcement
- **Compartmental Organization**: 16 compartments, each with KCs → MBONs modulated by DANs
- **Plasticity**: DAN input modifies KC>MBON synaptic efficacy for active KCs
- **Feedback**: MBONs provide recurrent feedback to DANs (prediction error computation)

### Key Circuit Elements
```
Sensory Input → Projection Neurons → Kenyon Cells (sparse) → MBONs → Descending Neurons
                                          ↑
                                     DANs (dopamine)
                                          ↑
                              Reward/Punishment Signal
```

---

## 6. Dopamine Neurons in Drosophila

### Key Papers
- **Liu et al. (2012)**: "A subset of dopamine neurons signals reward for odour memory in Drosophila." *Nature*, 488, 512-516
- **Burke et al. (2012)**: "Layered reward signalling through octopamine and dopamine in Drosophila." *Nature*, 492, 433-437
- **Yamagata et al. (2014)**: "Distinct dopamine neurons mediate reward signals for short- and long-term memories." *PNAS*, 112, 578-583
- **Ichinose et al. (2015)**: "Reward signal in a recurrent circuit drives appetitive long-term memory formation." *eLife*, 4:e10719

### DAN Subtypes
- **PAM-γ5**: Reward teaching signals (sugar memory)
- **PAM-β'2a**: Reward for short-term memory
- **PPL1-γ1pedc**: Aversive reinforcement
- **PPL1-α'3**: Aversive memory formation
- Each DAN type innervates specific MB compartments

---

## 7. Visual System Connectome

### Key Papers
- **Matsliah et al. (2024)**: "Connectome-driven neural inventory of a complete visual system." *Nature*
- **Konstantinides et al. (2024)**: "Neuronal parts list and wiring diagram for a visual system." *Nature*

### Visual Pathway
```
Photoreceptors (R1-R8) → Lamina (L1-L5) → Medulla (Mi, Tm, TmY) → Lobula/Lobula Plate (T4, T5)
     ↓                                                                              ↓
  Motion Vision                                                           Visual Projection Neurons (VPNs)
  Object Vision                                                                    ↓
  Color Vision                                                           Central Brain → Descending Neurons
```

### Key Cell Types
- **Photoreceptors**: R1-R6 (motion), R7/R8 (color/object)
- **Lamina**: L1 (ON pathway), L2 (OFF pathway), L3 (contrast)
- **Medulla**: Mi1, Mi4, Mi9, Tm1, Tm2, Tm3, Tm4, Tm9 (motion processing)
- **Lobula Plate**: T4 (ON-direction selective), T5 (OFF-direction selective)
- **VPNs**: ~4,500 neurons of 352 cell types project to central brain
- **LPTs**: Lobula plate tangential neurons (wide-field motion)

---

## 8. Descending Neurons & Motor System

### Key Paper
- **Comparative connectomics of Drosophila descending and ascending neurons** (2025). *Nature*.

### Key Numbers
- ~1,315-1,347 descending neurons (DNs) transmit motor commands from brain to VNC
- ~1,733-1,865 ascending neurons (ANs) convey sensory/motor state from VNC to brain
- DNs receive input from: brain interneurons (preprocessed sensory), ANs, other DNs
- DN-DN interconnectivity: 42% of DN output in brain (coordinated action)

---

## 9. FlyGym (NeuroMechFly v2)

- **URL**: https://github.com/NeLy-EPFL/flygym
- **License**: Apache License 2.0
- **Paper**: Wang-Chen et al. (2024). "NeuroMechFly v2: simulating embodied sensorimotor control in adult Drosophila." *Nature Methods*, 21(12), 2353-2362
- **Contents**: MuJoCo-based biomechanical fly simulation with vision, olfaction, walking
- **Biomechanical Model**: Based on micro-CT scan of real adult female fly
- **Hierarchical Control**: Brain (sensory integration) + VNC (motor control) architecture
- **Usability**: Python library, requires MuJoCo. Well-documented.
- **Relevance**: Reference for fly embodiment and sensorimotor interface design

---

## 10. Technology Assessment

### Neural Simulation in Browser
- **snedea/flybrain** proves 139K LIF neurons can run in browser via Web Workers
- **Key technique**: Binary data format, typed arrays, Web Worker offloading
- **Performance**: Real-time with WebGL visualization

### 3D Visualization
- **Three.js**: Mature WebGL library, excellent for neural visualization
- **React Three Fiber**: React wrapper for Three.js (if using React)
- **Performance considerations**: Instanced meshes for neurons, line segments for synapses, LOD for large networks

### Architecture Decision
- **Frontend**: Vite + TypeScript + Three.js (no React for simplicity)
- **Neural Simulation**: Web Worker with LIF model, typed arrays
- **Connectome Data**: Preprocessed from FlyWire into compact binary/JSON format
- **Physics**: Custom lightweight physics (no heavy physics engine needed)
- **No backend required**: All computation in browser

---

## 11. Data Pipeline Design

### Step 1: Download (Python script)
- Fetch `connections_princeton` and `consolidated_cell_types` from Codex API
- Alternatively download from Zenodo (feather format)

### Step 2: Filter & Reduce
- Filter to proofread neurons
- Group by cell type and brain region
- Extract key pathways: visual → MB → motor
- Create population-level model (few hundred representative neurons)

### Step 3: Export
- Save as compact JSON with neuron metadata, connectivity matrix, neurotransmitter info
- Include actual FlyWire root IDs and cell type names for traceability

---

## 12. Scientific Limitations Summary

1. **Connectome ≠ Brain**: A connectome is a wiring diagram, not a complete specification of neural dynamics
2. **Missing dynamics**: Synaptic wiring alone does not specify membrane properties, ion channels, receptor dynamics
3. **Neurotransmitter predictions**: FlyWire neurotransmitter identities are computationally predicted, not experimentally verified for all neurons
4. **Single specimen**: The connectome is from one female fly; individual variation exists
5. **No gap junctions**: Chemical synapses only; electrical synapses not included
6. **Reduced model**: Our simulation uses a reduced representation, not all 139K neurons
7. **LIF approximation**: Leaky integrate-and-fire is a simplification of real neuron dynamics
8. **Artificial reward**: Our dopamine signal is an experimental abstraction, not biological dopamine
9. **Simplified embodiment**: Our 3D fly is a computational approximation, not a biomechanical model
10. **No consciousness**: Learned behavior in this simulation should not be interpreted as evidence of consciousness or genuine biological understanding

---

## 13. FlyWire v783 Network Statistics

### Global Statistics (Gallego et al. 2024)
- **Total neurons**: 139,255 (proofread)
- **Total synapses**: 54,500,000
- **Total connections** (≥5 synapse threshold): 3,732,460
- **Cell types**: 8,453 (Schlegel et al. 2024)
- **Average in/out-degree**: 20.5 connections per neuron
- **Average synapses per connection**: 12.6
- **Connection probability**: 1.61 × 10⁻⁴ (very sparse)
- **Synapse threshold for analysis**: 5 synapses per connection

### Neuron Superclass Distribution (Schlegel et al. 2024)
- **Sensory** (afferent): periphery → brain
- **Motor** (efferent): brain → periphery
- **Endocrine**: brain → corpora allata/cardiaca
- **Ascending**: VNC → brain
- **Descending**: brain → VNC
- **Visual projection**: optic lobes → central brain
- **Visual centrifugal**: central brain → optic lobes
- **Intrinsic optic**: intrinsic to optic lobes
- **Intrinsic central**: intrinsic to central brain

### Neurotransmitter Distribution (Eckstein et al. 2024, FAFB-783)

| Neurotransmitter | Neurons | % of typed | Synapses | Role |
|---|---|---|---|---|
| Acetylcholine (ACh) | 51,559 | 52.4% | 27,888,474 | Excitatory |
| GABA | 8,962 | 16.2% | 7,872,711 | Inhibitory |
| Glutamate | 11,408 | 16.8% | 7,095,890 | Mixed (mostly inhibitory in CNS) |
| Histamine | 12,120 | 12.3% | 1,103,457 | Photoreceptor transmitter |
| Dopamine | 1,411 | 1.9% | 695,904 | Modulatory (reward/learning) |
| Serotonin (5-HT) | 102 | 0.1% | 320,187 | Modulatory |
| Octopamine | 62 | 0.06% | 295,673 | Modulatory (arousal) |

### Key Circuit Properties
- **GABAergic hub neurons**: All top-20 highest-degree hub neurons are GABAergic (6.2× enrichment, p < 10⁻⁹)
- **Small-world topology**: 125× higher clustering than degree-matched random graphs
- **Reciprocal connections**: ~20% of directed connections are bidirectional
- **Rich-club organization**: Highly connected neurons form a backbone for global integration
- **Dale's law**: Each neuron expresses one fast-acting small molecule transmitter (ACh, GABA, or glutamate)
- **Lacin's law**: One transmitter per hemilineage (developmental unit)

### Mushroom Body Statistics
- **Kenyon cells**: ~1,335 per hemilineage (MBp4), ~2,000 per hemisphere
- **MBONs**: 21 types encoding valence
- **DANs**: 20 types (PAM = reward, PPL1 = aversive)
- **Compartments**: 16 MB compartments, each with KC→MBON modulated by DAN
- **Homeostasis**: Excitation/inhibition ratio maintained despite variation in absolute input

---

## 14. References

1. Bates, A.S. et al. (2026). Distributed control circuits across a brain-and-cord connectome. *Nature*. doi:10.1038/s41586-026-10735-w
2. Dorkenwald, S. et al. (2024). Neuronal wiring diagram of an adult brain. *Nature*, 634, 124-138. doi:10.1038/s41586-024-07558-y
3. Schlegel, P. et al. (2024). Whole-brain annotation and multi-connectome cell typing of Drosophila. *Nature*, 634, 139-152. doi:10.1038/s41586-024-07686-5
4. Matsliah, A. et al. (2024). Neuronal parts list and wiring diagram for a visual system. *Nature*. doi:10.1038/s41586-024-07981-1
5. Eckstein, N. et al. (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in Drosophila. *Cell*. doi:10.1016/j.cell.2024.03.016
6. Gallego, J.A. et al. (2024). Network statistics of the whole-brain connectome of Drosophila. *Nature*. doi:10.1038/s41586-024-07968-y
7. Shiu, P.K. et al. (2024). A Drosophila computational brain model reveals sensorimotor processing. *Nature*, 634, 153-161.
8. Aso, Y. et al. (2014). Mushroom body output neurons encode valence and guide memory-based action selection. *eLife*, 3:e04580.
9. Takemura, S. et al. (2017). A connectome of a learning and memory center in the adult Drosophila brain. *eLife*, 6:e26975.
10. Buhmann, A. et al. (2021). Automatic detection of synaptic contacts in serial section electron microscopy. *Nature Methods*.
11. Zheng, Z. et al. (2018). A complete electron microscopy volume of the brain of adult Drosophila melanogaster. *Cell*, 174, 730-743.
