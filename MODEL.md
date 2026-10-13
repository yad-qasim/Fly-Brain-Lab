# Neural Model Documentation

## Neuron Model: Leaky Integrate-and-Fire (LIF)

### Choice Justification

We use the LIF model as described in Shiu et al. (2024), "A Drosophila computational brain model reveals sensorimotor processing," *Nature*. This model was chosen because:

1. **Validated on Drosophila**: Shiu et al. demonstrated that LIF with FlyWire connectivity accurately predicts sensorimotor transformations
2. **Single free parameter**: Only W_syn (synaptic weight) needs fitting — all other parameters come from electrophysiology
3. **Computational feasibility**: LIF is the simplest model that captures spiking dynamics, enabling real-time simulation
4. **Proven predictive power**: The model correctly predicted neurons required for feeding and grooming behaviors

### Parameters (from Shiu et al. 2024)

| Parameter | Value | Source |
|-----------|-------|--------|
| Resting potential | -52.0 mV | Drosophila electrophysiology |
| Firing threshold | -45.0 mV | Drosophila electrophysiology |
| Reset potential | -52.0 mV | Drosophila electrophysiology |
| Membrane time constant (τ_m) | 20.0 ms | Drosophila electrophysiology |
| Refractory period | 2.0 ms | Drosophila electrophysiology |
| Synaptic weight (W_syn) | 0.275 mV | Free parameter, fitted by Shiu et al. |

### Dynamics

```
dV/dt = (V_rest - V) / τ_m + I_syn

if V >= V_threshold:
    V ← V_reset
    enter refractory period
    emit spike to all downstream synapses
```

Synaptic current uses alpha-function approximation:
```
I_syn = Σ (W_syn × weight × sign(NT))
```

where sign(NT) = +1 for excitatory (acetylcholine) and -1 for inhibitory (GABA, glutamate).

## Reduced Connectome Model

### Full vs. Reduced

| Metric | Full FlyWire | Our Reduced Model |
|--------|-------------|-------------------|
| Neurons | 139,255 | ~150 |
| Synapses | 54,500,000 | ~500 |
| Cell types | 8,453 | ~30 representative |
| Brain regions | All neuropils | 5 key regions |

### Neuron Populations

#### Visual System (from Matsliah et al. 2024)
- Photoreceptors R1-R6 (motion): 8 units
- Photoreceptors R7-R8 (color): 4 units
- Lamina L1 (ON pathway): 6 units
- Lamina L2 (OFF pathway): 6 units
- Lamina L3 (contrast): 6 units
- Medulla Mi1: 4 units
- Medulla Tm1-Tm9: 4 units
- Lobula T4 (ON-direction selective): 4 units
- Lobula T5 (OFF-direction selective): 4 units
- Visual Projection Neurons: 6 units

#### Mushroom Body (from Aso et al. 2014, Takemura et al. 2017)
- Kenyon Cells: 40 units (sparse coding)
- MB Output Neurons: 8 types (valence encoding)
- Dopaminergic Neurons: 8 types (PAM/PPL1 clusters)

#### Central Brain
- Projection Neurons: 6 (olfactory relay)
- Lateral Horn Neurons: 4 (innate response)
- Central Complex: 4 (navigation/heading)

#### Motor System
- Descending Neurons: 8 (brain→VNC)
- Motor Neurons: 8 (legs, wings)

#### SEZ
- Sensory neurons: 4 (gustatory/mechanosensory)

### Connectivity Architecture

Connections follow the biological circuit architecture:

```
Visual: R1-R6 → L1/L2/L3 → Mi1/Tm → T4/T5 → VPNs → Central Brain
Olfactory: ORNs → PNs → KCs (sparse) → MBONs → DNs → MNs
Reward: DANs → KC↔MBON synapses (dopamine modulation)
Motor: DNs → MNs (leg/wing control)
Feedback: MBONs → DANs (prediction error), MBONs → CX (memory-guided navigation)
```

## Dopamine / Reward System

### Biological Basis

The Drosophila mushroom body has 16 compartments, each with:
- Kenyon Cell (KC) axons (sparse sensory representation)
- MB Output Neuron (MBON) dendrites (valence encoding)
- Dopaminergic Neuron (DAN) terminals (reinforcement signal)

When DANs are active and KCs are firing, the KC→MBON synapse is modified. This is the biological basis of associative learning in Drosophila.

### Our Implementation

1. **Reward event**: Fly successfully interacts with flag
2. **Dopamine release**: `network.releaseDopamine(amount)` activates all DAN neurons
3. **Dopamine level**: Tracked as `dopamineLevel` (0-1), decays exponentially
4. **Plasticity**: At each KC→MBON synapse where the KC was recently active:
   ```
   Δw = learning_rate × dopamine_level × kc_activity × dt
   w_new = clamp(w_old + Δw, 0.01, 5.0)
   ```
5. **Behavioral effect**: Modified KC→MBON weights change MBON activity → changed DN activity → changed motor output

### Experimental Modes

| Mode | Reward | Description |
|------|--------|-------------|
| A: Random Control | None | Baseline neural behavior without reward |
| B: Reward | 1.0× | Standard reward for flag interaction |
| C: High Reward | 3.0× | Strong reward signal |
| D: Low Reward | 0.3× | Weak reward signal |
| E: Delayed Reward | 1.0× (2s delay) | Reward delivered after delay |
| F: Reward Removed | 0.0× (after training) | Train then remove reward |
| G: Random Reward | 1.0× (random) | Reward unrelated to behavior |

## Sensory Encoding

### Visual Field Model

The fly has 8 visual sectors covering ~270° field of view. For each sector:
- **Brightness**: Computed from distance to flag and flag raised state
- **Color**: Red and green channels from Kurdish flag colors
- **Motion**: Based on flag wave amplitude

This is NOT symbolic input. The fly does not receive "flag_is_down = true". It receives brightness and color patterns that its visual neurons must process.

### Photoreceptor Mapping

- R1-R6 (motion photoreceptors): Receive brightness + motion signals
- R7-R8 (color photoreceptors): Receive color channel signals
- Signals are injected as current into photoreceptor neurons
- Visual processing then flows through lamina → medulla → lobula → VPNs

## Motor Decoding

### Neural → Movement

Motor output is decoded from neural activity:
- **Forward drive**: Sum of leg + wing motor neuron activity (normalized)
- **Turn rate**: Difference between right and left leg motor activity
- **Reach signal**: Descending neuron activity (represents reaching/grasping)

### Interaction Detection

The fly interacts with the flag when:
1. It is within `interactionDistance` (2.0 units) of the flagpole
2. Its descending neuron activity produces a reach signal > 0.25

This is NOT hard-coded. The reach signal comes from neural activity flowing through the connectome. If the neural network does not produce sufficient DN activity, no interaction occurs.
