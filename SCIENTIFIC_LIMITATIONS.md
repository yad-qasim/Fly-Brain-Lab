# Scientific Limitations

## A connectome is not a complete brain simulation

A connectome is a wiring diagram — a map of which neurons connect to which. It does not automatically specify:
- Membrane properties (ion channels, conductances, resting potentials)
- Receptor dynamics (AMPA, NMDA, GABA_A, GABA_B, nicotinic, muscarinic)
- Neuromodulatory context (dopamine, serotonin, octopamine levels)
- Glial interactions
- Electrical synapses (gap junctions)
- Neurogenesis or structural plasticity

## Synaptic wiring alone does not fully specify neural dynamics

The LIF model used here is a simplification. Real neurons have:
- Dendritic computation (non-linear integration)
- Active conductances (Na+, K+, Ca2+ channels)
- Bursting and adaptation
- Multiple receptor types with different time courses
- Voltage-gated channels that modify synaptic integration

## Neurotransmitter information may be incomplete

FlyWire neurotransmitter identities are computationally predicted (Eckstein et al. 2024), not experimentally verified for every neuron. Some neurons may co-release multiple neurotransmitters. Some predictions may be wrong.

## Behavioral mappings may be approximations

The mapping from neural activity to behavior (motor decoding) is our own simplification. Real Drosophila motor control involves:
- Central pattern generators in the ventral nerve cord
- Proprioceptive feedback
- Muscle biomechanics
- Hundreds of motor neurons controlling individual muscles

## The artificial dopamine reward is an experimental abstraction

Our reward signal is designed to demonstrate reinforcement learning. It is NOT:
- Biological dopamine
- A model of actual dopamine release kinetics
- A representation of dopamine receptor activation
- A model of dopamine synthesis or reuptake

It IS:
- An abstract signal that modulates synaptic plasticity
- Mapped onto biologically identified dopamine neurons (DANs)
- Used to modify KC→MBON synapses (the biological site of associative learning)

## The 3D fly body is a computational embodiment

Our procedural fly model is not:
- A biomechanical model (cf. FlyGym/NeuroMechFly)
- Based on micro-CT data
- Physically accurate

It IS:
- A visual representation for the experiment
- A simple kinematic body that moves based on motor output
- Sufficient for demonstrating the sensory→neural→motor loop

## Some neural regions may be simplified

Our reduced model has ~150 neurons representing key circuits. The full fly brain has 139,255 neurons. We preserve:
- Visual pathway structure (photoreceptors → lamina → medulla → lobula → VPNs)
- Mushroom body circuit (KCs → MBONs, DANs)
- Motor pathway (DNs → motor neurons)
- Key interneuron populations

We do NOT include:
- Full optic lobe circuitry (~53,000 neurons)
- Complete mushroom body (~2,000 KCs per hemisphere)
- Antennal lobe detail
- Central complex detail
- Complete descending/ascending neuron population

## Any learned behavior should not be interpreted as evidence of consciousness

This simulation demonstrates that:
- A connectome-derived neural network can produce variable motor output
- An external reward signal can modify synaptic weights
- Modified synapses can change the probability of certain motor patterns

This does NOT demonstrate:
- Consciousness or subjective experience
- Genuine biological understanding
- That the fly "knows" what it is doing
- That the fly "wants" to raise the flag

The learning is a mathematical consequence of the plasticity rule, not a cognitive process.
