import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Speed-up for the toy models: they are built from many small pieces, and every piece
 * costs the graphics card a separate draw (twice, with shadows). Pieces that never move
 * on their own and share a material are combined into one mesh under the same parent,
 * so the model looks exactly the same but draws in far fewer calls.
 * Anything in `keep` (moving parts) is left alone.
 */
export function mergeStill(root: THREE.Object3D, keep: Set<THREE.Object3D>, liveMats = new Set<THREE.Material>()) {
  // pieces built separately often have identical but separate materials: treat those as one
  const sigs = new Map<THREE.Material, string>();
  const sig = (mat: THREE.Material) => {
    let k = sigs.get(mat);
    if (k === undefined) {
      if (liveMats.has(mat)) k = mat.uuid;
      else { const j = mat.toJSON({ textures: {}, images: {} } as never) as unknown as Record<string, unknown>; delete j.uuid; delete j.name; delete j.metadata; k = JSON.stringify(j); }
      sigs.set(mat, k);
    }
    return k;
  };
  const shared = new Map<string, THREE.Material>();
  const parents: THREE.Object3D[] = [];
  root.traverse((o) => parents.push(o));
  let before = 0, after = 0;
  for (const parent of parents) {
    const groups = new Map<string, THREE.Mesh[]>();
    for (const c of parent.children) {
      const m = c as THREE.Mesh;
      if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || keep.has(m) || m.children.length || !m.visible) continue;
      const mat = m.material as THREE.Material;
      if (Array.isArray(m.material) || mat.transparent || m.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) continue;
      const g = m.geometry;
      if (g.groups.length || Object.keys(g.morphAttributes).length) continue;
      const key = [sig(mat), Object.keys(g.attributes).sort().join(','), !!g.index, m.castShadow, m.receiveShadow, m.renderOrder].join('|');
      const list = groups.get(key) ?? []; list.push(m); groups.set(key, list);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const geos = list.map((m) => { m.updateMatrix(); const g = m.geometry.clone(); g.applyMatrix4(m.matrix); return g; });
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const first = list[0];
      const k = sig(first.material as THREE.Material);
      if (!shared.has(k)) shared.set(k, first.material as THREE.Material);
      const mesh = new THREE.Mesh(merged, shared.get(k)!);
      mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow; mesh.renderOrder = first.renderOrder;
      mesh.name = 'merged';
      for (const m of list) parent.remove(m);
      parent.add(mesh);
      before += list.length; after += 1;
    }
  }
  return { before, after };
}

type Pose = [THREE.Vector3, THREE.Quaternion, THREE.Vector3, boolean];

/** Remember every object's pose, so a test run of the animation can be undone. */
export function snapshot(root: THREE.Object3D) {
  const m = new Map<THREE.Object3D, Pose>();
  root.traverse((o) => m.set(o, [o.position.clone(), o.quaternion.clone(), o.scale.clone(), o.visible]));
  return m;
}

/** Objects whose pose changed since the snapshot (they animate). Restores the snapshot. */
export function movedSince(snap: Map<THREE.Object3D, Pose>) {
  const moved = new Set<THREE.Object3D>();
  for (const [o, [p, q, s, v]] of snap) {
    if (!o.position.equals(p) || !o.quaternion.equals(q) || !o.scale.equals(s) || o.visible !== v) moved.add(o);
    o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); o.visible = v;
  }
  return moved;
}

/** Colours and opacity of every material, to spot materials the animation changes. */
export function materialState(root: THREE.Object3D) {
  const m = new Map<THREE.Material, string>();
  const st = (x: THREE.Material) => { const a = x as THREE.MeshStandardMaterial; return [a.color?.getHex(), a.emissive?.getHex(), a.emissiveIntensity, a.opacity, a.visible].join(); };
  root.traverse((o) => { const mats = (o as THREE.Mesh).material; if (mats) for (const x of Array.isArray(mats) ? mats : [mats]) m.set(x, st(x)); });
  return { changed: () => { const out = new Set<THREE.Material>(); for (const [x, v] of m) if (st(x) !== v) out.add(x); return out; } };
}
