import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Building blocks for the "vinyl toy" look: soft glossy plastic, rounded shapes,
 * big shiny eyes and painted-on decals. Geometry and materials are cached and
 * shared between karts, so eight racers stay cheap to draw.
 */

export const INK = 0x2a2238;

const mats = new Map<string, THREE.Material>();
const cached = <T extends THREE.Material>(key: string, make: () => T): T => {
  let m = mats.get(key) as T | undefined;
  if (!m) { m = make(); mats.set(key, m); }
  return m;
};

/** Soft glossy vinyl, the main toy material (fur, faces, clothes). */
export const vinyl = (color: number, rough = 0.5) =>
  cached(`v${color}-${rough}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: rough, clearcoat: 0.55, clearcoatRoughness: 0.35 }));
/** Car-paint plastic for kart bodies. */
export const gloss = (color: number) =>
  cached(`g${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 }));
/** Matte rubber and fabric (tyres, seats, gloves). */
export const matte = (color: number) =>
  cached(`m${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
export const metal = (color = 0xd9dde8) =>
  cached(`c${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.85 }));
/** Lights, screens and glowing trim. */
export const glow = (color: number, strength = 1.6) =>
  cached(`e${color}-${strength}`, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: strength, roughness: 0.4 }));
export const glass = (color = 0xbfe8ff, opacity = 0.35) =>
  cached(`l${color}-${opacity}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, transparent: true, opacity, clearcoat: 1 }));
export const flat = (color: number) => cached(`f${color}`, () => new THREE.MeshBasicMaterial({ color }));

const geos = new Map<string, THREE.BufferGeometry>();
const geo = <T extends THREE.BufferGeometry>(key: string, make: () => T): T => {
  let g = geos.get(key) as T | undefined;
  if (!g) { g = make(); geos.set(key, g); }
  return g;
};
export const G = {
  sphere: (seg = 24) => geo(`s${seg}`, () => new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7))),
  halfSphere: (seg = 24) => geo(`hs${seg}`, () => new THREE.SphereGeometry(1, seg, Math.round(seg * 0.4), 0, Math.PI * 2, 0, Math.PI / 2)),
  cyl: (seg = 20) => geo(`c${seg}`, () => new THREE.CylinderGeometry(1, 1, 1, seg)),
  cone: (seg = 16) => geo(`k${seg}`, () => new THREE.ConeGeometry(1, 1, seg)),
  capsule: (r: number, len: number) => geo(`p${r}-${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 16)),
  rbox: (w: number, h: number, d: number, r: number) => geo(`b${w}-${h}-${d}-${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) - 0.001)),
  torus: (r: number, t: number, arc = Math.PI * 2) => geo(`t${r}-${t}-${arc}`, () => new THREE.TorusGeometry(r, t, 10, 28, arc)),
};

type V3 = [number, number, number];
/** A mesh with position / scale / rotation in one call. Casts and receives shadows. */
export function part(g: THREE.BufferGeometry, m: THREE.Material, pos: V3 = [0, 0, 0], scale: V3 | number = 1, rot: V3 = [0, 0, 0]) {
  const o = new THREE.Mesh(g, m);
  o.position.set(...pos);
  if (typeof scale === 'number') o.scale.setScalar(scale); else o.scale.set(...scale);
  o.rotation.set(...rot);
  o.castShadow = true; o.receiveShadow = true;
  return o;
}
/** Ellipsoid of radii (rx, ry, rz). */
export const blob = (m: THREE.Material, pos: V3, r: V3 | number, rot: V3 = [0, 0, 0], seg = 24) => part(G.sphere(seg), m, pos, r, rot);
/** Rounded box. */
export const rbox = (m: THREE.Material, pos: V3, size: V3, radius = 0.08, rot: V3 = [0, 0, 0]) => part(G.rbox(size[0], size[1], size[2], radius), m, pos, 1, rot);
/** Cylinder along Y with radius r and height h. */
export const cyl = (m: THREE.Material, pos: V3, r: number, h: number, rot: V3 = [0, 0, 0], seg = 20) => part(G.cyl(seg), m, pos, [r, h, r], rot);
export const cone = (m: THREE.Material, pos: V3, r: number, h: number, rot: V3 = [0, 0, 0], seg = 16) => part(G.cone(seg), m, pos, [r, h, r], rot);
export const group = (pos: V3 = [0, 0, 0], ...children: THREE.Object3D[]) => {
  const g = new THREE.Group(); g.position.set(...pos); if (children.length) g.add(...children); return g;
};

/**
 * A big shiny toy eye looking along +z. Returns the eye group (scale.y to blink).
 * `lid` adds a half-closed eyelid in that colour (sleepy or smug looks).
 */
export function eye(size: number, iris = 0x3b2a1e, opts: { lid?: number; lidAngle?: number; look?: [number, number] } = {}) {
  const e = new THREE.Group();
  e.add(blob(vinyl(0xffffff, 0.25), [0, 0, 0], [size, size * 1.1, size * 0.55]));
  const [lx, ly] = opts.look ?? [0, 0];
  const pupil = group([lx * size * 0.25, ly * size * 0.25, size * 0.42]);
  pupil.add(blob(vinyl(iris, 0.2), [0, 0, 0], [size * 0.68, size * 0.78, size * 0.22]));
  pupil.add(blob(vinyl(0x120e18, 0.15), [0, 0, size * 0.08], [size * 0.4, size * 0.48, size * 0.16]));
  pupil.add(blob(flat(0xffffff), [size * 0.22, size * 0.28, size * 0.2], size * 0.17, [0, 0, 0], 10));
  pupil.add(blob(flat(0xffffff), [-size * 0.18, -size * 0.22, size * 0.2], size * 0.08, [0, 0, 0], 8));
  e.add(pupil);
  if (opts.lid !== undefined) {
    const lid = part(G.halfSphere(), vinyl(opts.lid), [0, 0, 0], [size * 1.06, size * 1.16, size * 0.62], [opts.lidAngle ?? 0.35, 0, 0]);
    e.add(lid);
  }
  return e;
}

/** A curved mouth line (smile when arc faces down). */
export function mouth(radius: number, thick: number, arc: number, m: THREE.Material = vinyl(INK, 0.4)) {
  const o = part(G.torus(radius, thick, arc), m);
  o.rotation.z = Math.PI + (Math.PI - arc) / 2;  // centred arc opening upwards = smile
  return o;
}

/** A painted decal: a transparent canvas texture on a thin plane. */
const textures = new Map<string, THREE.CanvasTexture>();
export function decal(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void, px = 256) {
  let tex = textures.get(key);
  if (!tex) {
    const c = document.createElement('canvas');
    c.width = px; c.height = Math.max(16, Math.round(px * (h / w)));
    draw(c.getContext('2d')!, c.width, c.height);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    textures.set(key, tex);
  }
  const m = cached(`d${key}`, () => new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }));
  const o = new THREE.Mesh(geo('plane', () => new THREE.PlaneGeometry(1, 1)), m);
  o.scale.set(w, h, 1);
  o.receiveShadow = true;
  return o;
}

export const css = (n: number) => '#' + n.toString(16).padStart(6, '0');

/**
 * Soft studio reflections so the clear-coat materials shine.
 * Each renderer needs its own (textures belong to one WebGL context).
 */
export function toyEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene, intensity = 0.45) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = intensity;
  return env;
}

/** A smooth tube through points (tails, cables, pencils' strings). Rounded ends. */
export function tube(points: [number, number, number][], radius: number, m: THREE.Material, taper = 1) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, 24, radius, 12, false);
  if (taper !== 1) {   // narrow towards the end
    const pos = g.attributes.position, centre = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, s = 1 + (taper - 1) * t;
      curve.getPointAt(t, centre);
      for (let j = 0; j <= 12; j++) {
        const k = i * 13 + j;
        v.fromBufferAttribute(pos, k).sub(centre).multiplyScalar(s).add(centre);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    g.computeVertexNormals();
  }
  const o = new THREE.Group();
  o.add(part(g, m));
  o.add(blob(m, points[0], radius));
  const end = curve.getPointAt(1);
  o.add(blob(m, [end.x, end.y, end.z], radius * taper));
  return o;
}

/**
 * Sculpted, hand-painted shapes: start from a unit sphere, move its vertices with
 * `shape`, then colour each vertex with `colour` (both get the original unit-sphere
 * position). Gives smooth fur patterns with no seams, like a painted vinyl figure.
 */
export function sculpted(
  shape: (p: THREE.Vector3) => void,
  colour: (p: THREE.Vector3) => THREE.Color,
  opts: { rough?: number; seg?: number; texSize?: number } = {},
) {
  const seg = opts.seg ?? 64;
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
  const pos = g.attributes.position;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    shape(p);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  // Paint into a texture (per pixel, so patterns stay crisp) using the sphere's own UV layout.
  const W = opts.texSize ?? 1024, H = W / 2;
  const data = new Uint8Array(W * H * 4), q = new THREE.Vector3();
  for (let y = 0; y < H; y++) {
    const theta = ((y + 0.5) / H) * Math.PI;          // 0 at the top
    for (let x = 0; x < W; x++) {
      const phi = ((x + 0.5) / W) * Math.PI * 2;
      q.set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
      const c = colour(q).clone().convertLinearToSRGB();
      const k = ((H - 1 - y) * W + x) * 4;
      data[k] = c.r * 255; data[k + 1] = c.g * 255; data[k + 2] = c.b * 255; data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H);
  tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = 4; tex.needsUpdate = true;
  const m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: opts.rough ?? 0.55, clearcoat: 0.45, clearcoatRoughness: 0.4 });
  const o = new THREE.Mesh(g, m);
  o.castShadow = true; o.receiveShadow = true;
  return o;
}

export const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const _c = new THREE.Color();
/** Blend two hex colours (t = 0 gives a, 1 gives b). Returns a shared Color: use it straight away. */
export const mix = (a: number, b: number, t: number) => _c.setHex(a).lerp(new THREE.Color(b), t);
