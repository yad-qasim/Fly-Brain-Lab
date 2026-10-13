// 3D World: Scene, environment, Kurdish flag with physics, and procedural fruit fly model
// Uses Three.js for WebGL rendering
//
// DATA SOURCE CLASSIFICATION:
// - 3D environment: INVENTED (our own design)
// - Kurdish flag: INVENTED (procedural, based on standard flag design)
// - Fly model: INVENTED (procedural, inspired by Drosophila morphology)
// - Flag physics: INVENTED (simplified cloth simulation)
// - Lighting/camera: INVENTED

import * as THREE from 'three';
import { WORLD, KURDISH_FLAG, NEURON_COLORS, NEURAL_VIZ } from './config';
import { FlyState, FlagState, ViewMode } from './types';

export class World3D {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  clock: THREE.Clock;
  // Objects
  flagPole!: THREE.Group;
  flag!: THREE.Mesh;
  flagCloth!: THREE.Mesh;
  flagRope!: THREE.Line;
  flagButton!: THREE.Mesh;
  flagButtonGlow!: THREE.Mesh;
  fly!: THREE.Group;
  flyParts: { [key: string]: THREE.Object3D } = {};
  floor!: THREE.Mesh;
  // Camera control
  cameraTarget: THREE.Vector3;
  cameraDistance: number;
  cameraAngleY: number;
  cameraAngleX: number;
  isDragging: boolean;
  isPanning: boolean;
  lastMouseX: number;
  lastMouseY: number;
  viewMode: ViewMode = 'world';
  // Fly state
  flyState: FlyState;
  // Flag state
  flagState: FlagState;
  flagRaiseTime: number = 0;
  // Wind
  windPhase: number = 0;
  // Flag cloth vertices
  flagVertices!: THREE.BufferAttribute;
  flagOriginalPositions!: Float32Array;
  // Raycaster for clicking
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  onClickCallback: ((obj: string, data?: any) => void) | null = null;
  // Movement trail (line tracing the fly's path)
  trailGeo: THREE.BufferGeometry = new THREE.BufferGeometry();
  trailAttr!: THREE.BufferAttribute;
  trailData: Float32Array = new Float32Array(3000 * 3);
  trailCount: number = 0;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xc8d8e8, 25, 60);
    this.scene.background = new THREE.Color(0xb8d0e8);

    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
    this.cameraDistance = 12;
    this.cameraAngleY = Math.PI / 4;
    this.cameraAngleX = 0.3;
    this.cameraTarget = new THREE.Vector3(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.isDragging = false;
    this.isPanning = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    this.flyState = {
      position: [...WORLD.flyStartPos] as [number, number, number],
      velocity: [0, 0, 0],
      orientation: 0,
      behavior: 'idle',
      speed: 0,
    };

    this.flagState = {
      raised: false,
      height: 0,
      wind: 0.3,
      interactionState: 'none',
      waveAmplitude: 0,
    };

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.setupLighting();
    this.createEnvironment();
    this.createFlag();
    this.createFly();
    this.setupCameraControls();

    window.addEventListener('resize', () => this.onResize());
  }

  private setupLighting() {
    // Bright ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambient);

    // Main directional light (bright sun)
    const sun = new THREE.DirectionalLight(0xfffff0, 1.5);
    sun.position.set(8, 20, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    this.scene.add(sun);

    // Fill light
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-5, 10, -5);
    this.scene.add(fill);

    // Hemisphere light for bright ambient
    const hemi = new THREE.HemisphereLight(0x88bbff, 0xeeffdd, 0.6);
    this.scene.add(hemi);
  }

  private createEnvironment() {
    // Sky gradient background
    const skyGeo = new THREE.SphereGeometry(40, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x4a90d8) },
        bottomColor: { value: new THREE.Color(0xc8d8e8) },
        offset: { value: 5 },
        exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(WORLD.floorSize, WORLD.floorSize, 32, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x88aa66,
      roughness: 0.9,
      metalness: 0.0,
    });
    this.floor = new THREE.Mesh(floorGeo, floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    // Grid
    const grid = new THREE.GridHelper(WORLD.floorSize, 20, 0x558844, 0x446633);
    (grid.material as THREE.Material).opacity = 0.3;
    (grid.material as THREE.Material).transparent = true;
    this.scene.add(grid);

    // Some decorative rocks/objects
    for (let i = 0; i < 5; i++) {
      const rockGeo = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.3, 0);
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7a6a, roughness: 0.9 });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(
        (Math.random() - 0.5) * (WORLD.floorSize - 2),
        0,
        (Math.random() - 0.5) * (WORLD.floorSize - 2),
      );
      rock.castShadow = true;
      rock.receiveShadow = true;
      // Don't place rocks near the flag
      if (Math.abs(rock.position.x - WORLD.flagPoleX) < 2 && Math.abs(rock.position.z - WORLD.flagPoleZ) < 2) {
        continue;
      }
      this.scene.add(rock);
    }
  }

  private createFlag() {
    this.flagPole = new THREE.Group();
    this.flagPole.position.set(WORLD.flagPoleX, 0, WORLD.flagPoleZ);

    // Pole
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, WORLD.flagPoleHeight, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x808890, metalness: 0.8, roughness: 0.3 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = WORLD.flagPoleHeight / 2;
    pole.castShadow = true;
    this.flagPole.add(pole);

    // Pole top
    const topGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const topMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.9, roughness: 0.2 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = WORLD.flagPoleHeight;
    this.flagPole.add(top);

    // Flag cloth (procedural Kurdish flag)
    const flagW = WORLD.flagSize.width;
    const flagH = WORLD.flagSize.height;
    const segments = 20;
    const flagGeo = new THREE.PlaneGeometry(flagW, flagH, segments, segments / 2);

    // Create Kurdish flag texture
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 320;
    const ctx = canvas.getContext('2d')!;

    // Red stripe (top)
    ctx.fillStyle = `rgb(${KURDISH_FLAG.red.map(c => Math.round(c * 255)).join(',')})`;
    ctx.fillRect(0, 0, 480, 107);

    // White stripe (middle)
    ctx.fillStyle = `rgb(${KURDISH_FLAG.white.map(c => Math.round(c * 255)).join(',')})`;
    ctx.fillRect(0, 107, 480, 106);

    // Green stripe (bottom)
    ctx.fillStyle = `rgb(${KURDISH_FLAG.green.map(c => Math.round(c * 255)).join(',')})`;
    ctx.fillRect(0, 213, 480, 107);

    // Golden sun in center
    const cx = 240, cy = 160;
    const sunRadius = 50;
    const sunColor = `rgb(${KURDISH_FLAG.sunYellow.map(c => Math.round(c * 255)).join(',')})`;

    // Sun rays
    ctx.strokeStyle = sunColor;
    ctx.lineWidth = 4;
    for (let i = 0; i < KURDISH_FLAG.sunRays; i++) {
      const angle = (i / KURDISH_FLAG.sunRays) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * (sunRadius + 5), cy + Math.sin(angle) * (sunRadius + 5));
      ctx.lineTo(cx + Math.cos(angle) * (sunRadius + 20), cy + Math.sin(angle) * (sunRadius + 20));
      ctx.stroke();
    }

    // Sun circle
    ctx.fillStyle = sunColor;
    ctx.beginPath();
    ctx.arc(cx, cy, sunRadius, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const flagMat = new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
      roughness: 0.7,
      metalness: 0.0,
    });

    this.flagCloth = new THREE.Mesh(flagGeo, flagMat);
    this.flagCloth.position.set(flagW / 2 + 0.05, 2.35, 0); // Start at 50% height (lowered)
    this.flagCloth.castShadow = true;
    this.flagCloth.receiveShadow = true;
    this.flagPole.add(this.flagCloth);

    // Store original positions for cloth simulation
    const positions = this.flagCloth.geometry.attributes.position;
    this.flagVertices = positions as THREE.BufferAttribute;
    this.flagOriginalPositions = new Float32Array(positions.array);

    // Rope from pole top to flag (dynamic)
    const ropeGeo = new THREE.BufferGeometry();
    const ropePoints = [
      new THREE.Vector3(0, WORLD.flagPoleHeight, 0),
      new THREE.Vector3(flagW / 2 + 0.05, 2.35, 0),
    ];
    ropeGeo.setFromPoints(ropePoints);
    const ropeMat = new THREE.LineBasicMaterial({ color: 0x666666 });
    this.flagRope = new THREE.Line(ropeGeo, ropeMat);
    this.flagPole.add(this.flagRope);

    this.flag = this.flagCloth;

    // Button next to the flag (at the lowered flag position, to the side)
    const buttonBaseGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.1, 16);
    const buttonBaseMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.3 });
    const buttonBase = new THREE.Mesh(buttonBaseGeo, buttonBaseMat);
    buttonBase.position.set(0.6, 0.45, 0);
    buttonBase.castShadow = true;
    buttonBase.receiveShadow = true;
    this.flagPole.add(buttonBase);

    // Button top (red, visible) - next to the flag
    const buttonGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16);
    const buttonMat = new THREE.MeshStandardMaterial({
      color: 0xff3333,
      emissive: 0xff0000,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      metalness: 0.1,
    });
    this.flagButton = new THREE.Mesh(buttonGeo, buttonMat);
    this.flagButton.position.set(0.6, 0.53, 0);
    this.flagButton.castShadow = true;
    this.flagButton.name = 'flagButton';
    this.flagPole.add(this.flagButton);

    // Glow ring around button
    const glowGeo = new THREE.RingGeometry(0.14, 0.22, 24);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.flagButtonGlow = new THREE.Mesh(glowGeo, glowMat);
    this.flagButtonGlow.rotation.x = -Math.PI / 2;
    this.flagButtonGlow.position.set(0.6, 0.5, 0);
    this.flagPole.add(this.flagButtonGlow);

    this.scene.add(this.flagPole);

    // Movement trail line (fly's path over time)
    this.trailAttr = new THREE.BufferAttribute(this.trailData, 3);
    this.trailAttr.setUsage(THREE.DynamicDrawUsage);
    this.trailGeo.setAttribute('position', this.trailAttr);
    this.trailGeo.setDrawRange(0, 0);
    const trail = new THREE.Line(this.trailGeo, new THREE.LineBasicMaterial({
      color: 0x1a2a1a,
      transparent: true,
      opacity: 0.55,
    }));
    trail.frustumCulled = false;
    this.scene.add(trail);
  }

  private createFly() {
    this.fly = new THREE.Group();

    // Body materials - fruit fly colors
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.5, metalness: 0.15 });
    const thoraxMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.4, metalness: 0.2 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xcc2200, roughness: 0.1, metalness: 0.6, emissive: 0x440000 });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xddeeff,
      transparent: true,
      opacity: 0.35,
      roughness: 0.05,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.7 });
    const bristleMat = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.9 });

    // Head - rounded with slight flatten
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 16), bodyMat);
    head.position.set(0, 0, 0.18);
    head.scale.set(1, 0.9, 1.1);
    head.castShadow = true;
    this.fly.add(head);
    this.flyParts['head'] = head;

    // Compound eyes - large, red, covering most of head sides
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 16), eyeMat);
    leftEye.position.set(-0.06, 0.02, 0.22);
    leftEye.scale.set(0.85, 1, 0.7);
    this.fly.add(leftEye);
    this.flyParts['leftEye'] = leftEye;

    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 16), eyeMat);
    rightEye.position.set(0.06, 0.02, 0.22);
    rightEye.scale.set(0.85, 1, 0.7);
    this.fly.add(rightEye);
    this.flyParts['rightEye'] = rightEye;

    // Thorax - elongated, slightly humped (mesothorax)
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), thoraxMat);
    thorax.position.set(0, 0.01, 0);
    thorax.scale.set(1, 0.85, 1.5);
    thorax.castShadow = true;
    this.fly.add(thorax);
    this.flyParts['thorax'] = thorax;

    // Scutellum (small bump at back of thorax)
    const scutellum = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), thoraxMat);
    scutellum.position.set(0, 0.06, -0.1);
    scutellum.scale.set(1, 0.5, 0.8);
    this.fly.add(scutellum);

    // Abdomen - tapered, segmented look
    const abdomen = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.18, 8, 16), bodyMat);
    abdomen.position.set(0, -0.01, -0.22);
    abdomen.rotation.x = Math.PI / 2;
    abdomen.scale.set(1, 1, 1.2);
    abdomen.castShadow = true;
    this.fly.add(abdomen);
    this.flyParts['abdomen'] = abdomen;

    // Abdomen stripes (dark bands)
    for (let s = 0; s < 3; s++) {
      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(0.085, 0.008, 4, 16),
        bristleMat
      );
      stripe.position.set(0, -0.01, -0.15 - s * 0.08);
      stripe.rotation.y = Math.PI / 2;
      this.fly.add(stripe);
    }

    // Wings - larger, more realistic shape
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.quadraticCurveTo(0.15, 0.08, 0.28, 0.02);
    wingShape.quadraticCurveTo(0.22, -0.06, 0, -0.02);
    wingShape.lineTo(0, 0);
    const wingGeo = new THREE.ShapeGeometry(wingShape);

    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.set(-0.05, 0.06, -0.02);
    leftWing.rotation.set(0, 0, -0.15);
    this.fly.add(leftWing);
    this.flyParts['leftWing'] = leftWing;

    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(0.05, 0.06, -0.02);
    rightWing.rotation.set(0, 0, 0.15);
    rightWing.scale.x = -1; // mirror
    this.fly.add(rightWing);
    this.flyParts['rightWing'] = rightWing;

    // Halteres (small balancing organs behind wings - characteristic of dipterans)
    const haltereMat = new THREE.MeshStandardMaterial({ color: 0xddccaa, roughness: 0.6 });
    const leftHaltere = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), haltereMat);
    leftHaltere.position.set(-0.04, 0.04, -0.08);
    this.fly.add(leftHaltere);
    const rightHaltere = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), haltereMat);
    rightHaltere.position.set(0.04, 0.04, -0.08);
    this.fly.add(rightHaltere);

    // Legs (6 legs) - with joints (coxa, femur, tibia)
    const legPositions = [
      [-0.07, -0.04, 0.1], [-0.07, -0.04, 0.02], [-0.07, -0.04, -0.06],
      [0.07, -0.04, 0.1], [0.07, -0.04, 0.02], [0.07, -0.04, -0.06],
    ];
    legPositions.forEach((pos, i) => {
      const legGroup = new THREE.Group();
      // Femur
      const femur = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.08, 6), legMat);
      femur.position.y = -0.04;
      legGroup.add(femur);
      // Tibia
      const tibia = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.08, 6), legMat);
      tibia.position.y = -0.12;
      tibia.rotation.x = 0.3;
      legGroup.add(tibia);
      // Tarsus (foot)
      const tarsus = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.04, 6), legMat);
      tarsus.position.set(0.01, -0.18, 0.01);
      tarsus.rotation.x = 0.6;
      legGroup.add(tarsus);

      legGroup.position.set(pos[0], pos[1], pos[2]);
      legGroup.rotation.z = pos[0] > 0 ? 0.25 : -0.25;
      this.fly.add(legGroup);
      this.flyParts[`leg${i}`] = legGroup;
    });

    // Antennae (arista type - characteristic of Drosophila)
    const antMat = new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.7 });
    const leftAntBase = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), antMat);
    leftAntBase.position.set(-0.03, 0.05, 0.24);
    this.fly.add(leftAntBase);
    const leftAnt = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.006, 0.08, 4), antMat);
    leftAnt.position.set(-0.035, 0.08, 0.26);
    leftAnt.rotation.x = -0.8;
    leftAnt.rotation.z = -0.2;
    this.fly.add(leftAnt);
    this.flyParts['leftAntenna'] = leftAnt;

    const rightAntBase = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), antMat);
    rightAntBase.position.set(0.03, 0.05, 0.24);
    this.fly.add(rightAntBase);
    const rightAnt = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.006, 0.08, 4), antMat);
    rightAnt.position.set(0.035, 0.08, 0.26);
    rightAnt.rotation.x = -0.8;
    rightAnt.rotation.z = 0.2;
    this.fly.add(rightAnt);
    this.flyParts['rightAntenna'] = rightAnt;

    // Scale up the fly for visibility
    this.fly.scale.set(3, 3, 3);
    this.fly.position.set(...this.flyState.position);
    this.fly.castShadow = true;
    this.scene.add(this.fly);
  }

  private setupCameraControls() {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      if (e.button === 2 || e.shiftKey) this.isPanning = true;
    });

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.isDragging) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        if (this.isPanning) {
          const panSpeed = 0.01;
          const right = new THREE.Vector3();
          this.camera.getWorldDirection(right);
          right.cross(new THREE.Vector3(0, 1, 0)).normalize();
          this.cameraTarget.addScaledVector(right, -dx * panSpeed * this.cameraDistance);
          this.cameraTarget.y -= dy * panSpeed * this.cameraDistance;
        } else {
          this.cameraAngleY -= dx * 0.01;
          this.cameraAngleX = Math.max(-0.5, Math.min(1.2, this.cameraAngleX + dy * 0.01));
        }
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.isPanning = false;
    });

    canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      this.cameraDistance = Math.max(2, Math.min(30, this.cameraDistance + e.deltaY * 0.01));
    });

    canvas.addEventListener('contextmenu', (e: Event) => e.preventDefault());

    canvas.addEventListener('click', (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.handleClick();
    });
  }

  private handleClick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects([this.fly, this.flagCloth, this.flagPole], true);
    if (intersects.length > 0) {
      const obj = intersects[0].object;
      if (this.onClickCallback) {
        if (obj === this.flagCloth || obj.parent === this.flagPole) {
          this.onClickCallback('flag');
        } else {
          this.onClickCallback('fly');
        }
      }
    }
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
  }

  updateFlyState(pos: [number, number, number], orientation: number, behavior: string, speed: number) {
    this.flyState.position = pos;
    this.flyState.orientation = orientation;
    this.flyState.behavior = behavior;
    this.flyState.speed = speed;

    // Update fly 3D position - raised above ground so legs don't sink
    this.fly.position.set(pos[0], 0.6, pos[2]);
    this.fly.rotation.y = orientation;

    // Record movement trail (append when the fly has actually moved)
    const ti = (this.trailCount - 1) * 3;
    const moved = this.trailCount === 0 ||
      Math.abs(pos[0] - this.trailData[ti]) + Math.abs(pos[2] - this.trailData[ti + 2]) > 0.04;
    if (moved) {
      if (this.trailCount >= 3000) {
        this.trailData.copyWithin(0, 1500 * 3);
        this.trailCount = 1500;
      }
      this.trailData.set([pos[0], 0.06, pos[2]], this.trailCount * 3);
      this.trailCount++;
      this.trailGeo.setDrawRange(0, this.trailCount);
      this.trailAttr.needsUpdate = true;
    }

    // Wing flapping animation
    const wingSpeed = behavior === 'flying' ? 30 : behavior === 'walking' ? 10 : 3;
    const t = this.clock.getElapsedTime();
    const flap = Math.sin(t * wingSpeed) * 0.5;
    (this.flyParts['leftWing'] as THREE.Mesh).rotation.z = -0.2 + flap;
    (this.flyParts['rightWing'] as THREE.Mesh).rotation.z = 0.2 - flap;

    // Leg movement
    if (behavior === 'walking') {
      for (let i = 0; i < 6; i++) {
        const leg = this.flyParts[`leg${i}`] as THREE.Mesh;
        leg.rotation.x = Math.sin(t * 8 + i * Math.PI / 3) * 0.2;
      }
    }
  }

  updateFlagState(raised: boolean, height: number, wind: number, interactionState: string) {
    this.flagState.raised = raised;
    this.flagState.height = height;
    this.flagState.wind = wind;
    this.flagState.interactionState = interactionState as any;

    // Flag slides up the pole: 0.5 (lowered) to flagPoleHeight-0.8 (raised)
    const flagY = 0.5 + height * (WORLD.flagPoleHeight - 1.3);
    this.flagCloth.position.y = flagY;

    // Update rope to follow flag
    const ropePos = this.flagRope.geometry.attributes.position;
    ropePos.setY(1, flagY);
    ropePos.needsUpdate = true;

    // Update button visual state
    const buttonMat = this.flagButton.material as THREE.MeshStandardMaterial;
    const glowMat = this.flagButtonGlow.material as THREE.MeshBasicMaterial;
    if (interactionState === 'touching') {
      buttonMat.emissiveIntensity = 1.0;
      buttonMat.color.setHex(0xff6666);
      glowMat.opacity = 0.8;
      this.flagButton.position.y = 0.50;
      this.flagButtonGlow.scale.setScalar(1.2);
    } else if (interactionState === 'approaching') {
      buttonMat.emissiveIntensity = 0.5;
      buttonMat.color.setHex(0xff4444);
      glowMat.opacity = 0.5;
      this.flagButton.position.y = 0.53;
      this.flagButtonGlow.scale.setScalar(1.0);
    } else {
      buttonMat.emissiveIntensity = 0.3;
      buttonMat.color.setHex(0xff3333);
      glowMat.opacity = 0.4;
      this.flagButton.position.y = 0.53;
      this.flagButtonGlow.scale.setScalar(1.0);
    }

    // Animate glow ring
    const t = this.clock.getElapsedTime();
    (this.flagButtonGlow.material as THREE.MeshBasicMaterial).opacity = glowMat.opacity * (0.7 + Math.sin(t * 3) * 0.3);
  }

  private updateFlagPhysics(dt: number) {
    // Simple cloth simulation for flag waving
    const positions = this.flagVertices.array as Float32Array;
    const original = this.flagOriginalPositions;
    const t = this.clock.getElapsedTime();
    const wind = this.flagState.wind;

    for (let i = 0; i < positions.length; i += 3) {
      const x = original[i];
      const y = original[i + 1];
      const z = original[i + 2];

      // Wave displacement based on position and time
      const wave1 = Math.sin(t * 2 + x * 3) * 0.05 * wind;
      const wave2 = Math.sin(t * 3 + x * 5 + y * 2) * 0.03 * wind;
      const droop = -Math.max(0, x) * 0.02 * (1 - this.flagState.height * 0.5);

      positions[i] = x;
      positions[i + 1] = y + wave1 + droop;
      positions[i + 2] = z + wave2;
    }

    this.flagVertices.needsUpdate = true;
    this.flagCloth.geometry.computeVertexNormals();
  }

  update(dt: number) {
    this.updateFlagPhysics(dt);

    // Update camera based on view mode
    if (this.viewMode === 'fly') {
      // Follow camera
      const flyPos = new THREE.Vector3(...this.flyState.position);
      const behind = new THREE.Vector3(
        -Math.sin(this.flyState.orientation) * 3,
        1.5,
        -Math.cos(this.flyState.orientation) * 3,
      );
      this.camera.position.lerp(flyPos.clone().add(behind), 0.1);
      this.cameraTarget.lerp(flyPos.clone().add(new THREE.Vector3(0, 0.1, 0)), 0.1);
    } else {
      // Orbit camera
      const x = this.cameraTarget.x + this.cameraDistance * Math.cos(this.cameraAngleY) * Math.cos(this.cameraAngleX);
      const y = this.cameraTarget.y + this.cameraDistance * Math.sin(this.cameraAngleX);
      const z = this.cameraTarget.z + this.cameraDistance * Math.sin(this.cameraAngleY) * Math.cos(this.cameraAngleX);
      this.camera.position.set(x, y, z);
    }

    this.camera.lookAt(this.cameraTarget);
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    const w = this.renderer.domElement.parentElement?.clientWidth || window.innerWidth;
    const h = this.renderer.domElement.parentElement?.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  getRaycastTargets(): THREE.Object3D[] {
    return [this.fly, this.flagCloth, this.flagButton];
  }
}
