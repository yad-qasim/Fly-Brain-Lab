# Third-Party Resources

| Resource | URL | Author | License | What We Use |
|----------|-----|--------|---------|-------------|
| FlyWire Connectome (FAFB v783) | https://flywire.ai / https://codex.flywire.ai | FlyWire Consortium (Dorkenwald et al.) | Public release, CC-BY | Neuron IDs, cell types, connectivity data, neurotransmitter predictions |
| FlyWire Connectivity Data (Zenodo) | https://zenodo.org/records/10676866 | FlyWire Consortium | Open data | Proofread connections, synapse data |
| Shiu et al. LIF Brain Model | https://github.com/philshiu/Drosophila_brain_model | Philip K. Shiu et al. | Open source | LIF model parameters (W_syn, membrane dynamics), simulation methodology |
| snedea/flybrain | https://github.com/snedea/flybrain | Denis Shiryaev (snedea) | MIT License | Reference for browser-based LIF simulation architecture, Web Worker patterns |
| eonsystemspbc/fly-brain | https://github.com/eonsystemspbc/fly-brain | eonsystemspbc | GNU GPL v2.0 | Reference for multi-backend LIF simulation, data format patterns |
| FlyGym (NeuroMechFly v2) | https://github.com/NeLy-EPFL/flygym | NeLy-EPFL (Wang-Chen et al.) | Apache License 2.0 | Reference for fly embodiment, sensorimotor interface design |
| Three.js | https://threejs.org | Mr.doob & contributors | MIT License | 3D rendering, WebGL visualization |
| Vite | https://vitejs.dev | Evan You & contributors | MIT License | Build tooling, dev server |
| TypeScript | https://www.typescriptlang.org | Microsoft | Apache License 2.0 | Type-safe JavaScript |
| Mushroom Body Connectome | https://elifesciences.org/articles/26975 | Takemura et al. (2017) | Open access | MB circuit architecture, KC-MBON-DAN connectivity |
| Drosophila Visual System Connectome | https://www.nature.com/articles/s41586-024-07981-1 | Matsliah et al. (2024) | Open access | Visual pathway cell types, connectivity rules |
| Descending/Ascending Neuron Atlas | https://www.nature.com/articles/s41586-025-08925-z | Comparative connectomics study | Open access | DN/AN classification, motor pathway architecture |

## Notes on Usage

- **FlyWire data**: We download publicly available connectivity and cell type data from Codex. The data is used to construct a reduced neural model. We do not redistribute the raw data.
- **Shiu et al. model**: We adopt the LIF model parameters and methodology but implement our own simulation engine in TypeScript.
- **snedea/flybrain**: We reference the architecture for browser-based neural simulation but do not copy code. Our implementation is independent.
- **Three.js, Vite, TypeScript**: Standard open-source development tools used via npm packages.
- **No copyrighted assets**: All 3D models (fly, flag, environment) are created procedurally. No external 3D assets are used.
