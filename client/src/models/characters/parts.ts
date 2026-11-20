import * as THREE from 'three';
import { G, blob, group, part, vinyl, flat } from '../toy';

/**
 * Shared character parts at the Bubbles quality benchmark: glossy toon eyes with
 * liner and glints, and tubes painted with rings (tails).
 */
export interface EyeStyle {
  iris: number;          // outer iris
  irisLight: number;     // lighter lower iris
  /** Eyelid colour: covers the top of the eye (sleepy, smug). */
  lid?: number;
  /** 0 = barely there, 1 = half closed. */
  lidDrop?: number;
  liner?: number;
  look?: [number, number];
}

export function toonEye(size: number, s: EyeStyle) {
  const e = new THREE.Group();
  e.add(blob(vinyl(0xffffff, 0.2), [0, 0, 0], [size, size * 1.08, size * 0.55]));
  const [lx, ly] = s.look ?? [0, 0];
  const iris = group([lx * size * 0.2, -0.01 * size + ly * size * 0.2, size * 0.4]);
  iris.add(blob(vinyl(s.iris, 0.2), [0, 0, 0], [size * 0.74, size * 0.82, size * 0.22]));
  iris.add(blob(vinyl(s.irisLight, 0.2), [0, -size * 0.18, size * 0.04], [size * 0.55, size * 0.45, size * 0.2]));
  iris.add(blob(vinyl(0x15101a, 0.12), [0, size * 0.04, size * 0.08], [size * 0.48, size * 0.56, size * 0.17]));
  iris.add(blob(flat(0xffffff), [size * 0.24, size * 0.3, size * 0.2], [size * 0.2, size * 0.17, size * 0.05], [0, 0, 0], 12));
  iris.add(blob(flat(0xffffff), [-size * 0.2, -size * 0.24, size * 0.2], size * 0.08, [0, 0, 0], 8));
  e.add(iris);
  if (s.lid !== undefined) {
    const drop = s.lidDrop ?? 0.5;
    const rot = -0.9 + drop * 1.8;   // 0 = lid down to the middle of the eye
    const lid = group([0, 0, 0]); lid.rotation.x = rot; e.add(lid);
    lid.add(part(G.halfSphere(), vinyl(s.lid, 0.5), [0, 0, 0], [size * 1.07, size * 1.15, size * 0.62]));
    // liner along the lid's front edge
    lid.add(part(G.torus(1, 0.08, Math.PI), vinyl(s.liner ?? 0x2a2233, 0.35), [0, 0, 0], [size * 1.06, size * 0.62, size], [Math.PI / 2, 0, 0]));
  } else {
    e.add(part(G.torus(size * 1.0, size * 0.09, Math.PI * 0.9), vinyl(s.liner ?? 0x2a2233, 0.35), [0, 0, size * 0.12], [1, 1.08, 1], [0, 0, Math.PI * 0.05]));
  }
  return e;
}

/** A closed, happy/winking eye: a curved liner arc. */
export function closedEye(size: number, liner = 0x2a2233) {
  return part(G.torus(size * 0.75, size * 0.11, Math.PI * 0.85), vinyl(liner, 0.35), [0, 0, 0], 1, [0, 0, Math.PI * 0.075]);
}

/** A smooth tapered tube through points, painted along its length by `colour(t)`. */
export function paintedTube(points: [number, number, number][], radius: number, colour: (t: number) => number, taperTo = 0.8) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const seg = 48, rad = 14;
  const g = new THREE.TubeGeometry(curve, seg, radius, rad, false);
  const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), centre = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, taper = 1 - t * (1 - taperTo);
    curve.getPointAt(t, centre);
    c.setHex(colour(t));
    for (let j = 0; j <= rad; j++) {
      const k = i * (rad + 1) + j;
      v.fromBufferAttribute(pos, k).sub(centre).multiplyScalar(taper).add(centre);
      pos.setXYZ(k, v.x, v.y, v.z);
      c.toArray(cols, k * 3);
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const o = new THREE.Group();
  const mesh = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.6, clearcoat: 0.4 }));
  mesh.castShadow = true; o.add(mesh);
  o.add(blob(vinyl(colour(0), 0.6), points[0], radius));
  const end = curve.getPointAt(1);
  o.add(blob(vinyl(colour(1), 0.6), [end.x, end.y, end.z], radius * taperTo));
  return o;
}
