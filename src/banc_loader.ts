// Real BANC v888 data loader
// Downloads and parses real neuron metadata and connectivity from preprocessed BANC data
//
// All data comes from Bates, Phelps, Kim, Yang et al. (2026) Nature.
// BANC v888 materialization, snapshotted April 17, 2026.
// Source: gs://lee-lab_brain-and-nerve-cord-fly-connectome/compiled_data/banc_888/
//
// NO MADE-UP DATA: every neuron, position, neurotransmitter, cell type, and
// connection statistic comes from the real BANC connectome.

import { NeuronClass, Neurotransmitter, BrainRegion } from './types';

// Raw BANC neuron data (from banc_neurons.json)
// pos is null when BANC has no soma coordinate for the neuron.
export interface BancNeuron {
  id: number;
  banc_id: string;
  pos: [number, number, number] | null;
  cell_type: string;
  super_class: string;
  cell_class: string;
  nt: string;
  region: string;
  root_region: string;
  side: string;
  flow: string;
  n_inputs: number;
  n_outputs: number;
}

// Raw BANC cell type data (from banc_cell_types.json)
export interface BancCellType {
  cell_type: string;
  count: number;
  super_class: string;
  cell_class: string;
  nt: string;
  region: string;
  flow: string;
}

// Raw BANC connection data (from banc_connections.bin)
// Stored as struct-of-arrays so the FULL ~3M-pair dataset stays in flat
// typed arrays (~100MB) instead of millions of JS objects (~1GB heap).
export interface BancConnections {
  count: number;
  typeNames: string[];          // index -> cell type name
  preType: Uint32Array;         // index into typeNames
  postType: Uint32Array;        // index into typeNames
  totalSynapses: Uint32Array;
  connectionCount: Uint32Array;
  meanSynapses: Float32Array;
  medianSynapses: Float32Array;
}

// Real display-region geometry (from banc_regions.json)
// Ellipsoid semi-axes derived from actual soma distributions (mean +/- 2 std).
export interface BancRegionStat {
  name: string;
  side: 'left' | 'right' | 'center';
  shape: 'ellipsoid' | 'tube';
  center: [number, number, number];
  size: [number, number, number];
  count: number;
}

// Coordinate normalization applied to every exported position (and applied
// in the browser to SWC skeletons fetched from the BANC repository).
export interface BancNorm {
  x_center: number;
  y_center: number;
  z_center: number;
  scale: number;
}

// Real per-neuron morphology metrics (banc_888_metrics.feather)
export interface BancMetrics {
  cable_um: number;
  in_conn: number;
  out_conn: number;
  axon_um: number;
  dend_um: number;
  branchpoints: number;
}

// Public BANC repository: real split-skeleton (SWC) files per neuron
export const BANC_SWC_BASE =
  'https://storage.googleapis.com/lee-lab_brain-and-nerve-cord-fly-connectome/compiled_data/banc_888/banc_banc_space_split_swc';

export function bancSwcUrl(bancId: string): string {
  return `${BANC_SWC_BASE}/${bancId}_split.swc`;
}

export interface BancData {
  neurons: BancNeuron[];
  cellTypes: BancCellType[];
  connections: BancConnections;
  regions: BancRegionStat[];
  norm: BancNorm | null;
  metadata: {
    source: string;
    version: string;
    neuronCount: number;
    cellTypeCount: number;
    connectionPairCount: number;
  };
}

// Map BANC super_class to our NeuronClass (real BANC v888 super_class values)
const SUPER_CLASS_MAP: Record<string, NeuronClass> = {
  'sensory': 'sensory',
  'sensory_ascending': 'sensory',
  'sensory_descending': 'sensory',
  'ascending': 'ascending',
  'ascending_visceral_circulatory': 'ascending',
  'descending': 'descending',
  'intrinsic': 'interneuron',
  'central_brain_intrinsic': 'interneuron',
  'ventral_nerve_cord_intrinsic': 'interneuron',
  'optic_lobe_intrinsic': 'visual',
  'visual_projection': 'visual',
  'visual_centrifugal': 'visual',
  'optic': 'visual',
  'motor': 'motor',
  'visceral_circulatory': 'motor',
  'glia': 'interneuron',
  'trachea': 'interneuron',
  'not_a_neuron': 'interneuron',
};

