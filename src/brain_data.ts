// Brain region shapes and neuron generation from REAL BANC v888 data
// Bates, Phelps, Kim, Yang et al. (2026) Nature. doi:10.1038/s41586-026-10735-w
//
// ALL DATA IS REAL from BANC v888 (Bates et al. 2026):
// - Neuron 3D positions: REAL (from BANC soma coordinates, normalized to [-1, 1])
// - Cell types: REAL (from BANC cell type annotations)
// - Neurotransmitters: REAL (from BANC 8-class NT predictions)
// - Brain regions: REAL (from BANC neuropil annotations)
// - Neuron classes: REAL (from BANC super_class annotations)
// - NO INVENTED DATA - every neuron's position is a real BANC soma coordinate

import { NeuronClass, Neurotransmitter, BrainRegion } from './types';
import { ConnectomeData } from './types';
import { BancData, BancRegionStat, displayRegionOf, mapNT, neuronClassOf, isNeuron } from './banc_loader';

// ============================================================================
// TYPES
// ============================================================================

export interface BrainNeuron {
  id: number;
  bancId?: string;
  region: BrainRegion;
  neuronClass: NeuronClass;
  neurotransmitter: Neurotransmitter;
  position: [number, number, number];
  simulationGroupId: number;
  dataSource: 'real' | 'invented';
  cellType?: string;
  cellClass?: string;
  rootRegion?: string;
}

// ============================================================================
// REGION SHAPES (for 3D mesh visualization)
// ============================================================================
// All region geometry is REAL: computed from BANC soma positions per
// root_region (Ito et al. 2014 neuropil codes) and side. See
// scripts/download_banc_data.py: process_regions().

export interface RegionShape {
  type: 'ellipsoid' | 'cylinder' | 'tube';
  center: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
}

// ============================================================================
// REGION COLORS
// ============================================================================

export const REGION_COLORS: Record<string, [number, number, number]> = {
  'optic_lobe': [0.0, 0.75, 0.40],      // green
  'central_brain': [0.25, 0.55, 1.0],    // blue
  'mushroom_body': [1.0, 0.80, 0.0],     // gold
  'antennal_lobe': [0.0, 0.8, 0.8],      // teal
  'suboesophageal_zone': [1.0, 0.50, 0.20], // orange
  'cervical_connective': [0.70, 0.60, 0.30], // bronze
  'ventral_nerve_cord': [0.90, 0.30, 0.50], // pink
};

// ============================================================================
// REGION SHAPES FOR MESH CREATION
// ============================================================================

export interface RegionShapeEntry {
  name: string;        // e.g. 'optic_lobe_left' or 'ventral_nerve_cord'
  region: BrainRegion; // display region for pulses/filters
  shape: RegionShape;
  color: [number, number, number];
  count: number;
}

// Build display shapes from REAL region geometry measured from the
// BANC soma point cloud (banc_regions.json). No invented boundaries.
export function getRegionShapes(stats: BancRegionStat[]): RegionShapeEntry[] {
  return stats.map(r => ({
    name: r.side === 'center' ? r.name : `${r.name}_${r.side}`,
    region: r.name as BrainRegion,
    shape: { type: r.shape === 'tube' ? 'tube' : 'ellipsoid', center: r.center, size: r.size },
    color: REGION_COLORS[r.name] || [0.5, 0.5, 0.5],
    count: r.count,
  }));
}

// ============================================================================
// NEURON GENERATION FROM REAL BANC DATA
// ============================================================================

// Generate all ~188,000 CNS neurons from REAL BANC v888 data.
//
// Every neuron's position, cell type, neurotransmitter, region, and class
// comes from the actual BANC v888 materialization (Bates et al. 2026).
// NO INVENTED DATA - all positions are real soma coordinates normalized to [-1, 1].
export function generateBrainNeuronsFromBanc(
  connectome: ConnectomeData,
  bancData: BancData,
): BrainNeuron[] {
  const neurons: BrainNeuron[] = [];

  // Build a lookup from cell type -> simulation group ID
  const cellTypeToSimGroup: Map<string, number> = new Map();
  for (const n of connectome.neurons) {
    if (n.cellType) {
      cellTypeToSimGroup.set(n.cellType, n.id);
    }
  }

  // Also build a fallback: class+region -> simulation group
  const classRegionToSimGroup: Map<string, number> = new Map();
  for (const n of connectome.neurons) {
    const key = `${n.neuronClass}_${n.region}`;
    if (!classRegionToSimGroup.has(key)) {
      classRegionToSimGroup.set(key, n.id);
    }
  }

  let id = 0;
  let unlocalized = 0;
  let nonNeurons = 0;
  for (const bn of bancData.neurons) {
    if (!isNeuron(bn.super_class)) { nonNeurons++; continue; } // glia/trachea are not neurons
    if (!bn.pos) { unlocalized++; continue; } // no real soma coordinate in BANC
    const neuronClass = neuronClassOf(bn.super_class, bn.cell_class, bn.nt);
    const nt = mapNT(bn.nt);
    // Real neuropil assignment from root_region (Ito et al. 2014 codes)
    const region = displayRegionOf(bn.root_region || '', bn.region);

    // Find simulation group: try cell type first, then class+region, then class only
    let simGroup = cellTypeToSimGroup.get(bn.cell_type);
    if (simGroup === undefined) {
      simGroup = classRegionToSimGroup.get(`${neuronClass}_${region}`);
    }
    if (simGroup === undefined) {
      // Find any neuron of same class
      for (const n of connectome.neurons) {
        if (n.neuronClass === neuronClass) { simGroup = n.id; break; }
      }
    }
    if (simGroup === undefined) simGroup = 0;

    neurons.push({
      id: id++,
      bancId: bn.banc_id,
      region,
      neuronClass,
      neurotransmitter: nt,
      position: bn.pos, // REAL position from BANC soma coordinates
      simulationGroupId: simGroup,
      dataSource: 'real', // ALL data is real
      cellType: bn.cell_type || undefined,
      cellClass: bn.cell_class || undefined,
      rootRegion: bn.root_region || undefined,
    });
  }

  console.log(`Generated ${neurons.length} brain neurons from REAL BANC data ` +
    `(${unlocalized} unlocalized neurons not rendered, ${nonNeurons} glia/non-neurons excluded)`);
  return neurons;
}
