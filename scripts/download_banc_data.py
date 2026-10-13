#!/usr/bin/env python3
"""
Download and process REAL BANC v888 connectome data.

Downloads publicly available data from the Lee Lab GCS bucket:
  gs://lee-lab_brain-and-nerve-cord-fly-connectome/compiled_data/banc_888/

Produces output files for the browser simulation:
  1. banc_neurons.json     - All ~188K neurons with real positions, cell types, NT, regions
  2. banc_cell_types.json  - Cell type populations with real counts and distributions
  3. banc_connections.bin  - ALL cell-type-pair connectivity (binary, see write_connections_bin)

NO MADE-UP DATA. Every neuron, position, neurotransmitter, and connection
comes from the actual BANC v888 materialization (Bates et al. 2026).

Requirements:
  pip install pandas pyarrow requests

Usage:
  python scripts/download_banc_data.py
  python scripts/download_banc_data.py --output-dir public/data
  python scripts/download_banc_data.py --skip-edgelist  # skip the 336MB edgelist download
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
import time

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas is required. Install with: pip install pandas pyarrow")
    sys.exit(1)

# GCS public bucket URLs (no authentication needed)
GCS_BASE = "https://storage.googleapis.com/lee-lab_brain-and-nerve-cord-fly-connectome/compiled_data/banc_888"
META_URL = f"{GCS_BASE}/banc_888_meta.feather"
EDGELIST_URL = f"{GCS_BASE}/banc_888_edgelist_simple_v3.feather"

# Voxel resolution for BANC (nm per voxel, x/y/z)
# BANC uses 4x4x40 nm voxels (GridTape EM)
VOXEL_RESOLUTION = [4.0, 4.0, 40.0]


def download_file(url: str, local_path: str, expected_size_mb: float = 0) -> str:
    """Download a file with progress indication."""
    # Check if already downloaded
    if os.path.exists(local_path):
        size_mb = os.path.getsize(local_path) / (1024 * 1024)
        print(f"  Already downloaded: {local_path} ({size_mb:.1f} MB)")
        return local_path

    print(f"  Downloading from {url}")
    print(f"  Saving to {local_path}")

    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=120) as response:
            total = int(response.headers.get('content-length', 0))
            total_mb = total / (1024 * 1024)
            print(f"  File size: {total_mb:.1f} MB")

            downloaded = 0
            chunk_size = 1024 * 1024  # 1MB chunks
            start_time = time.time()

            with open(local_path, 'wb') as f:
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    elapsed = time.time() - start_time
                    if elapsed > 0:
                        speed = (downloaded / (1024 * 1024)) / elapsed
                        pct = (downloaded / total * 100) if total > 0 else 0
                        print(f"\r  {downloaded / (1024*1024):.1f} / {total_mb:.1f} MB ({pct:.0f}%) [{speed:.1f} MB/s]", end="", flush=True)
            print()
        return local_path
    except urllib.error.URLError as e:
        print(f"\n  ERROR downloading: {e}")
        if os.path.exists(local_path):
            os.remove(local_path)
        return ""
    except Exception as e:
        print(f"\n  ERROR: {e}")
        if os.path.exists(local_path):
            os.remove(local_path)
        return ""


def process_neurons(meta_df: pd.DataFrame) -> list:
    """
    Process the meta feather into a compact neuron list.

    Extracts: id, position (normalized), cell_type, super_class, cell_class,
    neurotransmitter, region, side, input/output connection counts.
    """
    print(f"  Processing {len(meta_df)} neurons...")

    # Get positions - use root_position_nm if available, otherwise position * voxel_size
    import numpy as np
    def safe_pos(p, scale=None):
        if p is None:
            return [0.0, 0.0, 0.0]
        try:
            # Handle string format: "390720, 93568, 86220"
            if isinstance(p, str):
                parts = [float(x.strip()) for x in p.split(',')]
                if len(parts) == 3:
                    if any(np.isnan(v) or np.isinf(v) for v in parts):
                        return [0.0, 0.0, 0.0]
                    if scale:
                        parts = [v * s for v, s in zip(parts, scale)]
                    return parts
            # Handle list/tuple/array format
            if hasattr(p, '__len__') and len(p) == 3:
                vals = [float(p[0]), float(p[1]), float(p[2])]
                if scale:
                    vals = [v * s for v, s in zip(vals, scale)]
                if any(np.isnan(v) or np.isinf(v) for v in vals):
                    return [0.0, 0.0, 0.0]
                return vals
        except (TypeError, ValueError, IndexError):
            pass
        return [0.0, 0.0, 0.0]

    if 'root_position_nm' in meta_df.columns:
        positions = meta_df['root_position_nm'].apply(lambda p: safe_pos(p)).tolist()
    elif 'root_position' in meta_df.columns:
        positions = meta_df['root_position'].apply(lambda p: safe_pos(p, VOXEL_RESOLUTION)).tolist()
    elif 'position' in meta_df.columns:
        positions = meta_df['position'].apply(lambda p: safe_pos(p, VOXEL_RESOLUTION)).tolist()
    else:
        print("  WARNING: No position column found, using zeros")
        positions = [[0.0, 0.0, 0.0]] * len(meta_df)

    # Normalize positions to roughly -1 to 1 coordinate space for visualization
    # Find bounding box (skip zeros from missing positions)
    xs = [p[0] for p in positions if p and len(p) == 3 and p[0] != 0.0]
    ys = [p[1] for p in positions if p and len(p) == 3 and p[1] != 0.0]
    zs = [p[2] for p in positions if p and len(p) == 3 and p[2] != 0.0]

    if xs and ys and zs:
        x_min, x_max = min(xs), max(xs)
        y_min, y_max = min(ys), max(ys)
        z_min, z_max = min(zs), max(zs)
        x_range = max(x_max - x_min, 1)
        y_range = max(y_max - y_min, 1)
        z_range = max(z_max - z_min, 1)
        # Scale to fit in roughly -1 to 1, centered at origin
        scale = max(x_range, y_range, z_range) / 2.0
        x_center = (x_min + x_max) / 2
        y_center = (y_min + y_max) / 2
        z_center = (z_min + z_max) / 2
    else:
        x_center = y_center = z_center = 0
        scale = 1.0

    print(f"  Position bounds: X[{x_min:.0f}, {x_max:.0f}] Y[{y_min:.0f}, {y_max:.0f}] Z[{z_min:.0f}, {z_max:.0f}]")
    print(f"  Normalizing to [-1, 1] (scale={scale:.0f} nm)")

    # Vectorized normalization
    neurons = []
    # Pre-extract columns as lists for speed
    banc_ids = meta_df['banc_888_id'].astype(str).tolist() if 'banc_888_id' in meta_df.columns else [''] * len(meta_df)
    cell_types_col = meta_df['cell_type'].fillna('').astype(str).tolist() if 'cell_type' in meta_df.columns else [''] * len(meta_df)
    super_classes = meta_df['super_class'].fillna('').astype(str).tolist() if 'super_class' in meta_df.columns else [''] * len(meta_df)
    cell_classes = meta_df['cell_class'].fillna('').astype(str).tolist() if 'cell_class' in meta_df.columns else [''] * len(meta_df)
    nts_col = meta_df['neurotransmitter_predicted'].fillna('unknown').astype(str).tolist() if 'neurotransmitter_predicted' in meta_df.columns else ['unknown'] * len(meta_df)
    regions = meta_df['region'].fillna('central_brain').astype(str).tolist() if 'region' in meta_df.columns else ['central_brain'] * len(meta_df)
    sides = meta_df['side'].fillna('center').astype(str).tolist() if 'side' in meta_df.columns else ['center'] * len(meta_df)
    flows = meta_df['flow'].fillna('').astype(str).tolist() if 'flow' in meta_df.columns else [''] * len(meta_df)
    n_inputs = meta_df['input_connections'].fillna(0).astype(int).tolist() if 'input_connections' in meta_df.columns else [0] * len(meta_df)
    n_outputs = meta_df['output_connections'].fillna(0).astype(int).tolist() if 'output_connections' in meta_df.columns else [0] * len(meta_df)
    root_regions = meta_df['root_region'].fillna('').astype(str).tolist() if 'root_region' in meta_df.columns else [''] * len(meta_df)

    for i in range(len(positions)):
        pos = positions[i]
        # Axis convention for display (verified against real region geometry):
        #   x = lateral (BANC side 'left' is +x), y = longitudinal with brain UP
        #   (source axis1 runs anterior-brain -> VNC; negated so VNC hangs down),
        #   z = dorsal(+)/ventral(-) (MB calyx is +z, GNG is -z).
        # Neurons with no real soma coordinate ([0,0,0] sentinel) get pos=null —
        # they are not rendered rather than drawn at an invented location.
        has_pos = pos and pos != [0.0, 0.0, 0.0]
        norm_pos = [
            (pos[0] - x_center) / scale,
            -(pos[1] - y_center) / scale,
            (pos[2] - z_center) / scale,
        ] if has_pos else None
        neurons.append({
            "id": i,
            "banc_id": banc_ids[i],
            "pos": norm_pos,
            "cell_type": cell_types_col[i],
            "super_class": super_classes[i],
            "cell_class": cell_classes[i],
            "nt": nts_col[i],
            "region": regions[i],
            "root_region": root_regions[i],
            "side": sides[i],
            "flow": flows[i],
            "n_inputs": n_inputs[i],
            "n_outputs": n_outputs[i],
        })

    # Normalized position of an unlocalized neuron (raw pos [0,0,0]) —
    # kept for callers that want to detect the sentinel
    fallback_norm = [-x_center / scale, y_center / scale, -z_center / scale]
    return neurons, fallback_norm


def display_region_of(root_region: str, coarse_region: str) -> str:
    """Map a BANC root_region (Ito et al. 2014 neuropil codes) to a display region."""
    r = str(root_region)
    if r.startswith('ITO_optic'):
        return 'optic_lobe'
    parts = r.split('_')
    code = parts[2] if len(parts) > 2 else ''
    if r.startswith('ITO_midbrain'):
        if code == 'MB':
            return 'mushroom_body'
        if code == 'AL':
            return 'antennal_lobe'
        if code == 'GNG':  # gnathal ganglion = suboesophageal zone
            return 'suboesophageal_zone'
        return 'central_brain'
    if '_vnc_' in r:
        return 'ventral_nerve_cord'
    return coarse_region if coarse_region in ('optic_lobe', 'central_brain', 'ventral_nerve_cord') else 'central_brain'


def process_regions(meta_df: pd.DataFrame, neurons: list) -> dict:
    """
    Compute REAL display-region geometry from neuron soma positions.

    Every wireframe is derived from the actual point cloud: ellipsoid center =
    mean position, semi-axes = 2 std (covers ~95% of a neuropil's somata).
    Bilateral neuropils get left/right ellipsoids from the real 'side' labels.
    The VNC is a longitudinal tube; the cervical connective tube is placed in
    the real gap between the VNC's uppermost somata and the GNG.
    """
    import numpy as np

    rr = meta_df['root_region'].fillna('').astype(str).tolist()
    coarse = meta_df['region'].fillna('').astype(str).tolist()
    side_col = meta_df['side'].fillna('center').astype(str).tolist()

    groups: dict = {}
    for i, n in enumerate(neurons):
        if not n['pos']:
            continue  # no real soma coordinate in BANC
        d = display_region_of(rr[i], coarse[i])
        s = side_col[i] if side_col[i] in ('left', 'right') else 'center'
        groups.setdefault((d, s), []).append(n['pos'])

    regions = []
    for (d, s), pts in sorted(groups.items()):
        p = np.asarray(pts, dtype=np.float64)
        if len(p) < 30:
            continue
        c = p.mean(axis=0)
        sd = p.std(axis=0) * 2.0
        sd = np.maximum(sd, 0.02)  # floor so thin neuropils stay visible
        regions.append({
            "name": d,
            "side": s,
            "shape": "ellipsoid",
            "center": [round(float(v), 4) for v in c],
            "size": [round(float(v), 4) for v in sd],
            "count": int(len(p)),
        })

    # VNC: single tube along the longitudinal axis from its real soma cloud
    vnc_pts = np.asarray([p for (d, s), pts in groups.items() if d == 'ventral_nerve_cord' for p in pts])
    if len(vnc_pts):
        c = vnc_pts.mean(axis=0)
        regions.append({
            "name": "ventral_nerve_cord",
            "side": "center",
            "shape": "tube",
            "center": [round(float(c[0]), 4), round(float((vnc_pts[:, 1].min() + vnc_pts[:, 1].max()) / 2), 4), round(float(c[2]), 4)],
            "size": [round(float(vnc_pts[:, 0].std() * 2), 4), round(float((vnc_pts[:, 1].max() - vnc_pts[:, 1].min()) / 2), 4), round(float(vnc_pts[:, 2].std() * 2), 4)],
            "count": int(len(vnc_pts)),
        })

    # Cervical connective: tube bridging the real gap between the top of the
    # VNC soma band and the bottom of the gnathal ganglion (SEZ).
    gng_pts = np.asarray([p for (d, s), pts in groups.items() if d == 'suboesophageal_zone' for p in pts])
    if len(vnc_pts) and len(gng_pts):
        band = vnc_pts[vnc_pts[:, 1] > np.percentile(vnc_pts[:, 1], 90)]
        band_top = float(band[:, 1].mean())
        gng_bottom = float(gng_pts[:, 1].mean() - 2 * gng_pts[:, 1].std())
        regions.append({
            "name": "cervical_connective",
            "side": "center",
            "shape": "tube",
            "center": [round(float(band[:, 0].mean()), 4), round((band_top + gng_bottom) / 2, 4), round(float(band[:, 2].mean()), 4)],
            "size": [round(float(max(band[:, 0].std(), band[:, 2].std())), 4), round(abs(gng_bottom - band_top) / 2, 4), round(float(max(band[:, 0].std(), band[:, 2].std())), 4)],
            "count": int(len(band)),
        })

    return {"regions": regions}


def process_cell_types(meta_df: pd.DataFrame) -> dict:
    """
    Aggregate neuron metadata by cell type to get real population statistics.
    Returns a dict with cell type info and distributions.
    """
    print(f"  Aggregating cell types...")

    # Vectorized aggregation
    ct_col = meta_df['cell_type'].fillna('unknown').astype(str)
    sc_col = meta_df['super_class'].fillna('').astype(str)
    cc_col = meta_df['cell_class'].fillna('').astype(str)
    nt_col = meta_df['neurotransmitter_predicted'].fillna('unknown').astype(str)
    reg_col = meta_df['region'].fillna('central_brain').astype(str)
    flow_col = meta_df['flow'].fillna('').astype(str)

    cell_types = {}
    for i in range(len(meta_df)):
        ct = ct_col.iloc[i]
        if ct not in cell_types:
            cell_types[ct] = {
                "cell_type": ct,
                "count": 0,
                "super_class": sc_col.iloc[i],
                "cell_class": cc_col.iloc[i],
                "nt": nt_col.iloc[i],
                "region": reg_col.iloc[i],
                "flow": flow_col.iloc[i],
            }
        cell_types[ct]["count"] += 1

    # Sort by count (most common first)
    sorted_types = sorted(cell_types.values(), key=lambda x: -x["count"])

    return {
        "total_cell_types": len(sorted_types),
        "cell_types": sorted_types,
    }


def process_connections(edgelist_df: pd.DataFrame, meta_df: pd.DataFrame) -> dict:
    """
    Process the edgelist into cell-type-pair connectivity using vectorized pandas.

    Aggregates 13.5M connections by (pre_cell_type, post_cell_type) using groupby.
    This preserves ALL real connectivity data at the cell-type level.

    NO FILTERING — every connection from the real BANC v888 edgelist is included.
    """
    print(f"  Processing {len(edgelist_df):,} connections (vectorized)...")

    # Build root_id -> cell_type lookup as a Series for fast mapping
    ct_series = meta_df.set_index('banc_888_id')['cell_type'].fillna('unknown').astype(str)
    # Replace any remaining 'nan' strings with 'unknown'
    ct_series = ct_series.replace({'nan': 'unknown', 'None': 'unknown', '': 'unknown'})

    # Map pre/post root IDs to cell types using vectorized map
    print("  Mapping pre-synaptic IDs to cell types...")
    pre_types = edgelist_df['pre'].map(ct_series).fillna('unknown').astype(str)
    print("  Mapping post-synaptic IDs to cell types...")
    post_types = edgelist_df['post'].map(ct_series).fillna('unknown').astype(str)

    # Replace any 'nan' strings that slipped through
    pre_types = pre_types.replace({'nan': 'unknown', 'None': 'unknown', '': 'unknown'})
    post_types = post_types.replace({'nan': 'unknown', 'None': 'unknown', '': 'unknown'})

    # NO FILTERING — every connection is kept, including pairs involving
    # neurons without a cell-type annotation (labelled 'unknown').
    print(f"  {len(pre_types):,} connections total "
          f"({((pre_types == 'unknown') | (post_types == 'unknown')).sum():,} involve unknown cell types)")

    # Vectorized groupby: aggregate by (pre_type, post_type)
    print("  Grouping by cell-type pairs (vectorized)...")
    group_df = pd.DataFrame({
        'pre_type': pre_types.values,
        'post_type': post_types.values,
        'count': edgelist_df['count'].values,
    })

    grouped = group_df.groupby(['pre_type', 'post_type'])['count'].agg(['sum', 'count', 'mean', 'median']).reset_index()
    grouped.columns = ['pre_type', 'post_type', 'total_synapses', 'connection_count', 'mean_synapses', 'median_synapses']
    grouped = grouped.sort_values('total_synapses', ascending=False)

    print(f"  {len(grouped):,} unique cell-type pairs (all kept, no threshold)")
    return grouped


def write_connections_bin(grouped: pd.DataFrame, path: str) -> None:
    """
    Write cell-type-pair connectivity as a compact binary file.

    Layout (all little-endian):
      4B   magic 'BCN1'
      u32  number of cell-type names
      u32  number of pairs
      per type: u16 byte-length + UTF-8 name bytes
      pad to 4-byte alignment
      u32[n] pre_type index, u32[n] post_type index,
      u32[n] total_synapses, u32[n] connection_count,
      f32[n] mean_synapses, f32[n] median_synapses

    ~24 bytes per pair vs ~200 bytes as JSON — keeps the FULL pair set
    loadable in a browser (~100MB flat instead of ~540MB of text).
    """
    import numpy as np

    types = sorted(set(grouped['pre_type']).union(grouped['post_type']))
    type_idx = {t: i for i, t in enumerate(types)}
    n_pairs = len(grouped)

    with open(path, 'wb') as f:
        f.write(b'BCN1')
        f.write(np.array([len(types), n_pairs], dtype='<u4').tobytes())
        for t in types:
            b = t.encode('utf-8')
            if len(b) > 65535:
                raise ValueError(f"cell type name too long: {t!r}")
            f.write(np.array([len(b)], dtype='<u2').tobytes())
            f.write(b)
        f.write(b'\0' * ((4 - (f.tell() % 4)) % 4))

        f.write(grouped['pre_type'].map(type_idx).to_numpy(dtype='<u4').tobytes())
        f.write(grouped['post_type'].map(type_idx).to_numpy(dtype='<u4').tobytes())
        f.write(grouped['total_synapses'].to_numpy(dtype='<u4').tobytes())
        f.write(grouped['connection_count'].to_numpy(dtype='<u4').tobytes())
        f.write(grouped['mean_synapses'].to_numpy(dtype='<f4').tobytes())
        f.write(grouped['median_synapses'].to_numpy(dtype='<f4').tobytes())

    print(f"  Binary: {len(types):,} cell types, {n_pairs:,} pairs, "
          f"{os.path.getsize(path) / (1024*1024):.1f} MB")


def main():
    parser = argparse.ArgumentParser(description="Download and process real BANC v888 data")
    parser.add_argument("--output-dir", "-o", default="public/data",
                        help="Output directory for JSON files (default: public/data)")
    parser.add_argument("--cache-dir", "-c", default="data/raw",
                        help="Cache directory for downloaded feather files (default: data/raw)")
    parser.add_argument("--skip-edgelist", action="store_true",
                        help="Skip downloading the 336MB edgelist (only process neurons)")
    args = parser.parse_args()

    print("=" * 70)
    print("BANC v888 Real Data Downloader")
    print("Bates, Phelps, Kim, Yang et al. (2026) Nature")
    print("=" * 70)
    print(f"Output directory: {args.output_dir}")
    print(f"Cache directory:  {args.cache_dir}")
    print()

    # Create directories
    os.makedirs(args.output_dir, exist_ok=True)
    os.makedirs(args.cache_dir, exist_ok=True)

    # Step 1: Download meta feather (~49 MB)
    print("1. Downloading neuron metadata (banc_888_meta.feather, ~49 MB)...")
    meta_path = download_file(META_URL, os.path.join(args.cache_dir, "banc_888_meta.feather"))
    if not meta_path:
        print("  FATAL: Could not download meta file. Cannot proceed.")
        sys.exit(1)

    # Step 2: Load and process meta
    print("\n2. Loading neuron metadata...")
    meta_df = pd.read_feather(meta_path)
    print(f"  Loaded {len(meta_df)} neurons × {len(meta_df.columns)} columns")
    print(f"  Columns: {', '.join(meta_df.columns[:20])}...")

    # Process neurons
    print("\n3. Processing neurons...")
    neurons, fallback_norm = process_neurons(meta_df)
    neurons_path = os.path.join(args.output_dir, "banc_neurons.json")
    print(f"  Saving {len(neurons)} neurons to {neurons_path}...")
    with open(neurons_path, 'w') as f:
        json.dump(neurons, f, separators=(',', ':'))
    print(f"  File size: {os.path.getsize(neurons_path) / (1024*1024):.1f} MB")

    # Process cell types
    print("\n4. Processing cell types...")
    cell_types = process_cell_types(meta_df)
    ct_path = os.path.join(args.output_dir, "banc_cell_types.json")
    print(f"  Saving {cell_types['total_cell_types']} cell types to {ct_path}...")
    with open(ct_path, 'w') as f:
        json.dump(cell_types, f, indent=2)
    print(f"  File size: {os.path.getsize(ct_path) / (1024):.1f} KB")

    # Compute real display-region geometry (for wireframe overlays)
    print("\n4b. Computing real region boundaries...")
    region_stats = process_regions(meta_df, neurons)
    reg_path = os.path.join(args.output_dir, "banc_regions.json")
    with open(reg_path, 'w') as f:
        json.dump(region_stats, f)
    for r in region_stats['regions']:
        print(f"    {r['name']:22s} {r['side']:6s} n={r['count']:6d} "
              f"center={r['center']} size={r['size']}")

    # Print summary statistics
    print("\n  --- Neuron Summary ---")
    regions = {}
    nts = {}
    super_classes = {}
    for n in neurons:
        r = n['region']
        regions[r] = regions.get(r, 0) + 1
        nt = n['nt']
        nts[nt] = nts.get(nt, 0) + 1
        sc = n['super_class']
        super_classes[sc] = super_classes.get(sc, 0) + 1

    print(f"  Regions: {json.dumps(regions, indent=2)}")
    print(f"  Neurotransmitters: {json.dumps(nts, indent=2)}")
    print(f"  Super classes: {json.dumps(super_classes, indent=2)}")

    # Step 3: Download and process edgelist (~336 MB)
    if not args.skip_edgelist:
        print("\n5. Downloading edgelist (banc_888_edgelist_simple_v3.feather, ~336 MB)...")
        print("   This is a large file and may take several minutes...")
        edgelist_path = download_file(EDGELIST_URL, os.path.join(args.cache_dir, "banc_888_edgelist_simple_v3.feather"))
        if edgelist_path:
            print("\n6. Loading edgelist...")
            edgelist_df = pd.read_feather(edgelist_path)
            print(f"  Loaded {len(edgelist_df):,} connections × {len(edgelist_df.columns)} columns")
            print(f"  Columns: {', '.join(edgelist_df.columns)}")

            print("\n7. Processing connections by cell type...")
            grouped = process_connections(edgelist_df, meta_df)
            conn_path = os.path.join(args.output_dir, "banc_connections.bin")
            print(f"  Saving {len(grouped):,} cell-type pairs to {conn_path}...")
            write_connections_bin(grouped, conn_path)

            print(f"\n  Top 10 strongest cell-type connections:")
            for _, c in grouped.head(10).iterrows():
                print(f"    {c['pre_type']} -> {c['post_type']}: {int(c['total_synapses']):,} synapses ({int(c['connection_count'])} connections)")
        else:
            print("  WARNING: Could not download edgelist. Connections file not created.")
            print("  The simulation will use cell-type-level connectivity only.")
    else:
        print("\n5. Skipping edgelist download (--skip-edgelist)")

    print("\n" + "=" * 70)
    print("DONE! Real BANC v888 data has been processed.")
    print(f"Output files in {args.output_dir}/:")
    print(f"  - banc_neurons.json     (all ~188K neurons with real positions & metadata)")
    print(f"  - banc_cell_types.json  (real cell type populations)")
    if not args.skip_edgelist:
        print(f"  - banc_connections.bin  (ALL real cell-type-pair connectivity, binary)")
    print("=" * 70)


if __name__ == "__main__":
    main()
