import * as THREE from 'three';
import { nearShortcut, yawAt, type ShortcutPath } from '@shared/trackMath';
import type { Track } from './Track';
import type { Snowfall } from './frostScenery';
import { THEME } from './theme';
import { stoneTexture, lantern, tunnelEnds } from './wallPieces';

/**
 * Dragon Ridge scenery (test): sunrise over misty mountains. The old wall sits on ridge crests
 * that fall away into deep valleys filled with a sea of cloud; watchtowers with red pavilions,
 * pine and red-maple trees on the slopes, pennant flags and lanterns along the battlements,
 * a rocky spur over the tunnel shortcut and a deep gorge under the plank bridge.
 * Display only: nothing here changes how karts drive.
 */
const RED = 0xe54b4b, YELLOW = 0xfcc945, ORANGE = 0xff8a00, SAGE = 0x7aa58a, CHARCOAL = 0x1c1f26;

export function wallScenery(scene: THREE.Object3D, track: Track, rnd: () => number): Snowfall {
  const pts = track.path.pts, N = pts.length, W = track.wallOffset + 0.4;
  const scs = track.route.shortcuts;
  const height = terrainHeight(track);
  const o = new THREE.Object3D();

  // ---------------- the mountains under and around the wall
  scene.add(terrainMesh(height));

  // ---------------- a sea of cloud filling the valleys, and drifting mist wisps
  const cloudTex = cloudTexture();
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.MeshStandardMaterial({ color: 0xf6dcd2, map: cloudTex, emissive: 0xe9b8a8, emissiveIntensity: 0.35, roughness: 1, transparent: true, opacity: 0.97 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(130, -17, 15); cloudTex.repeat.set(26, 26);
  scene.add(sea);
  const tex2 = cloudTex.clone(); tex2.repeat.set(9, 9); tex2.needsUpdate = true;
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.MeshBasicMaterial({ color: 0xffe2d6, map: tex2, transparent: true, opacity: 0.35, depthWrite: false }));
  veil.rotation.x = -Math.PI / 2; veil.position.set(130, -9.5, 15); scene.add(veil);
  const wisps: THREE.Sprite[] = [];
  const wispMat = new THREE.SpriteMaterial({ map: puffTexture(), color: 0xffe6dc, transparent: true, opacity: 0.55, depthWrite: false, fog: true });
  for (let k = 0; k < 46; k++) {
    let x = 0, z = 0, h = 0;
    for (let t = 0; t < 40; t++) { x = -60 + rnd() * 380; z = -110 + rnd() * 250; h = height(x, z); if (h < -6) break; }
    const s = new THREE.Sprite(wispMat); s.position.set(x, Math.max(h, -14) + 2 + rnd() * 5, z);
    s.scale.set(28 + rnd() * 30, 9 + rnd() * 6, 1); s.userData.drift = 0.5 + rnd(); s.userData.x0 = x;
    wisps.push(s); scene.add(s);
  }

  // ---------------- trees on the slopes: dark pines, with a few red maples
  {
    const coneGeo = new THREE.ConeGeometry(1.7, 3.6, 7);
    const pines = new THREE.InstancedMesh(coneGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 }), 1500);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x5a3e2c }), 500);
    const maples = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 }), 120);
    const greens = [0x35503f, 0x3f5a46, 0x2f4738, 0x4d6b52];
    const reds = [RED, ORANGE, 0xd9603e, YELLOW];
    let np = 0, nt = 0, nm = 0;
    const roadClear = (x: number, z: number, m: number) => nearestMain(track, x, z).d > W + m && scs.every((sc) => nearShortcut(sc, x, z).dist > sc.halfWidth + m);
    for (let tries = 0; tries < 9000 && nt < 500; tries++) {
      const x = -90 + rnd() * 450, z = -150 + rnd() * 330;
      const h = height(x, z);
      if (h < -15 || !roadClear(x, z, 5)) continue;
      const s = 0.8 + rnd() * 0.9;
      o.rotation.set(0, rnd() * 6, 0);
      o.position.set(x, h + 0.8 * s, z); o.scale.setScalar(s); o.updateMatrix(); trunks.setMatrixAt(nt++, o.matrix);
      if (rnd() < 0.18 && nm < 120) {
        o.position.set(x, h + 3.2 * s, z); o.scale.set(s, s * 0.9, s); o.updateMatrix();
        maples.setMatrixAt(nm, o.matrix); maples.setColorAt(nm++, new THREE.Color(reds[Math.floor(rnd() * reds.length)]));
        continue;
      }
      const col = new THREE.Color(greens[Math.floor(rnd() * greens.length)]);
      for (let tier = 0; tier < 3 && np < 1500; tier++) {
        const ts = s * (1 - tier * 0.24);
        o.position.set(x, h + (2.4 + tier * 1.5) * s, z); o.scale.setScalar(ts); o.updateMatrix();
        pines.setMatrixAt(np, o.matrix); pines.setColorAt(np++, col);
      }
    }
    pines.count = np; trunks.count = nt; maples.count = nm;
    for (const m of [pines, trunks, maples]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  }

  // ---------------- watchtowers the road drives through
  for (const t of track.def.towers ?? []) scene.add(tower(track, Math.floor(t * N) % N));

  // ---------------- pennant flags and lanterns along the battlements
  const flags: THREE.Mesh[] = [];
  {
    const poleMat = new THREE.MeshStandardMaterial({ color: CHARCOAL, roughness: 0.6 });
    const flagCols = [RED, YELLOW, ORANGE, SAGE];
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(2.2, -0.45); shape.lineTo(0, -0.95); shape.closePath();
    const flagGeo = new THREE.ShapeGeometry(shape);
    const towerAt = (track.def.towers ?? []).map((t) => Math.floor(t * N));
    for (let i = 20, k = 0; i < N - 10; i += 26, k++) {
      if (towerAt.some((ti) => Math.abs(ti - i) < 14)) continue;
      const p = pts[i], s = track.side(i), sd = k % 2 ? 1 : -1;
      const x = p.x + s.x * track.wallOffset * sd, z = p.z + s.z * track.wallOffset * sd;
      if (scs.some((sc) => nearShortcut(sc, x, z).dist < sc.halfWidth + 3)) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.2, 6), poleMat);
      pole.position.set(x, p.y + 1.1 + 2.1, z); scene.add(pole);
      if (k % 3 === 1) {
        // a lantern on a hook instead of a flag
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), poleMat);
        arm.position.set(x, p.y + 5.1, z); arm.rotation.y = yawAt(track.path, i) + Math.PI / 2; scene.add(arm);
        const l = lantern(0.8); l.position.set(x - s.x * 0.5 * sd, p.y + 4.3, z - s.z * 0.5 * sd); scene.add(l);
        continue;
      }
      const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: flagCols[k % flagCols.length], side: THREE.DoubleSide, roughness: 0.8 }));
      flag.position.set(x, p.y + 5.2, z); flag.rotation.y = yawAt(track.path, i) + Math.PI / 2 + Math.PI;
      flag.userData.base = flag.rotation.y; flag.userData.ph = rnd() * 6;
      flag.castShadow = true; scene.add(flag); flags.push(flag);
    }
  }

  // ---------------- far away: a second wall snaking over a distant ridge
  scene.add(distantWall(rnd));

  return {
    update(_target: THREE.Vector3, time: number) {
      cloudTex.offset.set(time * 0.0025, time * 0.001);
      tex2.offset.set(-time * 0.004, time * 0.002);
      for (const w of wisps) w.position.x = w.userData.x0 + Math.sin(time * 0.05 * w.userData.drift) * 12;
      for (const f of flags) f.rotation.y = f.userData.base + Math.sin(time * 3 + f.userData.ph) * 0.25;
    },
  };
}

