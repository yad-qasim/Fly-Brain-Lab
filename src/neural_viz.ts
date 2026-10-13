// Full 3D CNS visualization: ~188,000 neurons with brain + VNC region meshes
// Shows the Drosophila CNS as published in BANC research (Bates et al. 2026)
//
// DATA SOURCE CLASSIFICATION:
// - Brain region shapes: REAL (bounding geometry from BANC soma positions
//   per root_region neuropil + side — no invented boundaries)
// - Neuron 3D positions: REAL (BANC v888 soma coordinates)
// - Neuron count (~188,000): REAL (from BANC v888)
// - Neuron colors by class: INVENTED (our color scheme for visualization)
// - Activity visualization: INVENTED (our rendering approach)

import * as THREE from 'three';
import { BrainNeuron, getRegionShapes, RegionShapeEntry } from './brain_data';
import { BancRegionStat } from './banc_loader';
import { NEURON_COLORS } from './config';
import { NeuralNetwork } from './neural';
import { ConnectomeData } from './types';

export class NeuralVisualization {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  container: HTMLElement;

  // Brain region meshes (semi-transparent)
  regionMeshes: THREE.Mesh[] = [];
  regionEdges: THREE.LineSegments[] = [];
  regionLabels: THREE.Sprite[] = [];
  // Activity circles per region (colorful filled circles)
  pulseCircles: THREE.Sprite[] = [];
  pulseData: { name: string; region: string; center: [number, number, number]; activity: number; phase: number; color: [number, number, number] }[] = [];

  // Real region geometry from BANC soma distributions
  regionShapes: RegionShapeEntry[];

  // Currently displayed real skeleton (SWC) for a picked neuron
  skeletonObj: THREE.LineSegments | null = null;

  // Neuron instances
  neuronMesh!: THREE.InstancedMesh;
  glowMesh!: THREE.InstancedMesh;
  brainNeurons: BrainNeuron[];
  connectome: ConnectomeData;

  // Activity mapping: simulationGroupId -> activity level
  simActivity: Float32Array;

  // Filtering
  activeFilter: string = 'all';

  // Raycaster
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  onClickCallback: ((neuronId: number) => void) | null = null;

  // Camera control
  cameraDistance: number = 4;
  cameraAngleY: number = 0.5;
  cameraAngleX: number = 0.3;
  cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  isDragging: boolean = false;
  lastMouseX: number = 0;
  lastMouseY: number = 0;

  // Auto-rotate
  autoRotate: boolean = true;
  rotateSpeed: number = 0.002;

  // Frame counter for throttled updates
  frameCount: number = 0;