// BANC super_class values that are not neurons — excluded from the
// neuron point cloud and the simulation connectome.
const NON_NEURON_SUPER_CLASSES = new Set(['glia', 'trachea', 'not_a_neuron']);

export function isNeuron(superClass: string): boolean {
  return !NON_NEURON_SUPER_CLASSES.has(superClass);
}

// Combined classifier: real BANC cell_class overrides super_class where it
// carries finer functional meaning (Kenyon cells, MBONs, DANs, motor pools).
export function neuronClassOf(superClass: string, cellClass: string, nt: string): NeuronClass {
  if (cellClass === 'kenyon_cell') return 'kenyon';
  if (cellClass === 'mushroom_body_output_neuron') return 'mbon';
  if (cellClass === 'mushroom_body_dopaminergic_neuron' || nt === 'dopamine') return 'dopamine';
  if (cellClass === 'descending_neuron') return 'descending';
  if (cellClass === 'ascending_neuron') return 'ascending';
  if (cellClass.includes('motor_neuron')) return 'motor';
  return SUPER_CLASS_MAP[superClass] || 'interneuron';
}

// Map BANC region to our BrainRegion
const REGION_MAP: Record<string, BrainRegion> = {
  'central_brain': 'central_brain',
  'optic_lobe': 'optic_lobe',
  'mushroom_body': 'mushroom_body',
  'antennal_lobe': 'antennal_lobe',
  'suboesophageal_zone': 'suboesophageal_zone',
  'ventral_nerve_cord': 'ventral_nerve_cord',
  'cervical_connective': 'cervical_connective',
};

// Map a BANC root_region (Ito et al. 2014 neuropil code) to a display region.
// Mirrors display_region_of() in scripts/download_banc_data.py.
export function displayRegionOf(rootRegion: string, coarseRegion: string): BrainRegion {
  if (rootRegion.startsWith('ITO_optic')) return 'optic_lobe';
  const parts = rootRegion.split('_');
  const code = parts.length > 2 ? parts[2] : '';
  if (rootRegion.startsWith('ITO_midbrain')) {
    if (code === 'MB') return 'mushroom_body';
    if (code === 'AL') return 'antennal_lobe';
    if (code === 'GNG') return 'suboesophageal_zone'; // gnathal ganglion = SEZ
    return 'central_brain';
  }
  if (rootRegion.includes('_vnc_')) return 'ventral_nerve_cord';
  return mapRegion(coarseRegion);
}

// Map BANC neurotransmitter string to our Neurotransmitter type
const NT_MAP: Record<string, Neurotransmitter> = {
  'acetylcholine': 'acetylcholine',
  'gaba': 'gaba',
  'glutamate': 'glutamate',
  'dopamine': 'dopamine',
  'octopamine': 'octopamine',
  'serotonin': 'serotonin',
  'histamine': 'histamine',
  'tyramine': 'tyramine',
};

export function mapSuperClassToNeuronClass(superClass: string): NeuronClass {
  return SUPER_CLASS_MAP[superClass] || 'interneuron';
}

export function mapRegion(region: string): BrainRegion {
  return REGION_MAP[region] || 'central_brain';
}

export function mapNT(nt: string): Neurotransmitter {
  return NT_MAP[nt] || 'unknown';
}

let cachedData: BancData | null = null;

function emptyConnections(): BancConnections {
  return {
    count: 0,
    typeNames: [],
    preType: new Uint32Array(0),
    postType: new Uint32Array(0),
    totalSynapses: new Uint32Array(0),
    connectionCount: new Uint32Array(0),
    meanSynapses: new Float32Array(0),
    medianSynapses: new Float32Array(0),
  };
}

