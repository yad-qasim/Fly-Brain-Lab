"""
Export additional REAL BANC data for maximum realism:

1. 'norm' block -> public/data/banc_regions.json
   The exact normalization applied to every exported coordinate, so the
   browser can map real SWC skeletons (raw BANC nm) into display space.
   Convention (must match download_banc_data.py):
       display.x = (nm.x - x_center) / scale        (left = +x)
       display.y = -(nm.y - y_center) / scale       (brain up, VNC down)
       display.z = (nm.z - z_center) / scale        (dorsal = +z)

2. banc_metrics.json — real per-neuron morphology metrics from
   banc_888_metrics.feather (cable length, in/out connection counts,
   axon/dendrite lengths) keyed by banc_888_id.

3. fly_trajectory.json — real measured locomotion of the actual BANC fly
   (BANCr Y-maze centroid tracking, Bates et al. 2026 supplementary data).

Uses only the cached raw files — nothing is re-downloaded.
"""

import json
import os
import sys

import numpy as np
import pandas as pd

RAW = "data/raw"
OUT = "public/data"


def export_norm() -> dict:
    """Recompute the same normalization constants used by process_neurons."""
    df = pd.read_feather(os.path.join(RAW, "banc_888_meta.feather"),
                         columns=["position", "root_position_nm"])
    col = "root_position_nm" if "root_position_nm" in df.columns else "position"

    def safe_pos(p):
        # Same parsing as download_banc_data.process_neurons
        if p is None:
            return [0.0, 0.0, 0.0]
        if isinstance(p, str):
            try:
                parts = [float(x.strip()) for x in p.split(",")]
                return parts if len(parts) == 3 else [0.0, 0.0, 0.0]
            except ValueError:
                return [0.0, 0.0, 0.0]
        if hasattr(p, "__len__") and len(p) == 3:
            return [float(v) for v in p]
        return [0.0, 0.0, 0.0]

    pos = df[col].apply(safe_pos)
    arr = np.asarray(pos.tolist(), dtype=np.float64)
    arr = np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0)

    # Per-axis zero filtering — must match download_banc_data.process_neurons
    xs = arr[arr[:, 0] != 0.0, 0]
    ys = arr[arr[:, 1] != 0.0, 1]
    zs = arr[arr[:, 2] != 0.0, 2]
    x_center = (xs.min() + xs.max()) / 2
    y_center = (ys.min() + ys.max()) / 2
    z_center = (zs.min() + zs.max()) / 2
    scale = float(max((xs.max() - xs.min()),
                      (ys.max() - ys.min()),
                      (zs.max() - zs.min())) / 2.0)

    norm = {
        "x_center": float(x_center),
        "y_center": float(y_center),
        "z_center": float(z_center),
        "scale": scale,
        "units": "nm",
        "note": "display=[(nm-center)/scale], axis1 negated (brain up, VNC down)",
    }

    reg_path = os.path.join(OUT, "banc_regions.json")
    with open(reg_path) as f:
        regions = json.load(f)
    regions["norm"] = norm
    with open(reg_path, "w") as f:
        json.dump(regions, f)
    print(f"norm written to {reg_path}: {norm}")
    return norm


def export_metrics() -> None:
    """Real morphology metrics per neuron (banc_888_metrics.feather)."""
    cols = ["banc_888_id", "l2_cable_length_um", "input_connections",
            "output_connections", "axon_length", "dend_length", "branchpoints"]
    df = pd.read_feather(os.path.join(RAW, "banc_888_metrics.feather"), columns=cols)
    df = df.dropna(subset=["banc_888_id"])
    df = df.fillna(0)

    payload = {
        "fields": ["cable_um", "in_conn", "out_conn", "axon_um", "dend_um", "branchpoints"],
        # ids as strings — 18-digit ids exceed float53 and would lose precision
        "ids": df["banc_888_id"].astype(str).tolist(),
        "vals": np.round(df[cols[1:]].to_numpy(), 2).tolist(),
    }
    path = os.path.join(OUT, "banc_metrics.json")
    with open(path, "w") as f:
        json.dump(payload, f, separators=(",", ":"))
    print(f"metrics: {len(df)} neurons -> {path} "
          f"({os.path.getsize(path)/1048576:.1f} MB)")


def export_trajectory() -> None:
    """Real tracked locomotion of the actual BANC fly (BANCr Y-maze data)."""
    csv_path = os.path.join(RAW, "BANCr_centroid.csv")
    if not os.path.exists(csv_path):
        print("  BANCr_centroid.csv not found in data/raw — skipping trajectory")
        return
    df = pd.read_csv(csv_path)

    # Longest contiguous run of valid samples (~1 hour at ~14 fps)
    valid = df["x_pos"].notna().to_numpy()
    runs = np.split(np.arange(len(df)), np.where(np.diff(valid.astype(int)) != 0)[0] + 1)
    run = max(runs, key=len)
    seg = df.iloc[run].reset_index(drop=True)

    # Choose the most locomotion-active 5-minute window
    step = seg[["x_pos", "y_pos"]].diff().fillna(0)
    speed = np.sqrt((step ** 2).sum(axis=1))
    win = int(300 / seg["tcum"].diff().median())  # ~300 s of frames
    active = speed.rolling(win, center=True).mean()
    peak = int(active.idxmax())
    lo = max(0, peak - win // 2)
    hi = min(len(seg), lo + win)
    seg = seg.iloc[lo:hi].reset_index(drop=True)

    # Downsample ~3x and normalize time to start at 0
    seg = seg.iloc[::3]
    t = (seg["tcum"] - seg["tcum"].iloc[0]).round(3).tolist()
    x = seg["x_pos"].round(2).tolist()
    y = seg["y_pos"].round(2).tolist()

    payload = {
        "source": "BANCr Y-maze centroid tracking (Bates et al. 2026, real fly)",
        "fps": 1.0 / float(np.median(np.diff(t))) if len(t) > 1 else 0,
        "units": "pixels",
        "bounds": {
            "x": [float(seg["x_pos"].min()), float(seg["x_pos"].max())],
            "y": [float(seg["y_pos"].min()), float(seg["y_pos"].max())],
        },
        "t": t, "x": x, "y": y,
    }
    path = os.path.join(OUT, "fly_trajectory.json")
    with open(path, "w") as f:
        json.dump(payload, f, separators=(",", ":"))
    print(f"trajectory: {len(t)} frames, {t[-1]:.0f}s of real fly locomotion "
          f"-> {path} ({os.path.getsize(path)/1024:.0f} KB)")


if __name__ == "__main__":
    export_norm()
    export_metrics()
    export_trajectory()
    print("Done.")