  constructor(container: HTMLElement, brainNeurons: BrainNeuron[], connectome: ConnectomeData, regionStats: BancRegionStat[] = []) {
    this.container = container;
    this.brainNeurons = brainNeurons;
    this.connectome = connectome;
    this.regionShapes = getRegionShapes(regionStats);
    this.simActivity = new Float32Array(connectome.neurons.length);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f4f8);

    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.01, 100);
    this.camera.position.set(0, 1, 4);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.setupLighting();
    this.createBrainRegions();
    this.createNeurons();
    this.setupControls();
  }

  private setupLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dir1.position.set(5, 10, 5);
    this.scene.add(dir1);

    const dir2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dir2.position.set(-5, 5, -5);
    this.scene.add(dir2);

    const hemi = new THREE.HemisphereLight(0x88ccff, 0xffffff, 0.3);
    this.scene.add(hemi);
  }

  private createBrainRegions() {
    const shapes = this.regionShapes;

    // Create a canvas texture for region labels
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 64;
    const labelCtx = labelCanvas.getContext('2d')!;

    // Create a circle sprite texture for activity pulses
    const circleCanvas = document.createElement('canvas');
    circleCanvas.width = 128;
    circleCanvas.height = 128;
    const circleCtx = circleCanvas.getContext('2d')!;

    for (const { name, region, shape, color } of shapes) {
      // Higher detail mesh for scientific look; tubes are real cylinders
      // (VNC / cervical connective run along the longitudinal = Y axis)
      const geo = shape.type === 'tube'
        ? new THREE.CylinderGeometry(shape.size[0], shape.size[0], shape.size[1] * 2, 24, 1, true)
        : new THREE.SphereGeometry(1, 32, 24);
      const mat = new THREE.MeshPhongMaterial({
        color: new THREE.Color(color[0], color[1], color[2]),
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        depthWrite: false,
        shininess: 50,
        specular: 0x333333,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(shape.center[0], shape.center[1], shape.center[2]);
      if (shape.type !== 'tube') mesh.scale.set(shape.size[0], shape.size[1], shape.size[2]);
      if (shape.rotation) mesh.rotation.set(shape.rotation[0], shape.rotation[1], shape.rotation[2]);
      this.scene.add(mesh);
      this.regionMeshes.push(mesh);

      // Wireframe edges for anatomical boundary visibility
      const edgesGeo = shape.type === 'tube'
        ? new THREE.EdgesGeometry(new THREE.CylinderGeometry(shape.size[0], shape.size[0], shape.size[1] * 2, 12, 1, true))
        : new THREE.EdgesGeometry(new THREE.SphereGeometry(1, 16, 12));
      const edgesMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(color[0] * 0.6, color[1] * 0.6, color[2] * 0.6),
        transparent: true,
        opacity: 0.2,
      });
      const edges = new THREE.LineSegments(edgesGeo, edgesMat);
      edges.position.copy(mesh.position);
      if (shape.type !== 'tube') edges.scale.copy(mesh.scale);
      edges.rotation.copy(mesh.rotation);
      this.scene.add(edges);
      this.regionEdges.push(edges);

      // Region label (scientific neuropil name)
      labelCtx.clearRect(0, 0, 256, 64);
      labelCtx.fillStyle = 'rgba(40, 60, 80, 0.85)';
      labelCtx.font = 'bold 18px sans-serif';
      labelCtx.textAlign = 'center';
      const displayName = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      labelCtx.fillText(displayName, 128, 38);
      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, opacity: 0.7, depthTest: false });
      const label = new THREE.Sprite(labelMat);
      label.position.set(shape.center[0], shape.center[1] + shape.size[1] + 0.08, shape.center[2]);
      label.scale.set(0.35, 0.09, 1);
      this.scene.add(label);
      this.regionLabels.push(label);

      // Activity circle sprite (colorful filled circle that appears when active)
      circleCtx.clearRect(0, 0, 128, 128);
      const hexColor = `rgb(${Math.round(color[0]*255)},${Math.round(color[1]*255)},${Math.round(color[2]*255)})`;
      // Outer glow
      const grad = circleCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
      grad.addColorStop(0, hexColor);
      grad.addColorStop(0.4, hexColor);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      circleCtx.fillStyle = grad;
      circleCtx.fillRect(0, 0, 128, 128);
      // Inner bright circle
      circleCtx.fillStyle = hexColor;
      circleCtx.beginPath();
      circleCtx.arc(64, 64, 20, 0, Math.PI * 2);
      circleCtx.fill();
      circleCtx.fillStyle = 'rgba(255,255,255,0.6)';
      circleCtx.beginPath();
      circleCtx.arc(64, 64, 10, 0, Math.PI * 2);
      circleCtx.fill();

      const circleTex = new THREE.CanvasTexture(circleCanvas);
      const circleMat = new THREE.SpriteMaterial({
        map: circleTex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });
      const circle = new THREE.Sprite(circleMat);
      circle.position.set(shape.center[0], shape.center[1], shape.center[2]);
      circle.scale.set(0.01, 0.01, 1);
      this.scene.add(circle);
      this.pulseCircles.push(circle);
      this.pulseData.push({ name, region, center: shape.center, activity: 0, phase: 0, color });
    }
  }

  private createNeurons() {
    const count = this.brainNeurons.length;
    const geometry = new THREE.SphereGeometry(0.008, 6, 4);
    const material = new THREE.MeshPhongMaterial({
      vertexColors: false,
      transparent: true,
      opacity: 0.9,
    });

    this.neuronMesh = new THREE.InstancedMesh(geometry, material, count);
    this.neuronMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Glow mesh (larger, additive blending)
    const glowGeo = new THREE.SphereGeometry(0.02, 4, 3);
    const glowMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.glowMesh = new THREE.InstancedMesh(glowGeo, glowMat, count);
    this.glowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const n = this.brainNeurons[i];
      dummy.position.set(n.position[0], n.position[1], n.position[2]);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.neuronMesh.setMatrixAt(i, dummy.matrix);
      this.glowMesh.setMatrixAt(i, dummy.matrix);

      // Color by neuron class
      const c = NEURON_COLORS[n.neuronClass] || [0.5, 0.5, 0.5];
      color.setRGB(c[0] * 0.6, c[1] * 0.6, c[2] * 0.6);
      this.neuronMesh.setColorAt(i, color);
      this.glowMesh.setColorAt(i, color);
    }

    this.neuronMesh.instanceColor!.needsUpdate = true;
    this.glowMesh.instanceColor!.needsUpdate = true;
    this.scene.add(this.neuronMesh);
    this.scene.add(this.glowMesh);
  }

  private setupControls() {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      this.isDragging = true;
      this.autoRotate = false;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.isDragging) {
        this.cameraAngleY -= (e.clientX - this.lastMouseX) * 0.008;
        this.cameraAngleX = Math.max(-1.2, Math.min(1.2, this.cameraAngleX + (e.clientY - this.lastMouseY) * 0.008));
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    canvas.addEventListener('mouseup', () => { this.isDragging = false; });
    canvas.addEventListener('mouseleave', () => { this.isDragging = false; });

    canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      // Deep zoom: from whole-CNS overview down to individual neuropils
      this.cameraDistance = Math.max(0.03, Math.min(30, this.cameraDistance + e.deltaY * 0.01 * this.cameraDistance));
    });

    canvas.addEventListener('click', (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObject(this.neuronMesh);
      if (intersects.length > 0 && this.onClickCallback) {
        const instId = intersects[0].instanceId;
        if (instId !== undefined) this.onClickCallback(instId);
      }
    });
  }

  setFilter(filter: string) {
    this.activeFilter = filter;
    const dummy = new THREE.Object3D();

    // Region filter mapping
    const regionFilters = ['optic_lobe', 'central_brain', 'mushroom_body', 'antennal_lobe',
      'suboesophageal_zone', 'cervical_connective', 'ventral_nerve_cord'];
    const isRegionFilter = regionFilters.includes(filter);

    for (let i = 0; i < this.brainNeurons.length; i++) {
      const n = this.brainNeurons[i];
      let visible = true;

      if (filter !== 'all') {
        if (isRegionFilter) {
          // Filter by real neuropil region (bilateral sides share a region)
          visible = n.region === filter;
        } else {
          // Filter by neuron class
          if (filter === 'sensory') visible = n.neuronClass === 'sensory';
          else if (filter === 'visual') visible = n.neuronClass === 'visual';
          else if (filter === 'dopamine') visible = n.neuronClass === 'dopamine';
          else if (filter === 'kenyon') visible = n.neuronClass === 'kenyon';
          else if (filter === 'mbon') visible = n.neuronClass === 'mbon';
          else if (filter === 'motor') visible = n.neuronClass === 'motor' || n.neuronClass === 'descending';
        }
      }

      dummy.position.set(n.position[0], n.position[1], n.position[2]);
      dummy.scale.setScalar(visible ? 1 : 0.001);
      dummy.updateMatrix();
      this.neuronMesh.setMatrixAt(i, dummy.matrix);
      this.glowMesh.setMatrixAt(i, dummy.matrix);
    }
    this.neuronMesh.instanceMatrix.needsUpdate = true;
    this.glowMesh.instanceMatrix.needsUpdate = true;

    // Also show/hide region meshes and labels based on filter
    const shapes = this.regionShapes;
    for (let i = 0; i < this.regionMeshes.length; i++) {
      const shape = shapes[i];
      if (!shape) continue;
      const showMesh = filter === 'all' || shape.name === filter || shape.region === filter;
      const opacity = showMesh ? 0.06 : 0.01;
      (this.regionMeshes[i].material as THREE.MeshPhongMaterial).opacity = opacity;
      (this.regionEdges[i].material as THREE.LineBasicMaterial).opacity = showMesh ? 0.2 : 0.03;
      if (this.regionLabels[i]) {
        (this.regionLabels[i].material as THREE.SpriteMaterial).opacity = showMesh ? 0.7 : 0.1;
      }
    }
  }

  updateActivity(network: NeuralNetwork, externalActivity?: Float32Array) {
    // Get activity from the reduced simulation model (or a synced external
    // source — e.g. the fly's live brain broadcast from the main tab)
    const activity = externalActivity || network.getNeuronActivity();
    this.simActivity = activity;

    // Compute per-region average activity for pulse rings
    const regionSums = new Map<string, number>();
    const regionCounts = new Map<string, number>();
    for (const bn of this.brainNeurons) {
      const a = activity[bn.simulationGroupId] || 0;
      regionSums.set(bn.region, (regionSums.get(bn.region) || 0) + a);
      regionCounts.set(bn.region, (regionCounts.get(bn.region) || 0) + 1);
    }
    for (let i = 0; i < this.pulseData.length; i++) {
      const pd = this.pulseData[i];
      const sum = regionSums.get(pd.region) || 0;
      const count = regionCounts.get(pd.region) || 1;
      pd.activity = sum / count;
    }

    // Update neuron colors based on simulation group activity
    // Throttle: update every 3 frames for performance with ~188K neurons
    this.frameCount++;
    if (this.frameCount % 3 !== 0) return;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const batchSize = 50000;
    const offset = (this.frameCount * batchSize) % this.brainNeurons.length;

    for (let i = 0; i < batchSize && (offset + i) < this.brainNeurons.length; i++) {
      const idx = offset + i;
      const n = this.brainNeurons[idx];
      const a = activity[n.simulationGroupId] || 0;

      const baseColor = NEURON_COLORS[n.neuronClass] || [0.3, 0.3, 0.3];
      const intensity = 0.3 + a * 0.7;
      color.setRGB(baseColor[0] * intensity, baseColor[1] * intensity, baseColor[2] * intensity);
      this.neuronMesh.setColorAt(idx, color);

      // Glow for active neurons
      if (a > 0.3) {
        color.setRGB(baseColor[0], baseColor[1], baseColor[2]);
        this.glowMesh.setColorAt(idx, color);
        dummy.position.set(n.position[0], n.position[1], n.position[2]);
        dummy.scale.setScalar(1 + a * 3);
        dummy.updateMatrix();
        this.glowMesh.setMatrixAt(idx, dummy.matrix);
      } else {
        dummy.position.set(n.position[0], n.position[1], n.position[2]);
        dummy.scale.setScalar(0.3);
        dummy.updateMatrix();
        this.glowMesh.setMatrixAt(idx, dummy.matrix);
      }
    }

    this.neuronMesh.instanceColor!.needsUpdate = true;
    this.glowMesh.instanceColor!.needsUpdate = true;
    this.glowMesh.instanceMatrix.needsUpdate = true;
  }

  update() {
    if (this.autoRotate) {
      this.cameraAngleY += this.rotateSpeed;
    }

    const x = this.cameraTarget.x + this.cameraDistance * Math.cos(this.cameraAngleY) * Math.cos(this.cameraAngleX);
    const y = this.cameraTarget.y + this.cameraDistance * Math.sin(this.cameraAngleX);
    const z = this.cameraTarget.z + this.cameraDistance * Math.sin(this.cameraAngleY) * Math.cos(this.cameraAngleX);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cameraTarget);

    // Animate activity circles
    for (let i = 0; i < this.pulseCircles.length; i++) {
      const circle = this.pulseCircles[i];
      const pd = this.pulseData[i];
      const mat = circle.material as THREE.SpriteMaterial;

      if (pd.activity > 0.15) {
        // Active: show colorful circle, pulse outward
        pd.phase += 0.06;
        const pulse = 1 + Math.sin(pd.phase) * 0.25;
        const baseScale = 0.15 + pd.activity * 0.35;
        const scale = baseScale * pulse;
        circle.scale.set(scale, scale, 1);
        mat.opacity = 0.5 + pd.activity * 0.4 * (0.7 + Math.sin(pd.phase) * 0.3);
      } else {
        // Inactive: fade out
        pd.phase = 0;
        mat.opacity *= 0.88;
        if (mat.opacity < 0.01) mat.opacity = 0;
        circle.scale.set(0.01, 0.01, 1);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  onResize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  setVisible(visible: boolean) {
    this.renderer.domElement.style.display = visible ? 'block' : 'none';
  }

  // Render a REAL skeleton morphology (parsed SWC) around the picked soma.
  // verts/colors: flat xyz + rgb arrays (pairs = line segments).
  showSkeleton(verts: Float32Array, colors: Float32Array) {
    this.clearSkeleton();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
    });
    this.skeletonObj = new THREE.LineSegments(geo, mat);
    this.skeletonObj.frustumCulled = false;
    this.scene.add(this.skeletonObj);
  }

  clearSkeleton() {
    if (this.skeletonObj) {
      this.scene.remove(this.skeletonObj);
      this.skeletonObj.geometry.dispose();
      (this.skeletonObj.material as THREE.Material).dispose();
      this.skeletonObj = null;
    }
  }

  inspectNeuron(brainNeuronId: number): { id: number; bancId: string; region: string; neuronClass: string; neurotransmitter: string; cellType: string; cellClass: string; rootRegion: string; hemisphere: string; simGroupId: number; position: [number, number, number] } | null {
    if (brainNeuronId < 0 || brainNeuronId >= this.brainNeurons.length) return null;
    const n = this.brainNeurons[brainNeuronId];
    return {
      id: n.id,
      bancId: n.bancId || '',
      region: n.region,
      neuronClass: n.neuronClass,
      neurotransmitter: n.neurotransmitter,
      cellType: n.cellType || 'Unknown',
      cellClass: n.cellClass || 'Unknown',
      rootRegion: n.rootRegion || 'Unassigned',
      hemisphere: n.position[0] > 0.05 ? 'left' : n.position[0] < -0.05 ? 'right' : 'center',
      simGroupId: n.simulationGroupId,
      position: n.position,
    };
  }
}
