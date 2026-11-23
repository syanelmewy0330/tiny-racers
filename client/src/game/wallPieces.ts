import * as THREE from 'three';
import type { ShortcutPath } from '@shared/trackMath';
import type { Track } from './Track';
import { TRAIL_MUD, scSide } from './Track';

/**
 * Dragon Ridge road pieces (test): the stone texture for the old wall, and the three shortcut
 * surfaces (a rope-and-plank bridge over the gorge, a lantern-lit stone tunnel, a dirt goat trail
 * with a muddy middle). Display only: the physics floors and invisible walls live in Track.
 */
const RED = 0xe54b4b, YELLOW = 0xfcc945, ORANGE = 0xff8a00, CHARCOAL = 0x1c1f26;

let seeded = 1;
const rnd = () => { seeded = (seeded * 16807) % 2147483647; return seeded / 2147483647; };

const stoneCache: Partial<Record<'small' | 'big', THREE.CanvasTexture>> = {};
/** Weathered stone blocks in staggered courses. `big` is for the wall's tall faces (repeats in metres / 4). */
export function stoneTexture(big = false): THREE.CanvasTexture {
  const key = big ? 'big' : 'small';
  if (stoneCache[key]) return stoneCache[key]!;
  seeded = big ? 101 : 77;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6f675e'; g.fillRect(0, 0, 256, 256);   // mortar
  const rows = 8, h = 256 / rows;
  const tones = ['#b9ad9d', '#a89b8a', '#c4b8a6', '#9e9281', '#b2a493', '#a59a8c'];
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -24 : 0;
    while (x < 256) {
      const w = 40 + rnd() * 34;
      g.fillStyle = tones[Math.floor(rnd() * tones.length)];
      g.fillRect(x + 2, r * h + 2, w - 4, h - 4);
      // a little shading and moss on some blocks
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x + 2, r * h + h - 7, w - 4, 5);
      if (rnd() < 0.18) { g.fillStyle = 'rgba(96,128,84,0.35)'; g.fillRect(x + 2, r * h + h - 9, w * (0.3 + rnd() * 0.5), 7); }
      if (x + w > 256) { g.fillStyle = g.fillStyle; }
      x += w;
    }
  }
  // fine speckle so it reads as stone up close
  for (let k = 0; k < 2400; k++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + rnd() * 0.08})`; g.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  stoneCache[key] = t;
  return t;
}

let paving: THREE.CanvasTexture | null = null;
/** Big worn paving slabs for the walkway on top of the wall (tinted by the road's vertex colours). */
export function pavingTexture(): THREE.CanvasTexture {
  if (paving) return paving;
  seeded = 55;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8c8580'; g.fillRect(0, 0, 256, 256);   // joints
  const rows = 4, h = 256 / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -40 : 0;
    while (x < 256) {
      const w = 56 + rnd() * 44, v = 228 + Math.floor(rnd() * 22);
      g.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
      g.fillRect(x + 2, r * h + 2, w - 4, h - 4);
      x += w;
    }
  }
  for (let k = 0; k < 3000; k++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '60,50,40'},${0.05 + rnd() * 0.08})`; g.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
  // a few cracks
  g.strokeStyle = 'rgba(70,60,50,0.35)'; g.lineWidth = 1.2;
  for (let k = 0; k < 6; k++) { let x = rnd() * 256, y = rnd() * 256; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 4; s++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  paving = new THREE.CanvasTexture(c);
  paving.wrapS = paving.wrapT = THREE.RepeatWrapping; paving.colorSpace = THREE.SRGBColorSpace; paving.anisotropy = 8;
  return paving;
}