// Decode banc_connections.bin (see scripts/download_banc_data.py for layout)
function decodeConnectionsBin(buf: ArrayBuffer): BancConnections {
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let off = 0;

  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'BCN1') throw new Error(`Bad connections file magic: ${magic}`);
  off = 4;

  const nTypes = dv.getUint32(off, true); off += 4;
  const nPairs = dv.getUint32(off, true); off += 4;

  const td = new TextDecoder();
  const typeNames: string[] = new Array(nTypes);
  for (let i = 0; i < nTypes; i++) {
    const len = dv.getUint16(off, true); off += 2;
    typeNames[i] = td.decode(bytes.subarray(off, off + len));
    off += len;
  }

  off = (off + 3) & ~3;
  const take = <T extends Uint32Array | Float32Array>(ctor: { new(b: ArrayBuffer, o: number, n: number): T }, size: number): T => {
    const arr = new ctor(buf, off, nPairs);
    off += nPairs * size;
    return arr;
  };

  const connections: BancConnections = {
    count: nPairs,
    typeNames,
    preType: take(Uint32Array, 4),
    postType: take(Uint32Array, 4),
    totalSynapses: take(Uint32Array, 4),
    connectionCount: take(Uint32Array, 4),
    meanSynapses: take(Float32Array, 4),
    medianSynapses: take(Float32Array, 4),
  };
  return connections;
}

export async function loadBancData(dataDir: string = '/data'): Promise<BancData> {
  if (cachedData) return cachedData;

  console.log('Loading real BANC v888 data...');

  // Fetch all three data files
  const [neuronsRes, cellTypesRes, connectionsRes, regionsRes] = await Promise.all([
    fetch(`${dataDir}/banc_neurons.json`),
    fetch(`${dataDir}/banc_cell_types.json`),
    fetch(`${dataDir}/banc_connections.bin`).catch(() => null),
    fetch(`${dataDir}/banc_regions.json`).catch(() => null),
  ]);

  if (!neuronsRes.ok) {
    throw new Error(`Failed to load BANC neurons: ${neuronsRes.status} ${neuronsRes.statusText}`);
  }

  const neurons: BancNeuron[] = await neuronsRes.json();
  console.log(`  Loaded ${neurons.length} real BANC neurons`);

  let cellTypes: BancCellType[] = [];
  if (cellTypesRes.ok) {
    const ctData = await cellTypesRes.json();
    cellTypes = ctData.cell_types || [];
    console.log(`  Loaded ${cellTypes.length} cell types`);
  }

  let connections: BancConnections = emptyConnections();
  if (connectionsRes && connectionsRes.ok) {
    connections = decodeConnectionsBin(await connectionsRes.arrayBuffer());
    console.log(`  Loaded ${connections.count} cell-type connection pairs`);
  } else {
    console.log('  No connections file found (run with --skip-edgelist or download separately)');
  }

  let regions: BancRegionStat[] = [];
  let norm: BancNorm | null = null;
  if (regionsRes && regionsRes.ok) {
    const regData = await regionsRes.json();
    regions = regData.regions || [];
    norm = regData.norm || null;
    console.log(`  Loaded ${regions.length} real region boundaries`);
  }

  cachedData = {
    neurons,
    cellTypes,
    connections,
    regions,
    norm,
    metadata: {
      source: 'BANC v888 (Bates et al. 2026)',
      version: '888',
      neuronCount: neurons.length,
      cellTypeCount: cellTypes.length,
      connectionPairCount: connections.count,
    },
  };

  return cachedData;
}

// Check if BANC data files exist (for graceful fallback)
export async function hasBancData(dataDir: string = '/data'): Promise<boolean> {
  try {
    const res = await fetch(`${dataDir}/banc_neurons.json`, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

// Load real per-neuron morphology metrics (lazily — only the viewer needs them)
let cachedMetrics: Map<string, BancMetrics> | null = null;
export async function loadNeuronMetrics(dataDir: string = '/data'): Promise<Map<string, BancMetrics>> {
  if (cachedMetrics) return cachedMetrics;
  cachedMetrics = new Map();
  try {
    const res = await fetch(`${dataDir}/banc_metrics.json`);
    if (!res.ok) return cachedMetrics;
    const data = await res.json();
    const ids: string[] = data.ids.map(String);
    for (let i = 0; i < ids.length; i++) {
      const v = data.vals[i];
      cachedMetrics.set(ids[i], {
        cable_um: v[0], in_conn: v[1], out_conn: v[2],
        axon_um: v[3], dend_um: v[4], branchpoints: v[5],
      });
    }
    console.log(`  Loaded real morphology metrics for ${cachedMetrics.size} neurons`);
  } catch (e) {
    console.warn('banc_metrics.json unavailable:', e);
  }
  return cachedMetrics;
}