/** Nearest main-road sample: distance and the road height there. */
function nearestMain(track: Track, x: number, z: number): { d: number; y: number } {
  const P = track.path.pts;
  let bd = Infinity, by = 0;
  for (let i = 0; i < P.length; i += 2) { const p = P[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; by = p.y; } }
  return { d: Math.sqrt(bd), y: by };
}

/** Distance to a shortcut between samples k0..k1, with the height there. */
function nearSc(sc: ShortcutPath, x: number, z: number, k0 = 0, k1 = sc.pts.length - 1): { d: number; y: number } {
  let bd = Infinity, by = 0;
  for (let k = k0; k <= k1; k++) { const p = sc.pts[k], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; by = p.y; } }
  return { d: Math.sqrt(bd), y: by };
}

/** Smooth value noise, so slopes are lumpy but the same on every computer. */
function noise2(x: number, z: number): number {
  const h = (i: number, j: number) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = h(ix, iz), b = h(ix + 1, iz), c = h(ix, iz + 1), d = h(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, z: number) => noise2(x, z) * 0.6 + noise2(x * 2.1, z * 2.1) * 0.28 + noise2(x * 4.3, z * 4.3) * 0.12;

/**
 * Ground height anywhere: a ridge crest under the wall a little below the walkway, falling away
 * into deep valleys; tall peaks around; a rocky spur over the tunnel; a deep gorge under the bridge.
 */
function terrainHeight(track: Track): (x: number, z: number) => number {
  const W = track.wallOffset + 0.4, scs = track.route.shortcuts;
  const peaks: [number, number, number, number][] = [
    [62, 14, 20, 34], [182, 22, 16, 30], [-62, -48, 34, 46], [318, -40, 30, 44], [150, 148, 26, 50],
    [-48, 118, 24, 40], [256, 150, 30, 46], [112, -122, 34, 50], [330, 118, 26, 40], [20, -130, 24, 40], [-90, 30, 26, 40],
  ];
  const ends = new Map(scs.filter((sc) => sc.kind === 'tunnel').map((sc) => [sc, tunnelEnds(track, sc)] as const));
  return (x, z) => {
    let h = -26 + fbm(x * 0.03, z * 0.03) * 10;
    for (const [px, pz, top, r] of peaks) {
      const d = Math.hypot(x - px, z - pz) / r;
      if (d < 1.6) h = Math.max(h, -26 + (top + 26) * Math.max(0, 1 - Math.pow(d, 0.85)) + fbm(x * 0.08, z * 0.08) * 5);
    }
    // the ridge the wall stands on
    const m = nearestMain(track, x, z), crest = m.y - 2.4, e = Math.max(0, m.d - W - 1);
    h = Math.max(h, crest - e * 0.62 - e * e * 0.009 + (e > 0 ? (fbm(x * 0.1, z * 0.1) - 0.5) * Math.min(3, e * 0.3) : 0));
    for (const sc of scs) {
      if (sc.kind === 'trail') {
        const t = nearSc(sc, x, z), te = Math.max(0, t.d - sc.halfWidth - 1.5);
        h = Math.max(h, t.y - 0.15 - te * 0.5 - te * te * 0.008);
      }
      if (sc.kind === 'tunnel') {
        // the spur: a rocky hump over the covered part of the tunnel
        const [k0, k1] = ends.get(sc)!, t = nearSc(sc, x, z, k0 + 1, k1 - 1), te = Math.max(0, t.d - 4);
        h = Math.max(h, t.y + 7.6 - te * 0.6 + (fbm(x * 0.12, z * 0.12) - 0.5) * 2.5);
      }
    }
    // never over a road: beside the wall the hillside stays below the walkway
    if (m.d < W + 1) h = Math.min(h, crest);
    else h = Math.min(h, m.y - 0.6 + (m.d - W - 1) * 0.9);
    for (const sc of scs) {
      const n = sc.pts.length;
      if (sc.kind === 'planks') {
        const t = nearSc(sc, x, z);
        if (t.d < sc.halfWidth + 6) h = Math.min(h, t.y - 14 + Math.max(0, W + 2 - m.d) * 3);
      } else if (sc.kind === 'tunnel') {
        // open cuttings from the wall up to each portal
        const [p0, p1] = ends.get(sc)!;
        for (const [k0, k1] of [[0, p0], [p1, n - 1]]) {
          const t = nearSc(sc, x, z, k0, k1);
          if (t.d < sc.halfWidth + 1.4) h = Math.min(h, t.y - 0.1);
        }
      } else if (sc.kind === 'trail') {
        const t = nearSc(sc, x, z);
        if (t.d < sc.halfWidth + 1.2) h = Math.min(h, t.y - 0.15);
      }
    }
    return h;
  };
}

function terrainMesh(height: (x: number, z: number) => number): THREE.Mesh {
  const x0 = -150, x1 = 410, z0 = -200, z1 = 240, step = 3;
  const nx = Math.round((x1 - x0) / step) + 1, nz = Math.round((z1 - z0) / step) + 1;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), idx: number[] = [];
  const H: number[] = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) H.push(height(x0 + i * step, z0 + j * step));
  const valley = new THREE.Color(0x4a5a4a), grass = new THREE.Color(0x6e8a5e), rock = new THREE.Color(0x857a7c), rockHi = new THREE.Color(0xa99c98), c = new THREE.Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, h = H[k], x = x0 + i * step, z = z0 + j * step;
    pos.set([x, h, z], k * 3);
    const hx = H[j * nx + Math.min(nx - 1, i + 1)] - H[j * nx + Math.max(0, i - 1)], hz = H[Math.min(nz - 1, j + 1) * nx + i] - H[Math.max(0, j - 1) * nx + i];
    const slope = Math.hypot(hx, hz) / (2 * step);
    // flat-ish = grass, steep = rock, high = pale rock; a little noise so it is not banded
    const n = fbm(x * 0.07, z * 0.07);
    c.copy(h < -12 ? valley : grass);
    if (slope > 0.55 + n * 0.3) c.lerp(rock, Math.min(1, (slope - 0.45) * 1.6));
    if (h > 14 + n * 6) c.lerp(rockHi, 0.7);
    c.offsetHSL(0, 0, (n - 0.5) * 0.06);
    col.set([c.r, c.g, c.b], k * 3);
    if (i < nx - 1 && j < nz - 1) idx.push(k, k + nx, k + 1, k + 1, k + nx, k + nx + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  m.receiveShadow = true;
  return m;
}