/** A strip along a shortcut's centre line, `half` wide each side, `lift` above its surface, between fractions f0..f1. */
function strip(sc: ShortcutPath, half: number, lift: number, mat: THREE.Material, f0 = 0, f1 = 1, uvScale = 6): THREE.Mesh {
  const sp = sc.pts, n = sp.length - 1, k0 = Math.round(f0 * n), k1 = Math.round(f1 * n);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let k = k0; k <= k1; k++) {
    const p = sp[k], s = scSide(sp, k), q = (k - k0) * 2;
    pos.push(p.x + s.x * half, p.y + lift, p.z + s.z * half, p.x - s.x * half, p.y + lift, p.z - s.z * half);
    uv.push(0, k / uvScale, (2 * half) / uvScale, k / uvScale);
    if (k < k1) idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true;
  return m;
}

const yawOf = (sp: { x: number; z: number }[], k: number) => {
  const a = sp[Math.max(0, k - 2)], b = sp[Math.min(sp.length - 1, k + 2)];
  return Math.atan2(b.x - a.x, b.z - a.z);
};

/** A red paper lantern with yellow caps that glows warm orange. */
export function lantern(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshStandardMaterial({ color: RED, emissive: 0xe0352a, emissiveIntensity: 0.9, roughness: 0.6 }));
  body.scale.y = 1.15; g.add(body);
  const capMat = new THREE.MeshStandardMaterial({ color: YELLOW, emissive: YELLOW, emissiveIntensity: 0.4, metalness: 0.3 });
  for (const y of [0.46, -0.46]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 10), capMat); cap.position.y = y; g.add(cap); }
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 0.42, 6), new THREE.MeshStandardMaterial({ color: YELLOW }));
  tassel.position.y = -0.72; g.add(tassel);
  g.scale.setScalar(scale);
  return g;
}

/** Rope-and-plank bridge: planks across, posts with rope rails and lanterns, cables sagging beneath. */
export function plankBridge(track: Track, sc: ShortcutPath): THREE.Group {
  seeded = 9;
  const g = new THREE.Group(), sp = sc.pts, hw = sc.halfWidth, n = sp.length;
  const woods = [0x8a5a3a, 0x7a4e32, 0x946243, 0x6e452c];
  const plank = new THREE.BoxGeometry(hw * 2 + 0.8, 0.16, 0.82);
  const planks = new THREE.InstancedMesh(plank, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), n);
  const o = new THREE.Object3D();
  // the first and last few metres sit on the wall's walkway: no planks needed there
  const onRoad = (k: number) => {
    const p = sp[k], N = track.path.pts.length;
    for (const i of [sc.a, sc.b]) { const q = track.path.pts[i % N]; if (Math.hypot(p.x - q.x, p.z - q.z) < track.wallOffset + 0.3) return true; }
    return false;
  };
  let c = 0;
  for (let k = 0; k < n; k++) {
    if (onRoad(k)) continue;
    const p = sp[k];
    o.position.set(p.x, p.y - 0.06 + (rnd() - 0.5) * 0.03, p.z); o.rotation.set(0, yawOf(sp, k) + (rnd() - 0.5) * 0.04, 0); o.updateMatrix();
    planks.setMatrixAt(c, o.matrix); planks.setColorAt(c, new THREE.Color(woods[Math.floor(rnd() * woods.length)])); c++;
  }
  planks.count = c; planks.castShadow = planks.receiveShadow = true; g.add(planks);

  const dark = new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.9 });
  const rope = new THREE.MeshStandardMaterial({ color: 0xc9a878, roughness: 1 });
  const first = sp.findIndex((_, k) => !onRoad(k)), last = n - 1 - [...sp].reverse().findIndex((_, k) => !onRoad(n - 1 - k));
  for (const sd of [1, -1]) {
    // two long beams under the plank ends
    const beamPts: THREE.Vector3[] = [], railPts: THREE.Vector3[] = [], cablePts: THREE.Vector3[] = [];
    for (let k = first; k <= last; k++) {
      const p = sp[k], s = scSide(sp, k), x = p.x + s.x * (hw + 0.2) * sd, z = p.z + s.z * (hw + 0.2) * sd;
      beamPts.push(new THREE.Vector3(x, p.y - 0.28, z));
      const f = (k - first) / Math.max(1, last - first);
      railPts.push(new THREE.Vector3(p.x + s.x * (hw + 0.45) * sd, p.y + 1.05 - Math.sin(((k - first) % 5) / 5 * Math.PI) * 0.12, p.z + s.z * (hw + 0.45) * sd));
      cablePts.push(new THREE.Vector3(x, p.y - 0.4 - Math.sin(f * Math.PI) * 3.2, z));
    }
    const tube = (pts: THREE.Vector3[], r: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length, r, 6), m);
      mesh.castShadow = true; g.add(mesh);
    };
    tube(beamPts, 0.16, dark); tube(railPts, 0.06, rope); tube(cablePts, 0.09, rope);
    // posts every 5 m, a lantern hanging on every other one
    for (let k = first, m = 0; k <= last; k += 5, m++) {
      const p = sp[k], s = scSide(sp, k), x = p.x + s.x * (hw + 0.45) * sd, z = p.z + s.z * (hw + 0.45) * sd;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.22), dark);
      post.position.set(x, p.y + 0.5, z); post.castShadow = true; g.add(post);
      // hangers from the rail down to the cable
      const f = (k - first) / Math.max(1, last - first), drop = 1.45 + Math.sin(f * Math.PI) * 3.2;
      const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, drop, 4), rope);
      hanger.position.set(x, p.y + 1.05 - drop / 2, z); g.add(hanger);
      if ((m + (sd > 0 ? 0 : 1)) % 2 === 0) { const l = lantern(0.7); l.position.set(x, p.y + 1.85, z); g.add(l); }
    }
  }
  // big entrance gates at both ends: two red posts and a yellow beam with a hanging lantern
  for (const k of [first, last]) g.add(gate(sp, k, hw + 0.9, 4.2));
  return g;
}

