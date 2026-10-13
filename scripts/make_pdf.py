"""
Generate RESEARCH.pdf — long-form documentation for the Fly Brain Lab /
BANC v888 connectome explorer.

    python scripts/make_pdf.py

Requires: pip install fpdf2
"""

from fpdf import FPDF


class Doc(FPDF):
    def __init__(self):
        super().__init__(format="A4")
        self.set_auto_page_break(True, margin=18)
        self.set_margins(18, 18, 18)

    # ---------- primitives ----------
    def _txt(self, s: str) -> str:
        # core fonts are latin-1; translate common unicode
        table = {
            "→": "->", "←": "<-", "↔": "<->", "≈": "~", "σ": "sigma",
            "µ": "u", "×": "x", "−": "-", "—": "-", "–": "-",
            "≥": ">=", "≤": "<=", "·": "-", "±": "+/-", "τ": "tau",
            "α": "alpha", "Δ": "Delta", "η": "eta", "δ": "delta",
            "°": " deg", "“": '"', "”": '"', "’": "'", "‘": "'",
            "…": "...", "⇄": "<->", "⧉": "[+] ",
        }
        for k, v in table.items():
            s = s.replace(k, v)
        return s.encode("latin-1", "replace").decode("latin-1")

    def h1(self, text: str):
        self.set_font("helvetica", "B", 15)
        self.set_text_color(20, 40, 80)
        self.cell(0, 10, self._txt(text), new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(42, 140, 255)
        self.set_line_width(0.6)
        y = self.get_y()
        self.line(self.l_margin, y, self.w - self.r_margin, y)
        self.ln(4)
        self.set_text_color(30, 30, 30)

    def h2(self, text: str):
        self.ln(2)
        self.set_font("helvetica", "B", 12)
        self.set_text_color(42, 100, 180)
        self.cell(0, 8, self._txt(text), new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(30, 30, 30)

    def p(self, text: str, size: float = 10):
        self.set_font("helvetica", "", size)
        self.multi_cell(0, 5, self._txt(text), new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def li(self, text: str):
        self.set_font("helvetica", "", 10)
        self.multi_cell(0, 5, self._txt("  *  " + text), new_x="LMARGIN", new_y="NEXT")

    def mono(self, text: str):
        self.set_font("courier", "", 8.5)
        self.set_fill_color(240, 244, 248)
        self.multi_cell(0, 4.4, self._txt(text), fill=True, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def table(self, headers, rows, widths=None):
        n = len(headers)
        if widths is None:
            widths = [((self.w - self.l_margin - self.r_margin) / n)] * n
        self.set_font("helvetica", "B", 8.5)
        self.set_fill_color(226, 235, 245)
        for h, w in zip(headers, widths):
            self.cell(w, 6, self._txt(h), border=1, fill=True)
        self.ln()
        self.set_font("helvetica", "", 8.5)
        for row in rows:
            for c, w in zip(row, widths):
                self.cell(w, 6, self._txt(str(c)), border=1)
            self.ln()
        self.ln(3)


def build():
    doc = Doc()

    # default multi_cell to LMARGIN/NEXT so calls can stay terse
    _orig_mc = doc.multi_cell
    def _mc(*a, **k):
        k.setdefault("new_x", "LMARGIN")
        k.setdefault("new_y", "NEXT")
        return _orig_mc(*a, **k)
    doc.multi_cell = _mc

    # ---------- Cover ----------
    doc.add_page()
    doc.ln(48)
    doc.set_font("helvetica", "B", 26)
    doc.set_text_color(20, 40, 80)
    doc.multi_cell(0, 12, "Fly Brain Lab", new_x="LMARGIN", new_y="NEXT")
    doc.set_font("helvetica", "", 14)
    doc.set_text_color(60, 80, 110)
    doc.multi_cell(
        0, 8,
        "Interactive exploration of the complete adult Drosophila "
        "melanogaster central nervous system on the BANC v888 connectome",
    )
    doc.ln(10)
    doc.set_font("helvetica", "", 10)
    doc.set_text_color(80, 80, 80)
    doc.multi_cell(
        0, 5.4,
        "Every neuron is real. 188,508 cells at their true soma positions, "
        "2,819,440 cell-type pairs of real connectivity, real neuropil "
        "boundaries, real morphology, real measured locomotion - "
        "with a leaky integrate-and-fire simulation layered on the real wiring.",
    )
    doc.ln(14)
    doc.set_font("helvetica", "B", 10)
    doc.multi_cell(
        0, 6,
        "Bates, Phelps, Kim, Yang, et al. (2026). Distributed control circuits "
        "across a brain-and-cord connectome. Nature. DOI: 10.1038/s41586-026-10735-w",
    )
    doc.set_font("helvetica", "", 9)
    doc.multi_cell(
        0, 5,
        "Data snapshot: Harvard Dataverse doi:10.7910/DVN/7WTH1N - "
        "portal: banc.community - viewer: ng.banc.community/view",
    )
    doc.ln(30)
    doc.set_font("helvetica", "I", 9)
    doc.set_text_color(120, 120, 120)
    doc.multi_cell(
        0, 5,
        "This document and the software are a research/education tool. "
        "Sections marked MODEL describe approximations - see 'What is real "
        "vs modeled' before citing dynamics as biology.",
    )

    # ---------- 1. Abstract ----------
    doc.add_page()
    doc.h1("1. Abstract & Purpose")
    doc.p(
        "Fly Brain Lab is a locally runnable / statically hostable scientific "
        "visualization of the BANC (Brain And Nerve Cord) connectome - the "
        "first synapse-resolution reconstruction of a fruit fly's complete "
        "central nervous system: brain, suboesophageal/gnathal region, "
        "cervical connective and ventral nerve cord (VNC). The application "
        "shows the full ~188,508-cell dataset as a navigable 3D point cloud "
        "with real neuropil boundaries, a full-screen 'live brain' view that "
        "streams the active fly's neural activity between browser tabs, "
        "on-demand real neuron skeletons (SWC) fetched from the BANC public "
        "repository, and a simplified 3D world where a simulated fly's "
        "movement is decoded from real motor neuron pools - or replayed from "
        "the actual BANC specimen's recorded locomotion."
    )

    # ---------- 2. Provenance ----------
    doc.h1("2. Data Provenance")
    doc.table(
        ["Item", "Value"],
        [
            ["Dataset", "BANC - Brain And Nerve Cord connectome"],
            ["Version", "v888 materialization (snapshot 2026-04-17), the paper snapshot"],
            ["CNS cells", "188,508 rows in banc_888_meta.feather"],
            ["Neuron-level connections", "13,620,865 (edgelist_simple_v3)"],
            ["Cell-type pairs loaded", "2,819,440 - ALL pairs, lossless"],
            ["Cell types", "11,497"],
            ["Predicted synapses", "~199M (v3 table, >=10-voxel threshold)"],
            ["NT classes", "8-class predictions + unknown"],
            ["Species / stage", "D. melanogaster adult female, whole CNS"],
        ],
        widths=[55, 120],
    )
    doc.h2("Version notes (for citation)")
    doc.li("v626 = preprint snapshot - superseded by v888.")
    doc.li("v888 = reproducible, DOI-citable release used here.")
    doc.li("FlyWire Codex hosts a live/evolving version - do not confuse it with this fixed snapshot.")
    doc.li("Paper analysis used synapse table v2 (>=5 voxels). This project uses v3 (>=10 voxels),")
    doc.li("   the project's recommended default for new analyses. Both remain in the source bucket.")
    doc.h2("Links")
    for s in [
        "Paper (Nature): doi.org/10.1038/s41586-026-10735-w",
        "Data snapshot (Harvard Dataverse): doi.org/10.7910/DVN/7WTH1N",
        "Project portal: banc.community",
        "Neuroglancer viewer: ng.banc.community/view",
        "Live codex: codex.flywire.ai",
        "Source bucket: gs://lee-lab_brain-and-nerve-cord-fly-connectome",
    ]:
        doc.li(s)

    # ---------- 3. Architecture ----------
    doc.add_page()
    doc.h1("3. Architecture")
    doc.p(
        "Static web app: Vite + TypeScript + Three.js. Python pipeline exports "
        "the public BANC data into compact browser-served artifacts. No backend."
    )
    doc.mono(
        "index.html      main app - 3D world (fly + flag) + CNS panel\n"
        "brain.html      full-screen CNS viewer tab (live-synced via BroadcastChannel)\n"
        "src/main.ts     app init, UI, live-activity broadcaster\n"
        "src/brain_view.ts  standalone brain tab - sync, skeletons, metrics, info\n"
        "src/banc_loader.ts BANC JSON/binary loading, NT + region maps\n"
        "src/connectome.ts  cell-type connectome construction\n"
        "src/brain_data.ts  188K neuron cloud + region geometry\n"
        "src/neural_viz.ts  Three.js instanced rendering, filters, SWC\n"
        "src/neural.ts      LIF network + dopamine-gated plasticity\n"
        "src/sensory.ts     visual-field encoding -> real lamina inputs\n"
        "src/motor.ts       real motor/DN activity -> movement decode\n"
        "src/experiment.ts  experiment loop + real trajectory replay\n"
        "src/world.ts       3D world, fly model, flag, movement trail\n"
        "src/reward.ts      reward/dopamine system\n"
        "src/config.ts      constants\n"
        "public/data/   exported research data (neurons/types/pairs/regions/metrics/trajectory)\n"
        "scripts/       download_banc_data.py, export_realism_data.py, make_pdf.py"
    )
    doc.h2("Binary connectivity format (banc_connections.bin, 'BCN1')")
    doc.mono(
        "magic   : u8[4] = 'B','C','N','1'\n"
        "nTypes  : u32    | nPairs : u32\n"
        "types   : u16[nTypes] name lengths + utf8 names\n"
        "pairs   : nPairs x { pre u32 | post u32 | total u32 |\n"
        "                    connCount u32 | mean f32 | median f32 }"
    )
    doc.p(
        "2,819,440 pairs = 64.6 MB - streamed and decoded with typed arrays; "
        "the earlier 539 MB JSON of the same data was never usable in a browser.",
        size=9.5,
    )

    # ---------- 3b. Methodology ----------
    doc.add_page()
    doc.h1("3b. Scientific Methodology")
    doc.h2("Source data & materialization")
    doc.p(
        "Pipeline consumes the BANC v888 materialization (snapshot 2026-04-17) "
        "- the fixed, DOI-citable release of the Nature publication - from the "
        "consortium's public GCS bucket:",
        size=9.5,
    )
    doc.mono(
        "banc_888_meta.feather              188,508 cells x 81 annotation cols\n"
        "banc_888_edgelist_simple_v3        13,620,865 connections (>=10 voxels)\n"
        "banc_888_metrics.feather           per-cell morphometrics\n"
        "banc_banc_space_split_swc/*.swc    proofread skeletons (lazy fetch)\n"
        "behavior/BANC_fly_behavior/        real BANCr Y-maze locomotion"
    )
    doc.h2("Network reduction")
    doc.p(
        "One representative node per annotated cell type (11,497 types) at the "
        "true soma centroid; hemisphere & majority neuropil from member cells. "
        "Glia/trachea/non-neuron rows (~13K) excluded from neurons and network. "
        "All meta rows and all cell-type pairs are preserved losslessly in the "
        "exported artifacts.",
        size=9.5,
    )
    doc.h2("Validation performed")
    doc.li("Hemisphere sign verified vs 'side' column (left = +x) - fixed an inversion")
    doc.li("Region envelopes cross-checked vs per-root_region counts")
    doc.li("Full counts preserved end-to-end (188,508 rows; 2,819,440 pairs)")
    doc.li("19,193 missing-position rows excluded, not fabricated")
    doc.li("Binary container round-trips all four pair statistics")

    # ---------- 4. Mathematics ----------
    doc.h1("4. The Mathematics")
    doc.h2("4.1 Coordinate normalization")
    doc.mono(
        "center_i = (min_i + max_i)/2   (per axis, zero sentinels ignored)\n"
        "scale    = max(range_x, range_y, range_z)/2   = 537,312 nm\n"
        "\n"
        "display.x = (x - x_center)/scale    lateral      (+x = anatomical LEFT)\n"
        "display.y = -(y - y_center)/scale   longitudinal (brain up, VNC down)\n"
        "display.z = (z - z_center)/scale    dorsoventral (dorsal = +z)"
    )
    doc.p(
        "Verified against the real 'side' column: side=left cells sit at +x and "
        "side=right at -x (BANC axis0 is lateral and positive = left). The same "
        "norm constants are applied to fetched SWC skeletons so morphologies "
        "overlay the point cloud exactly.",
        size=9.5,
    )
    doc.h2("4.2 Neuropil geometry")
    doc.mono(
        "per region x side:  center = mean(points);  semi-axes = 2*std(points)\n"
        "VNC + cervical connective rendered as real cylinders along the longitudinal axis."
    )
    doc.h2("4.3 LIF dynamics")
    doc.mono(
        "dV/dt = (V_rest - V)/tau_decay\n"
        "      + Sum_spikes w_syn * s(nt) * delta(t - t_arr)\n"
        "      + I_noise(class, NT) + I_injected\n"
        "\n"
        "if V >= V_thresh:  spike; V -> V_reset; refractory t + tau_ref"
    )
    doc.h2("4.4 Signed synaptic effect by predicted NT")
    doc.table(
        ["NT", "Effect (fly biology)", "sign x scale"],
        [
            ["acetylcholine", "excitatory (nAChR)", "+1.0"],
            ["GABA", "inhibitory (Rdl/GABA-A)", "-1.0"],
            ["glutamate", "inhibitory (GluCl, dominant fast inhibitory channel)", "-0.9"],
            ["histamine", "inhibitory (HisCl, photoreceptor output)", "-1.0"],
            ["dopamine", "modulatory", "+0.15"],
            ["serotonin", "modulatory", "+0.10"],
            ["octopamine", "modulatory", "+0.15"],
            ["tyramine", "modulatory", "+0.15"],
            ["unknown", "most CNS cells are cholinergic", "+0.40"],
        ],
        widths=[45, 90, 40],
    )
    doc.h2("4.5 Conduction delay")
    doc.mono("delay = 0.5 ms (synaptic latency) + dist(pre,post) x 0.72 ms\n"
             "(1 unit ~ 537 um at ~0.75 m/s insect conduction)")
    doc.h2("4.6 Dopamine-gated plasticity (KC -> MBON)")
    doc.mono("Delta w = eta * DA(t) * a_KC(t) * dt      (clamped [0.01, 5])")
    doc.p(
        "Plasticity is restricted to Kenyon-cell -> MBON synapses - the "
        "canonical mushroom-body associative-learning motif - driven by a "
        "global decaying dopamine level released by reward events.",
        size=9.5,
    )
    doc.h2("4.7 Sensory -> motor decode")
    doc.mono(
        "forward = clamp((avgLeg*0.7 + avgWing*0.3)*5, 0, 1)\n"
        "turn    = clamp((avgLegR - avgLegL)*8, -1, 1)    (real hemispheres)\n"
        "reach   = clamp(avgDN*6, 0, 1)"
    )
    doc.p(
        "Inputs target real lamina output neurons (L1-L5, Mi1, Tm*, C2/C3, "
        "Lawf*) and real R7/R8 photoreceptors; motor readout pools real "
        "leg_motor_neuron / wing_motor_neuron / descending_neuron cell classes.",
        size=9.5,
    )

    # ---------- 5. Features ----------
    doc.add_page()
    doc.h1("5. What You Can Do")
    doc.li("188K-neuron instanced cloud - real positions, class colors, live activity brightness.")
    doc.li("Real neuropil wireframes - per-region bounding ellipsoids/tubes, left/right correct.")
    doc.li("Full-screen brain tab - the ACTIVE fly's live brain streamed over BroadcastChannel.")
    doc.li("Deep zoom 0.03-30x; region explanations; real neuron counts per neuropil.")
    doc.li("Click a neuron -> real BANC annotation + real morphology metrics + real SWC skeleton.")
    doc.li("Region filters (optic lobe, central brain, mushroom body, antennal lobe, SEZ, neck, VNC).")
    doc.li("Fly movement trail in the world; real BANCr Y-maze trajectory replay (toggle button).")
    doc.li("Region pulse bars, learning/dopamine/activity graphs.")

    # ---------- 6. Honesty ----------
    doc.h1("6. Real vs. Modeled (honest table)")
    doc.table(
        ["Component", "Status"],
        [
            ["Neuron positions", "REAL - BANC soma coordinates (unlocalized excluded)"],
            ["Counts / types / classes", "REAL"],
            ["Neuropil regions & sides", "REAL root_region / side annotations"],
            ["Wireframes", "REAL-DERIVED 2-sigma bounds (not EM meshes)"],
            ["Connectivity", "REAL v3 edgelist, lossless, all pairs"],
            ["Synapse signs", "REAL-INFORMED via predicted NTs"],
            ["Skeletons", "REAL per-cell SWC (subset coverage)"],
            ["Morphology metrics", "REAL (banc_888_metrics)"],
            ["Fly locomotion (replay)", "REAL measured BANCr track"],
            ["Spiking dynamics", "MODEL - LIF + injected currents"],
            ["Sensory/motor gains", "MODEL (real pools, simplified encode)"],
            ["World / flag / fly body", "INVENTED apparatus (labeled in code)"],
        ],
        widths=[60, 115],
    )

    # ---------- 7. Limitations ----------
    doc.h1("7. Under Research & Development")
    doc.li("One sim neuron per cell type - inter-type realism kept, intra-type variance collapsed;")
    doc.li("   synaptic strengths are pair-means, not per-connection counts.")
    doc.li("No dendrite-vs-axon synaptic weighting; morphology not used in coupling.")
    doc.li("Only cells with a released split-SWC render a skeleton.")
    doc.li("Wireframes bound the soma cloud - true EM neuropil surfaces are future work.")
    doc.li("NTs are predictions; a fraction differ from ground-truth staining.")
    doc.li("Delays use a single conduction velocity constant.")
    doc.li("The behavior loop is a sandbox - reasonable defaults, not fitted physiology.")

    # ---------- 8. Reproduce ----------
    doc.h1("8. Reproduce / Regenerate")
    doc.mono(
        "npm install            # three, vite, typescript\n"
        "npm run dev            # localhost:3000  (brain tab /brain.html)\n"
        "\n"
        "pip install pandas pyarrow numpy\n"
        "python scripts/download_banc_data.py     # ~415 MB cached to data/raw/\n"
        "python scripts/export_realism_data.py    # norm + metrics + trajectory\n"
        "python scripts/make_pdf.py               # this document\n"
        "\n"
        "Deploy: vercel (Vite preset auto-detected; output dist/).\n"
        "public/data (~135 MB) is copied into dist and served statically."
    )

    # ---------- 8b. Glossary ----------
    doc.h1("8b. Glossary")
    doc.table(
        ["Term", "Meaning"],
        [
            ["Connectome", "Complete map of neurons and their synaptic connections"],
            ["Materialization", "Fixed queryable snapshot of EM segmentation + annotations"],
            ["Neuropil", "Named synaptic region (medulla, MB calyx...) - our wireframe unit"],
            ["Neuromere", "Segmental VNC unit (T1-T3 thoracic, A1-A10 abdominal)"],
            ["Soma", "Cell body - the dots rendered are real soma positions"],
            ["root_region", "Ito-atlas neuropil code annotating each cell's dendritic home"],
            ["super_class / cell_class / cell_type", "Coarse->fine BANC annotation hierarchy"],
            ["Hemilineage", "Developmental origin class (paired with NT identity)"],
            ["KC / MBON / DAN", "Kenyon cell - MB output neuron - dopaminergic neuron"],
            ["LIF", "Leaky integrate-and-fire - the spiking model used"],
            ["GluCl", "Glutamate-gated Cl channel - why fly glutamate inhibits"],
            ["NBLAST", "Morphological similarity metric used for cell typing"],
            ["DN / AN", "Descending / ascending neuron - brain<->cord tracts"],
        ],
        widths=[55, 120],
    )

    # ---------- 9. References ----------
    doc.h1("9. References & Links")
    for s in [
        "[1] Bates AS, Phelps JS, Kim SM, Yang HH, et al. 2026, Nature.",
        "     Distributed control circuits across a brain-and-cord connectome.",
        "     doi:10.1038/s41586-026-10735-w",
        "[2] BANC v888 materialization (2026-04-17), Harvard Dataverse.",
        "     doi:10.7910/DVN/7WTH1N",
        "[3] BANC public bucket: gs://lee-lab_brain-and-nerve-cord-fly-connectome;",
        "     banc.community - ng.banc.community/view - codex.flywire.ai",
        "[4] Ito K, et al. 2014, Neuron 81:755-765. Systematic nomenclature",
        "     for the insect brain (root_region ITO_* codes).",
        "     doi:10.1016/j.neuron.2013.12.017",
        "[5] Eckstein N, et al. 2024, Cell 187. NT classification from EM",
        "     images at synaptic sites (the 8-class predictions).",
        "     doi:10.1016/j.cell.2024.03.016",
        "[6] Costa M, et al. 2016, Neuron 90. NBLAST morphology typing.",
        "     doi:10.1016/j.neuron.2016.06.012",
        "[7] Bates AS, Manton JD, et al. 2020, eLife 9:e53350. natverse.",
        "     doi:10.7554/eLife.53350",
        "[8] Gerstner W, Kistler WM. 2002. Spiking Neuron Models (LIF).",
        "[9] Plaza SM. 2022, Nature Methods 19. neuPrint. doi:10.1038/s41592-021-01394-y",
        "[10] Dorkenwald S, et al. 2024, Nature 634. FlyWire brain.",
        "     doi:10.1038/s41586-024-05810-y",
        "[11] Marin EC, et al. 2024, Nature 634. MANC VNC connectome.",
        "     doi:10.1038/s41586-024-07266-x",
        "[12] Scheffer LK, et al. 2020, eLife 9:e57443. Hemibrain.",
        "     doi:10.7554/eLife.57443",
        "[13] Court R, et al. 2020. VFB VNC atlas (COURT_vnc_* codes).",
        "     virtualflybrain.org",
        "[14] Milyaev N, et al. 2012, Bioinformatics 28. Virtual Fly Brain.",
        "     doi:10.1093/bioinformatics/bts677",
        "[15] Aso Y, et al. 2014, eLife 3:e04577. MB architecture for",
        "     associative learning. doi:10.7554/eLife.04577",
        "[16] Handler A, et al. 2019, Cell 179. Dopamine pathways in",
        "     associative learning. doi:10.1016/j.cell.2019.10.024",
    ]:
        doc.li(s)
    doc.ln(8)
    doc.set_font("helvetica", "I", 9)
    doc.set_text_color(120, 120, 120)
    doc.multi_cell(
        0, 5,
        "BANC data (C) the BANC consortium - use per their terms. "
        "This software is a research/education visualization.",
    )

    doc.output("RESEARCH.pdf")
    print("wrote RESEARCH.pdf")


if __name__ == "__main__":
    build()