/**
 * A two-storey watchtower astride the wall: stone piers either side, a lintel over the road,
 * battlements on top and a red pavilion with a dark upswept roof. Lanterns hang over the way through.
 */
function tower(track: Track, i: number): THREE.Group {
  const g = new THREE.Group(), p = track.path.pts[i], yaw = yawAt(track.path, i), W = track.wallOffset;
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(true), color: 0xe0d6c8, roughness: 0.95 });
  const D = 10, CLEAR = 6.2, TOP = CLEAR + 2.6;
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b;
  };
  // piers outside the parapets, down into the ridge
  for (const sd of [1, -1]) box(3.6, TOP + 10, D, sd * (W + 2.1), (TOP - 10) / 2, 0, stone);
  // lintel over the road
  box(2 * (W + 3.9), TOP - CLEAR, D, 0, (CLEAR + TOP) / 2, 0, stone);
  // a red band with yellow trim and a plaque on both faces
  const red = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.6 });
  const gold = new THREE.MeshStandardMaterial({ color: YELLOW, emissive: ORANGE, emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.5 });
  box(2 * (W + 3.95), 0.5, D + 0.1, 0, CLEAR + 0.25, 0, red);
  for (const sz of [1, -1]) { box(4.2, 1.5, 0.2, 0, CLEAR + 1.5, sz * (D / 2 + 0.1), red); box(4.6, 0.12, 0.25, 0, CLEAR + 2.3, sz * (D / 2 + 0.12), gold); box(4.6, 0.12, 0.25, 0, CLEAR + 0.7, sz * (D / 2 + 0.12), gold); }
  // battlements round the roof
  const merlon = new THREE.BoxGeometry(1.2, 0.9, 0.7);
  const span = W + 3.9;
  for (let x = -span + 0.6; x <= span - 0.5; x += 2.2) for (const sz of [1, -1]) { const m = new THREE.Mesh(merlon, stone); m.position.set(x, TOP + 0.45, sz * (D / 2 - 0.35)); m.castShadow = true; g.add(m); }
  for (let z = -D / 2 + 1.6; z <= D / 2 - 1.5; z += 2.2) for (const sx of [1, -1]) { const m = new THREE.Mesh(merlon, stone); m.rotation.y = Math.PI / 2; m.position.set(sx * (span - 0.35), TOP + 0.45, z); m.castShadow = true; g.add(m); }
  // the pavilion: red pillars and a two-tier dark roof with upswept corners and golden ridge
  const pw = 7, pd = 5.5, ph = 3.4;
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, ph, 10), red);
    col.position.set(sx * pw / 2, TOP + ph / 2, sz * pd / 2); col.castShadow = true; g.add(col);
  }
  box(pw - 0.4, ph * 0.7, pd - 0.4, 0, TOP + ph * 0.35, 0, new THREE.MeshStandardMaterial({ color: 0x6b3a32, roughness: 0.8 }));
  box(pw + 0.6, 0.35, pd + 0.6, 0, TOP + ph, 0, red);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.7, flatShading: true });
  const roof = (w: number, d: number, h: number, y: number) => {
    const r = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2 * 2, h, 4, 1), roofMat);
    r.rotation.y = Math.PI / 4; r.scale.set(w / 2, 1, d / 2); r.position.y = y + h / 2; r.castShadow = true; g.add(r);
    // upswept corners
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 6), gold);
      tip.position.set(sx * w / 2, y + 0.35, sz * d / 2); tip.rotation.set(sz * 0.9, 0, -sx * 0.9); g.add(tip);
    }
  };
  roof(pw + 3.6, pd + 3.6, 2.2, TOP + ph + 0.15);
  roof(pw + 0.6, pd + 0.6, 2.6, TOP + ph + 2.0);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), gold); finial.position.y = TOP + ph + 4.8; g.add(finial);
  // lanterns over the way through, both faces
  for (const sz of [1, -1]) for (const sx of [-4.2, 4.2]) { const l = lantern(0.9); l.position.set(sx, CLEAR - 1.1, sz * (D / 2 + 0.6)); g.add(l); }
  g.position.set(p.x, p.y, p.z); g.rotation.y = yaw;
  return g;
}