/** A red post-and-beam gate across a shortcut at sample k: marks the way in, so racers spot it. */
function gate(sp: { x: number; y: number; z: number }[], k: number, half: number, h: number): THREE.Group {
  const g = new THREE.Group(), p = sp[k], yaw = yawOf(sp, k);
  const red = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.6 });
  const roof = new THREE.MeshStandardMaterial({ color: CHARCOAL, roughness: 0.7 });
  for (const sd of [1, -1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, h, 10), red);
    post.position.set(sd * half, h / 2, 0); post.castShadow = true; g.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 1.6, 0.4, 0.5), roof);
  beam.position.y = h + 0.1; beam.castShadow = true; g.add(beam);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 1.8, 0.12, 0.56), new THREE.MeshStandardMaterial({ color: YELLOW, emissive: ORANGE, emissiveIntensity: 0.35 }));
  trim.position.y = h - 0.15; g.add(trim);
  const tie = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.22, 0.3), red);
  tie.position.y = h - 0.8; g.add(tie);
  const l = lantern(0.8); l.position.set(0, h - 1.6, 0); g.add(l);
  g.position.set(p.x, p.y, p.z); g.rotation.y = yaw + Math.PI / 2;
  // the beam runs across the road: rotate so x is across
  g.rotation.y = yaw;
  return g;
}

