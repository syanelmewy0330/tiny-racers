import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CharacterRig } from './rig';

/**
 * Turns a character exported from Blender into the rig the animator drives.
 * Parts are found by name; pivots are given in the file's own units (z up).
 * Test hook for the person's first Bubbles model (v1).
 */
export interface GlbCharacterSpec {
  url: string;
  zUp: boolean;              // file exported with z up (needs turning to y up)
  height: number;            // file height (top of ears), used for scaling
  targetHeight: number;      // in-game height in metres
  hip: number;               // file height of the seat point
  neck: [number, number, number];
  shoulderL: [number, number, number]; shoulderR: [number, number, number];
  hipL: [number, number, number]; hipR: [number, number, number];
  tailBase: [number, number, number];
  parts: { head: RegExp; armL: RegExp; armR: RegExp; legL: RegExp; legR: RegExp; tail: RegExp; ears: RegExp };
}

export async function loadGlbCharacter(spec: GlbCharacterSpec): Promise<() => CharacterRig> {
  const gltf = await new GLTFLoader().loadAsync(spec.url);
  const template = gltf.scene;
  return () => build(template.clone(true), spec);
}

function build(scene: THREE.Object3D, s: GlbCharacterSpec): CharacterRig {
  const k = s.targetHeight / s.height;
  const root = new THREE.Group();
  const inner = new THREE.Group(); inner.add(scene);
  if (s.zUp) inner.rotation.x = -Math.PI / 2;
  inner.scale.setScalar(k);
  inner.position.y = -s.hip * k;
  root.add(inner);
  root.updateMatrixWorld(true);
  // file point -> root space
  const P = (p: [number, number, number]) => new THREE.Vector3(...p).applyMatrix4(inner.matrix);
  const pivot = (parent: THREE.Object3D, at: THREE.Vector3) => { const g = new THREE.Group(); g.position.copy(at); parent.add(g); g.updateMatrixWorld(true); return g; };

  const torso = pivot(root, new THREE.Vector3());
  const head = pivot(torso, P(s.neck));
  const armL = pivot(torso, P(s.shoulderL)), armR = pivot(torso, P(s.shoulderR));
  const legL = pivot(torso, P(s.hipL)), legR = pivot(torso, P(s.hipR));
  const tail = pivot(torso, P(s.tailBase));
  const ears: THREE.Object3D[] = [];
  const meshes: THREE.Mesh[] = [];
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  for (const m of meshes) {
    const n = m.name || m.parent?.name || '';
    m.castShadow = true; m.receiveShadow = true;
    const to = s.parts.head.test(n) || s.parts.ears.test(n) ? head : s.parts.armL.test(n) ? armL : s.parts.armR.test(n) ? armR
      : s.parts.legL.test(n) ? legL : s.parts.legR.test(n) ? legR : s.parts.tail.test(n) ? tail : torso;
    to.attach(m);
  }
  // sit down: legs forward
  legL.rotation.x = legR.rotation.x = -Math.PI / 2;
  root.remove(inner);
  return { root, torso, head, armL, armR, eyes: [], ears, tail };
}

/** The person's Bubbles v1 (tiny_racers_bubbles_v1.glb). */
export const BUBBLES_V1: GlbCharacterSpec = {
  url: '/models/bubbles_v1.glb', zUp: true, height: 2.91, targetHeight: 1.35, hip: 0.75,
  neck: [0, 0, 1.45], shoulderL: [0.48, 0, 1.42], shoulderR: [-0.48, 0, 1.42],
  hipL: [0.22, 0, 0.8], hipR: [-0.22, 0, 0.8], tailBase: [0.3, 0.2, 0.85],
  parts: {
    head: /head|muzzle|chin|eye|iris|pupil|glint|nose|mouth|smile|whisker|goggle|lens/i,
    ears: /ear/i,
    armL: /(upper[ _]arm|paw)[ _]1$/i, armR: /(upper[ _]arm|paw)[ _]-1$/i,
    legL: /(leg|boot)[ _]1$/i, legR: /(leg|boot)[ _]-1$/i,
    tail: /tail/i,
  },
};