/** A thin stone wall with little towers following a far ridge line: the wall goes on and on. */
function distantWall(rnd: () => number): THREE.Group {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8f8296, roughness: 1 });
  const ridgeMat = new THREE.MeshStandardMaterial({ color: THEME.mountainRock[0], roughness: 1, flatShading: true });
  // a long ridge line far off to the north and east, rising out of the cloud sea
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= 80; k++) {
    const a = -1.5 + (k / 80) * 2.3, r = 360 + Math.sin(k * 0.3) * 25;
    pts.push(new THREE.Vector3(130 + Math.cos(a) * r, 4 + Math.sin(k * 0.45) * 7 + Math.sin(k * 0.13) * 9 + 9, 15 + Math.sin(a) * r * 0.85));
  }
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1], len = a.distanceTo(b);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, len + 0.6), wallMat);
    seg.position.copy(a).add(b).multiplyScalar(0.5); seg.position.y += 1.2; seg.lookAt(b.x, b.y + 1.2, b.z); g.add(seg);
    // broad rounded hills under the wall, overlapping into one ridge
    if (k % 2 === 0) {
      const r = 34 + rnd() * 14, hill = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), ridgeMat);
      const sy = (a.y + 18) / r;
      hill.scale.set(1, sy, 0.8); hill.position.set(a.x, a.y - r * sy + 0.4, a.z); g.add(hill);
    }
    if (k % 9 === 4) { const t = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 5), wallMat); t.position.set(a.x, a.y + 2.6, a.z); g.add(t); }
  }
  return g;
}

/** Soft, tileable cloud texture (white blobs on transparent). */
function cloudTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  let seed = 5; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 70; k++) {
    const x = r() * 256, y = r() * 256, rad = 12 + r() * 40;
    for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function puffTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