/** Dirt goat trail with a muddy middle, wooden fence posts and rope along both sides. */
export function trailSurface(track: Track, sc: ShortcutPath): THREE.Group {
  seeded = 17;
  const g = new THREE.Group(), hw = sc.halfWidth, sp = sc.pts;
  g.add(strip(sc, hw + 0.6, 0.05, new THREE.MeshStandardMaterial({ map: dirtTexture(), roughness: 1 })));
  g.add(strip(sc, hw - 0.2, 0.08, new THREE.MeshStandardMaterial({ map: trailMudTexture(), roughness: 0.35, metalness: 0.1 }), TRAIL_MUD[0], TRAIL_MUD[1]));
  const wood = new THREE.MeshStandardMaterial({ color: 0x6e4a30, roughness: 0.95 });
  const rope = new THREE.MeshStandardMaterial({ color: 0xc9a878, roughness: 1 });
  for (const sd of [1, -1]) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k < sp.length; k += 4) {
      const p = sp[k], s = scSide(sp, k), x = p.x + s.x * (hw + 0.4) * sd, z = p.z + s.z * (hw + 0.4) * sd;
      if (Math.hypot(x - track.path.pts[sc.a].x, z - track.path.pts[sc.a].z) < track.wallOffset + 1 || Math.hypot(x - track.path.pts[sc.b].x, z - track.path.pts[sc.b].z) < track.wallOffset + 1) continue;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.2, 6), wood);
      post.position.set(x, p.y + 0.6, z); post.rotation.z = (rnd() - 0.5) * 0.12; post.castShadow = true; g.add(post);
      pts.push(new THREE.Vector3(x, p.y + 0.95, z));
    }
    if (pts.length > 1) g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 3, 0.05, 5), rope));
  }
  // gates at both ends
  const n = sp.length - 1;
  const inset = (end: number) => {
    for (let k = 0; k <= n; k++) { const kk = end ? n - k : k; const q = track.path.pts[end ? sc.b : sc.a]; if (Math.hypot(sp[kk].x - q.x, sp[kk].z - q.z) > track.wallOffset + 2) return kk; }
    return end ? n : 0;
  };
  g.add(gate(sp, inset(0), hw + 0.9, 4)); g.add(gate(sp, inset(1), hw + 0.9, 4));
  return g;
}

/** First and last samples of a tunnel's covered part: the ends stay open where it meets the wall. */
export function tunnelEnds(track: Track, sc: ShortcutPath): [number, number] {
  const sp = sc.pts, n = sp.length;
  const clear = (k: number) => [sc.a, sc.b].every((i) => { const q = track.path.pts[i]; return Math.hypot(sp[k].x - q.x, sp[k].z - q.z) > track.wallOffset + 7; });
  return [sp.findIndex((_, k) => clear(k)), n - 1 - [...sp].reverse().findIndex((_, k) => clear(n - 1 - k))];
}

/**
 * Stone tunnel through the rocky spur: paved floor, stone walls and a vaulted roof, lanterns
 * along the walls, and a stone portal with red doors pinned open at each end.
 */
