import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { KartRig, Wheel } from './base';

/**
 * Turns a kart exported from Blender into the rig the game animates.
 * Test hook for the person's first Zoomie model (v1): y up, nose +z.
 */
export interface GlbKartSpec {
  url: string; scale: number;
  wheels: { re: RegExp; front: boolean }[];
  steering: RegExp; column?: RegExp; steerOffset?: [number, number, number]; seat: [number, number, number]; exhausts: [number, number, number][];
}

export async function loadGlbKart(spec: GlbKartSpec): Promise<() => KartRig> {
  const gltf = await new GLTFLoader().loadAsync(spec.url);
  return () => build(gltf.scene.clone(true), spec);
}

function build(scene: THREE.Object3D, s: GlbKartSpec): KartRig {
  const root = new THREE.Group();
  scene.scale.setScalar(s.scale);
  root.add(scene); root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  for (const m of meshes) {
    m.castShadow = true; m.receiveShadow = true;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (m.geometry.attributes.color && !mat.vertexColors) { m.material = mat.clone(); (m.material as THREE.MeshStandardMaterial).vertexColors = true; }
  }
  const box = new THREE.Box3();
  const group = (list: THREE.Mesh[]) => {
    box.makeEmpty(); for (const m of list) box.expandByObject(m);
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const pivot = new THREE.Group(); pivot.position.copy(c); root.add(pivot); pivot.updateMatrixWorld(true);
    const inner = new THREE.Group(); pivot.add(inner); inner.updateMatrixWorld(true);
    for (const m of list) inner.attach(m);
    return { pivot, inner, size };
  };
  const wheels: Wheel[] = s.wheels.map((w) => {
    const g = group(meshes.filter((m) => w.re.test(m.name)));
    return { pivot: g.pivot, spin: g.inner, front: w.front, radius: g.size.y / 2 };
  });
  // move the steering column and wheel closer to the driver (kart space, metres)
  if (s.steerOffset) for (const m of meshes) if (s.steering.test(m.name) || s.column?.test(m.name)) m.position.add(new THREE.Vector3(...s.steerOffset).divideScalar(s.scale));
  root.updateMatrixWorld(true);
  const steer = group(meshes.filter((m) => s.steering.test(m.name)));
  const c = steer.pivot.position;
  const grip = (x: number) => new THREE.Vector3(c.x + x, c.y, c.z - 0.03);
  const k = s.scale;
  return {
    root, wheels, steering: steer.inner,
    seat: new THREE.Vector3(...s.seat).multiplyScalar(k),
    hands: [grip(0.16), grip(-0.16)],
    exhausts: s.exhausts.map((e) => new THREE.Vector3(...e).multiplyScalar(k)),
  };
}

/** The person's Zoomie v1 (tiny_racers_zoomie_v1.glb). Left = +x. */
export const ZOOMIE_V1: GlbKartSpec = {
  url: '/models/zoomie_v1.glb', scale: 0.75,
  wheels: [
    { re: /^front_right_/, front: true }, { re: /^front_left_/, front: true },
    { re: /^rear_right_/, front: false }, { re: /^rear_left_/, front: false },
  ],
  steering: /^steering_(wheel|spoke)$/, column: /^steering_column$/, steerOffset: [0, -0.16, -0.2],
  seat: [0, 1.2, -0.45],
  exhausts: [[-0.28, 0.48, -1.5], [0.28, 0.48, -1.5]],
};
