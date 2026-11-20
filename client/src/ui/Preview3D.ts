import * as THREE from 'three';
import { toyEnvironment } from '../models/toy';

export interface PreviewSubject {
  object: THREE.Object3D;
  /** Called every frame for idle animation. */
  update?: (dt: number, t: number) => void;
  /** Called when the subject is replaced, to free scene-level leftovers. */
  dispose?: () => void;
}

/**
 * A small 3D stage for menus: a turntable podium under soft studio light.
 * Drag (mouse or touch) to spin the model; it slowly turns by itself otherwise.
 */
export class Preview3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private turntable = new THREE.Group();
  private subject: PreviewSubject | null = null;
  private clock = new THREE.Clock();
  private time = 0;
  private yaw = -0.5; private yawVel = 0; private dragging = false; private lastX = 0; private idleFor = 10;
  private ro: ResizeObserver;
  private disposed = false;
  autoSpin = true;
  target = new THREE.Vector3(0, 0.9, 0);
  distance = 6.2;
  height = 1.6;

  constructor(readonly canvas: HTMLCanvasElement, podiumColor = 0xffc84a) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    toyEnvironment(this.renderer, this.scene, 0.5);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd9c8ff, 1.0));
    const key = new THREE.DirectionalLight(0xfff3e0, 2.4);
    key.position.set(3, 6, 4); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 15 });
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfe8ff, 1.2); rim.position.set(-4, 3, -4); this.scene.add(rim);

    const podium = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.25, 0.3, 48), new THREE.MeshPhysicalMaterial({ color: podiumColor, roughness: 0.35, clearcoat: 1 }));
    podium.position.y = -0.15; podium.receiveShadow = true;
    const rimRing = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.06, 10, 64), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    rimRing.rotation.x = Math.PI / 2; rimRing.position.y = 0.0;
    this.turntable.add(podium, rimRing);
    this.scene.add(this.turntable);

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => { this.dragging = true; this.lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX; this.lastX = e.clientX;
      this.yaw += dx * 0.012; this.yawVel = dx * 0.012 * 60; this.idleFor = 0;
    });
    const up = () => { this.dragging = false; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  setPodiumColor(color: number) {
    ((this.turntable.children[0] as THREE.Mesh).material as THREE.MeshPhysicalMaterial).color.setHex(color);
  }

  setSubject(s: PreviewSubject) {
    if (this.subject) { this.turntable.remove(this.subject.object); this.subject.dispose?.(); }
    this.subject = s;
    this.turntable.add(s.object);
  }

  /** Point the camera at a fixed angle (used for screenshots and icons). */
  setYaw(yaw: number) { this.yaw = yaw; this.yawVel = 0; this.idleFor = -1e9; }

  private resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  private frame() {
    if (this.disposed) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    this.idleFor += dt;
    if (!this.dragging) {
      this.yaw += this.yawVel * dt;
      this.yawVel *= Math.exp(-dt * 3);
      if (this.autoSpin && this.idleFor > 2.5) this.yaw += dt * 0.45;
    }
    this.turntable.rotation.y = this.yaw;
    this.subject?.update?.(dt, this.time);
    this.camera.position.set(0, this.target.y + this.height, this.distance);
    this.camera.lookAt(this.target);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.ro.disconnect();
    this.renderer.setAnimationLoop(null);
    if (this.subject) { this.turntable.remove(this.subject.object); this.subject.dispose?.(); }
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
