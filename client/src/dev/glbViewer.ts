import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toyEnvironment } from '../models/toy';

// Dev page: renders a GLB from four angles. ?f=/models/x.glb&fix=zup
const q = new URLSearchParams(location.search);
const W = 1600, H = 900;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c') as HTMLCanvasElement, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setScissorTest(true);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x3a3f47);
toyEnvironment(renderer, scene, 0.45);
scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x6f6148, 0.9));
const sun = new THREE.DirectionalLight(0xffd9a6, 2.4); sun.position.set(3, 5, 4); scene.add(sun);
new GLTFLoader().load(q.get('f') ?? '/models/bubbles_v1.glb', (g) => {
  const root = g.scene;
  if (q.get('fix') === 'zup') root.rotation.x = -Math.PI / 2;
  scene.add(root); root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(30, (W / 4) / H, 0.01, 100);
  const d = Math.max(size.x, size.y, size.z) * 2.6;
  const views = [[0, 0, 1], [1, 0, 0], [0.7, 0.25, 0.7], [0, 0, -1]];
  views.forEach((v, i) => {
    cam.position.set(c.x + v[0] * d, c.y + v[1] * d, c.z + v[2] * d); cam.lookAt(c);
    renderer.setViewport(i * W / 4, 0, W / 4, H); renderer.setScissor(i * W / 4, 0, W / 4, H);
    renderer.render(scene, cam);
  });
  (window as any).glbInfo = { size: size.toArray(), center: c.toArray() };
  document.title = 'ready';
});