export function tunnelPassage(track: Track, sc: ShortcutPath): THREE.Group {
  const g = new THREE.Group(), sp = sc.pts, hw = sc.halfWidth;
  const paving = new THREE.MeshStandardMaterial({ map: stoneTexture(), color: 0x9a9088, roughness: 0.9 });
  g.add(strip(sc, hw + 0.6, 0.04, paving, 0, 1, 3));
  const [k0, k1] = tunnelEnds(track, sc);
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(true), color: 0xd6ccbf, roughness: 0.95, side: THREE.DoubleSide });
  const H = 4.6, R = hw + 0.9;
  // walls + vault as one swept shape: a half-pipe arch above two straight walls
  const prof: [number, number][] = [];
  prof.push([R, -0.2], [R, H - R * 0.55]);
  for (let a = 1; a < 12; a++) { const t = (a / 12) * Math.PI; prof.push([Math.cos(t) * R, H - R * 0.55 + Math.sin(t) * R * 0.55]); }
  prof.push([-R, H - R * 0.55], [-R, -0.2]);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [], P = prof.length;
  let along = 0;
  for (let k = k0; k <= k1; k++) {
    const p = sp[k], s = scSide(sp, k);
    if (k > k0) along += Math.hypot(p.x - sp[k - 1].x, p.z - sp[k - 1].z);
    let around = 0;
    prof.forEach(([x, y], j) => {
      if (j > 0) around += Math.hypot(x - prof[j - 1][0], y - prof[j - 1][1]);
      pos.push(p.x + s.x * x, p.y + y, p.z + s.z * x); uv.push(along / 4, around / 4);
      if (k > k0 && j > 0) { const v = (k - k0) * P + j; idx.push(v - P - 1, v - 1, v - P, v - P, v - 1, v); }
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const vault = new THREE.Mesh(geo, stone); vault.receiveShadow = true; vault.castShadow = true; g.add(vault);
  // lanterns along both walls, and a warm glow strip down the middle of the roof
  for (let k = k0 + 3, m = 0; k < k1 - 2; k += 7, m++) {
    const p = sp[k], s = scSide(sp, k), sd = m % 2 ? 1 : -1;
    const l = lantern(0.65); l.position.set(p.x + s.x * (R - 0.55) * sd, p.y + 2.6, p.z + s.z * (R - 0.55) * sd); g.add(l);
  }
  // portals: chunky stone frames with a red lintel and yellow trim, red doors pinned open
  for (const [k, dir] of [[k0, 1], [k1, -1]] as const) {
    const p = sp[k], yaw = yawOf(sp, k), f = new THREE.Group();
    const frame = new THREE.MeshStandardMaterial({ map: stoneTexture(true), color: 0xcfc4b6, roughness: 0.95 });
    for (const sd of [1, -1]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(2.2, H + 2.6, 2.4), frame);
      pier.position.set(sd * (R + 1.0), (H + 2.6) / 2 - 0.4, 0); pier.castShadow = true; f.add(pier);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, H - 0.6, 2.2), new THREE.MeshStandardMaterial({ color: RED, roughness: 0.7 }));
      door.position.set(sd * (R + 0.1), (H - 0.6) / 2, dir * 2.0); f.add(door);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(R * 2 + 4.4, 2.2, 2.6), frame);
    lintel.position.y = H + 0.9; lintel.castShadow = true; f.add(lintel);
    const band = new THREE.Mesh(new THREE.BoxGeometry(R * 2 + 1.2, 0.7, 2.7), new THREE.MeshStandardMaterial({ color: RED, roughness: 0.6 }));
    band.position.y = H + 0.3; f.add(band);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(R * 2 + 4.6, 0.16, 2.8), new THREE.MeshStandardMaterial({ color: YELLOW, emissive: ORANGE, emissiveIntensity: 0.3 }));
    trim.position.y = H + 2.05; f.add(trim);
    for (const sd of [1, -1]) { const l = lantern(0.75); l.position.set(sd * (R - 0.6), H - 0.6, dir * -1.4); f.add(l); }
    f.position.set(p.x, p.y, p.z); f.rotation.y = yaw;
    g.add(f);
  }
  return g;
}

function dirtTexture(): THREE.CanvasTexture {
  seeded = 29;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8a6a4c'; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 900; k++) { g.fillStyle = ['#7a5c40', '#9a7a58', '#6e5038', '#a88a66'][k % 4]; g.beginPath(); g.arc(rnd() * 256, rnd() * 256, 1 + rnd() * 3.5, 0, Math.PI * 2); g.fill(); }
  // two worn wheel tracks
  g.fillStyle = 'rgba(60,40,26,0.25)'; g.fillRect(64, 0, 26, 256); g.fillRect(166, 0, 26, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function trailMudTexture(): THREE.CanvasTexture {
  seeded = 41;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3a2618'; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 60; k++) { g.fillStyle = ['#4a3020', '#2a1a10', '#553826'][k % 3]; g.beginPath(); g.ellipse(rnd() * 256, rnd() * 256, 8 + rnd() * 30, 5 + rnd() * 16, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = 'rgba(255,200,150,0.3)'; g.lineWidth = 3;
  for (let k = 0; k < 12; k++) { const x = rnd() * 256, y = rnd() * 256; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y + 20, x + 4, y + 40); g.stroke(); }
  g.fillStyle = 'rgba(20,12,8,0.45)'; g.fillRect(70, 0, 16, 256); g.fillRect(170, 0, 16, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
