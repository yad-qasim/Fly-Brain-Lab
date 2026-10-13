# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     FLY CONNECTOME LAB                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐  │
│  │  3D     │   │ Sensory  │   │ Neural    │   │ Motor    │  │
│  │  World  │──▶│ System   │──▶│ Network   │──▶│ System   │  │
│  │         │   │          │   │ (LIF)     │   │          │  │
│  └────┬────┘   └──────────┘   └─────┬─────┘   └─────┬────┘  │
│       │                              │               │       │
│       │                              │               │       │
│       │                         ┌────▼────┐          │       │
│       │                         │ Reward  │          │       │
│       │                         │ System  │          │       │
│       │                         │ (DA)    │          │       │
│       │                         └────┬────┘          │       │
│       │                              │               │       │
│       │                              │               ▼       │
│  ┌────▼──────────────────────────────▼───────────────────┐  │
│  │              Experiment Controller                     │  │
│  │  (coordinates loop, collects stats, manages replay)   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────┐    │
│  │ Neural   │   │ Graph    │   │ Scientific Dashboard  │    │
│  │ Viz 3D   │   │ Renderer │   │ (stats, timeline,     │    │
│  │          │   │          │   │  inspector, export)   │    │
│  └──────────┘   └──────────┘   └──────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Module Descriptions

### `world.ts` — 3D World
- Three.js scene with procedural environment (floor, sky, lighting)
- Procedural Kurdish flag with cloth physics simulation
- Procedural fruit fly model (head, thorax, abdomen, legs, wings, eyes, antennae)
- Camera controls (orbit, zoom, pan, fly-follow, neural, debug)
- Raycasting for click inspection

### `connectome.ts` — Reduced Connectome Model
- Builds a reduced neural model derived from FlyWire FAFB v783
- ~150 neurons representing key cell types across brain regions
- Preserves real cell type names, neurotransmitter predictions, brain regions
- Creates population-level synaptic connections based on biological circuit architecture
- Each neuron/synapse tagged with data source: 'real', 'approximated', or 'invented'

### `neural.ts` — Neural Network (LIF Engine)
- Leaky Integrate-and-Fire simulation (Shiu et al. 2024 parameters)
- Sparse spike queue for efficient synaptic event delivery
- Dopamine-modulated Hebbian plasticity at KC→MBON synapses
- Activity tracking for visualization
- Save/load support for learned weights

### `sensory.ts` — Sensory System
- Computes simplified visual field from 3D environment
- Encodes flag position, brightness, color, motion into photoreceptor activity
- Does NOT provide symbolic information (no "flag_is_down = true")
- Injects activity into visual neurons (R1-R6, R7-R8) of the connectome

### `motor.ts` — Motor System
- Decodes motor neuron activity into movement commands
- Forward drive from overall motor activity
- Turn rate from left/right leg motor neuron difference
- Reach signal from descending neuron activity
- No hard-coded "fly.raise_flag()" — interaction emerges from motor patterns

### `reward.ts` — Reward/Dopamine System
- Generates artificial reward when fly successfully interacts with flag
- Activates dopamine neurons (DANs) in the neural network
- Tracks dopamine level, reward history, cooldown
- Supports 7 experimental modes (random, reward, high/low, delayed, removed, random)
- Dopamine modulates KC→MBON plasticity in the neural network

### `experiment.ts` — Experiment Controller
- Coordinates the full simulation loop
- Manages flag raising/lowering dynamics
- Collects statistics (attempts, successes, intervals, learning curve)
- Records state for replay
- Handles save/load and data export (CSV, JSON)

### `neural_viz.ts` — Neural Visualization
- 3D interactive brain activity viewer using Three.js
- Instanced meshes for efficient neuron rendering
- Synapse lines with additive blending
- Activity-based scaling and color intensity
- Filtering by neuron class (sensory, visual, dopamine, kenyon, mbon, motor)
- Click inspection of individual neurons

### `graphs.ts` — Graph Renderer
- Canvas 2D real-time graphs
- Flag interactions over time
- Success rate learning curve
- Reward and dopamine traces
- Neural activity (active neurons, spike rate)

### `main.ts` — Application Entry Point
- Initializes all modules
- Manages UI events and state
- Animation loop (60fps render + simulation stepping)
- Inspector for neurons, fly, and flag
- Scientific limitations panel

## Data Flow

```
1. Environment state (fly pos, flag pos) → SensorySystem.computeVisualInput()
2. Visual field → SensorySystem.injectIntoNetwork() → NeuralNetwork.injectCurrent()
3. NeuralNetwork.step() → LIF dynamics → spikes → synaptic propagation
4. NeuralNetwork.getMotorActivity() → MotorSystem.decodeMotorOutput()
5. MotorSystem.applyMovement() → FlyState updated
6. MotorSystem.isAttemptingInteraction() → if near flag & reaching → flag raised
7. RewardSystem.onFlagInteraction() → dopamine release → NeuralNetwork.releaseDopamine()
8. NeuralNetwork.applyPlasticity() → KC→MBON weights modified
9. Modified weights → changed motor output probability → future behavior
10. Flag auto-lowers after configurable time → cycle repeats
```

## File Structure

```
fruitfly/
├── index.html              # Main HTML with UI layout
├── package.json            # Node.js dependencies
├── vite.config.ts          # Vite build configuration
├── tsconfig.json           # TypeScript configuration
├── RESEARCH.md             # Research notes
├── THIRD_PARTY.md          # Third-party resources and licenses
├── SCIENTIFIC_LIMITATIONS.md  # Scientific limitations
├── README.md               # Setup and usage instructions
├── ARCHITECTURE.md         # This file
├── scripts/
│   └── preprocess_connectome.py  # FlyWire data preprocessing
└── src/
    ├── main.ts             # Application entry point
    ├── types.ts            # TypeScript type definitions
    ├── config.ts           # Configuration constants
    ├── connectome.ts       # Reduced connectome model builder
    ├── neural.ts           # LIF neural network engine
    ├── sensory.ts          # Sensory system (visual input)
    ├── motor.ts            # Motor system (neural→movement)
    ├── reward.ts           # Reward/dopamine system
    ├── experiment.ts       # Experiment controller
    ├── world.ts            # 3D world (Three.js)
    ├── neural_viz.ts        # Neural visualization (Three.js)
    ├── graphs.ts           # Real-time graph rendering
    └── styles.css          # UI styles
```
