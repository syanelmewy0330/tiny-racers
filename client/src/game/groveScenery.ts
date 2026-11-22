import * as THREE from 'three';
import { yawAt } from '@shared/trackMath';
import type { Track } from './Track';
import type { Snowfall } from './frostScenery';
import { SUN_DIR } from './theme';

/**
 * Lantern Grove scenery (test): giant trees, root arches over the road, strings of paper
 * lanterns, glowing mushrooms, a stream with a wooden bridge, a pond, the moon, stars and
 * fireflies. Display only: nothing here changes how karts drive (mud lives in Track).
 */
const CHARCOAL = 0x1c1f26, YELLOW = 0xfcc945, ORANGE = 0xff8a00, SAGE = 0x7aa58a, LAVENDER = 0x8f84d9, SKY = 0x6ca9e6;
type Clear = (x: number, z: number, margin: number) => boolean;

export function groveScenery(scene: THREE.Object3D, track: Track, rnd: () => number, clear: Clear): Snowfall {
  const pts = track.path.pts, N = pts.length;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const at = (t: number) => Math.floor(t * N) % N;

  // ---------------- the stream: from a pond inside the loop, under the bridge, out into the forest
  const bridgeI = at(0.36), bp = pts[bridgeI];
  const pond = { x: 130, z: 30, r: 13 };
  const streamCtl: [number, number][] = [[pond.x + 4, pond.z - pond.r + 2], [138, 5], [bp.x - 4, -12], [bp.x, bp.z], [bp.x + 6, -45], [bp.x - 6, -70], [bp.x + 10, -100], [bp.x + 2, -140]];
  const curve = new THREE.CatmullRomCurve3(streamCtl.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const stream = curve.getSpacedPoints(120);
  const nearStream = (x: number, z: number, m: number) => stream.some((p) => Math.hypot(p.x - x, p.z - z) < 4 + m) || Math.hypot(x - pond.x, z - pond.z) < pond.r + m;
  const water = new THREE.MeshStandardMaterial({ color: 0x1d3c62, roughness: 0.12, metalness: 0.4, emissive: 0x12305a, emissiveIntensity: 0.5 });
  {
    const pos: number[] = [], idx: number[] = [];
    stream.forEach((p, k) => {
      const q = stream[Math.min(stream.length - 1, k + 1)], o = stream[Math.max(0, k - 1)];
      const yaw = Math.atan2(q.x - o.x, q.z - o.z), sx = Math.cos(yaw), sz = -Math.sin(yaw), w = 3.4 + Math.sin(k * 0.3) * 0.5;
      pos.push(p.x + sx * w, 0.03, p.z + sz * w, p.x - sx * w, 0.03, p.z - sz * w);
      if (k < stream.length - 1) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, water); m.receiveShadow = true; scene.add(m);
    const pm = new THREE.Mesh(new THREE.CircleGeometry(pond.r, 40), water); pm.rotation.x = -Math.PI / 2; pm.position.set(pond.x, 0.03, pond.z); scene.add(pm);
    // lily pads with tiny lanterns floating on the pond
    const pad = new THREE.MeshStandardMaterial({ color: SAGE, roughness: 0.8, side: THREE.DoubleSide });
    for (let k = 0; k < 9; k++) {
      const a = rnd() * 6.28, r = rnd() * pond.r * 0.8;
      const lp = new THREE.Mesh(new THREE.CircleGeometry(0.8 + rnd() * 0.5, 12, 0.3, 5.8), pad); lp.rotation.x = -Math.PI / 2; lp.position.set(pond.x + Math.cos(a) * r, 0.05, pond.z + Math.sin(a) * r); scene.add(lp);
      if (k % 3 === 0) { const l = lantern(k % 2 ? YELLOW : ORANGE, 0.6); l.position.set(lp.position.x, 0.3, lp.position.z); scene.add(l); }
    }
  }

  // ---------------- wooden bridge deck and railings over the stream
  {
    const a = at(0.343), b = at(0.377), half = track.def.roadHalfWidth + 1.2;
    const tex = plankTexture();
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = a, k = 0; i <= b; i++, k++) {
      const p = pts[i], s = track.side(i);
      pos.push(p.x + s.x * half, 0.085, p.z + s.z * half, p.x - s.x * half, 0.085, p.z - s.z * half);
      uv.push(0, k / 3, 1, k / 3);
      if (i < b) { const q = k * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const deck = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 })); deck.receiveShadow = true; scene.add(deck);
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a31, roughness: 0.9 });
    for (const sd of [-1, 1]) {
      for (let i = a; i <= b; i += 4) {
        const p = pts[i], s = track.side(i), off = track.wallOffset + 0.2;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.9, 0.3), wood); post.position.set(p.x + s.x * off * sd, 0.95, p.z + s.z * off * sd); post.castShadow = true; scene.add(post);
      }
      const p0 = pts[a], p1 = pts[b], s0 = track.side(a), s1 = track.side(b), off = track.wallOffset + 0.2;
      const x0 = p0.x + s0.x * off * sd, z0 = p0.z + s0.z * off * sd, x1 = p1.x + s1.x * off * sd, z1 = p1.z + s1.z * off * sd;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, Math.hypot(x1 - x0, z1 - z0)), wood);
      rail.position.set((x0 + x1) / 2, 1.8, (z0 + z1) / 2); rail.rotation.y = Math.atan2(x1 - x0, z1 - z0); scene.add(rail);
      for (const [x, z] of [[x0, z0], [x1, z1]]) { const l = lantern(YELLOW, 1); l.position.set(x, 2.35, z); scene.add(l); }
    }
    const glow = new THREE.PointLight(0xffb45a, 30, 30, 2); glow.position.set(bp.x, 4, bp.z); scene.add(glow);
  }

  // ---------------- giant trees (instanced)
  const MAX = 300;
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2a1f, roughness: 1, flatShading: true });
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 1.1, 1, 7), trunkMat, MAX);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const crowns = [0, 1, 2].map(() => new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), crownMat, MAX));
  const greens = [0x2b4c3c, 0x34604a, 0x25463a, 0x3f6b52, 0x2f4a3f];
  const o = new THREE.Object3D(); let n = 0;
  for (let tries = 0; tries < 7000 && n < MAX; tries++) {
    const x = minX - 80 + rnd() * (maxX - minX + 160), z = minZ - 80 + rnd() * (maxZ - minZ + 160);
    if (!clear(x, z, 3) || nearStream(x, z, 3)) continue;
    const s = 0.9 + rnd() * 1.3, h = 7 * s + rnd() * 4;
    o.rotation.set(0, rnd() * 6, 0);
    o.position.set(x, h / 2, z); o.scale.set(s, h, s); o.updateMatrix(); trunks.setMatrixAt(n, o.matrix);
    const col = new THREE.Color(greens[Math.floor(rnd() * greens.length)]);
    for (let c = 0; c < 3; c++) {
      const r = s * (3.2 - c * 0.6) * (0.85 + rnd() * 0.3);
      o.position.set(x + (rnd() - 0.5) * s * 2, h + c * s * 1.6 - s, z + (rnd() - 0.5) * s * 2); o.scale.set(r, r * 0.8, r); o.updateMatrix();
      crowns[c].setMatrixAt(n, o.matrix); crowns[c].setColorAt(n, col);
    }
    n++;
  }
  for (const m of [trunks, ...crowns]) { m.count = n; m.castShadow = true; m.receiveShadow = true; scene.add(m); }

  // ferns and bushes
  const bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 }), 260);
  n = 0;
  for (let tries = 0; tries < 3000 && n < 260; tries++) {
    const x = minX - 50 + rnd() * (maxX - minX + 100), z = minZ - 50 + rnd() * (maxZ - minZ + 100);
    if (!clear(x, z, 0.6) || nearStream(x, z, 0.5)) continue;
    o.rotation.set(0, rnd() * 6, 0); o.position.set(x, 0.3, z); o.scale.set(0.8 + rnd() * 1.4, 0.5 + rnd() * 0.6, 0.8 + rnd() * 1.4); o.updateMatrix();
    bush.setMatrixAt(n, o.matrix); bush.setColorAt(n, new THREE.Color([0x2f5a43, 0x3b6e52, 0x284a3a][n % 3])); n++;
  }
  bush.count = n; bush.receiveShadow = true; scene.add(bush);

  // ---------------- root arches over the road
  const bark = new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 1, flatShading: true });
  const moss = new THREE.MeshStandardMaterial({ color: SAGE, roughness: 1, flatShading: true });
  for (const t of [0.12, 0.49, 0.8]) {
    const i = at(t), p = pts[i], s = track.side(i), w = track.wallOffset + 2.5;
    const ctl = [
      new THREE.Vector3(p.x + s.x * (w + 4), -0.5, p.z + s.z * (w + 4)), new THREE.Vector3(p.x + s.x * w, 4, p.z + s.z * w),
      new THREE.Vector3(p.x + s.x * w * 0.4, 8.5, p.z + s.z * w * 0.4), new THREE.Vector3(p.x - s.x * w * 0.4, 8.8, p.z - s.z * w * 0.4),
      new THREE.Vector3(p.x - s.x * w, 4.2, p.z - s.z * w), new THREE.Vector3(p.x - s.x * (w + 5), -0.5, p.z - s.z * (w + 5)),
    ];
    const root = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ctl), 40, 1.05, 8), bark); root.castShadow = true; scene.add(root);
    // a thinner root twisting alongside
    const ctl2 = ctl.map((v, k) => v.clone().add(new THREE.Vector3(Math.sin(k) * 1.2, k === 0 || k === 5 ? 0 : 0.6, Math.cos(k) * 1.2)));
    const root2 = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ctl2), 40, 0.45, 6), bark); root2.castShadow = true; scene.add(root2);
    for (let k = 0; k < 7; k++) { const q = new THREE.CatmullRomCurve3(ctl).getPoint(0.15 + k * 0.11); const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + rnd() * 0.3, 0), moss); m.position.copy(q).add(new THREE.Vector3(0, 0.8, 0)); scene.add(m); }
    // lanterns hanging from the arch
    for (const f of [0.35, 0.5, 0.65]) {
      const q = new THREE.CatmullRomCurve3(ctl).getPoint(f);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 4), new THREE.MeshBasicMaterial({ color: 0x1a1410 })); rope.position.set(q.x, q.y - 1.5, q.z); scene.add(rope);
      const l = lantern(f === 0.5 ? ORANGE : YELLOW, 1.2); l.position.set(q.x, q.y - 2.5, q.z); scene.add(l);
    }
  }

  // ---------------- strings of paper lanterns along the road
  const colours = [YELLOW, ORANGE, 0xf6a6c1, LAVENDER, SAGE];
  const lampMats = colours.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.2, roughness: 0.6 }));
  const lampGeo = new THREE.SphereGeometry(0.38, 12, 10);
  const lamps = lampMats.map((m) => new THREE.InstancedMesh(lampGeo, m, 400));
  const lampCount = colours.map(() => 0);
  const ropePos: number[] = [];
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 1 });
  const POST_STEP = 20;
  for (const sd of [-1, 1]) {
    let prev: THREE.Vector3 | null = null;
    for (let i = (sd > 0 ? 0 : POST_STEP / 2); i < N + POST_STEP; i += POST_STEP) {
      const k = i % N, p = pts[k], s = track.side(k), off = track.wallOffset + 1.4;
      const x = p.x + s.x * off * sd, z = p.z + s.z * off * sd;
      if (!(Math.abs(i - bridgeI) > 14)) { prev = null; continue; }
      const top = new THREE.Vector3(x, 4.6, z);
      if (i < N) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 4.8, 6), postMat); post.position.set(x, 2.4, z); post.castShadow = true; scene.add(post);
      }
      if (prev && prev.distanceTo(top) < POST_STEP * 1.6) {
        const segs = 8;
        for (let q = 0; q < segs; q++) {
          const a = prev.clone().lerp(top, q / segs), b = prev.clone().lerp(top, (q + 1) / segs);
          a.y -= Math.sin((q / segs) * Math.PI) * 1.2; b.y -= Math.sin(((q + 1) / segs) * Math.PI) * 1.2;
          ropePos.push(a.x, a.y, a.z, b.x, b.y, b.z);
          if (q > 0 && q % 2 === 0) {
            const c = Math.floor(rnd() * colours.length);
            o.position.set(a.x, a.y - 0.45, a.z); o.rotation.set(0, 0, 0); o.scale.set(1, 1.25, 1); o.updateMatrix(); lamps[c].setMatrixAt(lampCount[c]++, o.matrix);
          }
        }
      }
      prev = top;
    }
  }
  lamps.forEach((m, c) => { m.count = lampCount[c]; scene.add(m); });
  const ropeGeo = new THREE.BufferGeometry(); ropeGeo.setAttribute('position', new THREE.Float32BufferAttribute(ropePos, 3));
  scene.add(new THREE.LineSegments(ropeGeo, new THREE.LineBasicMaterial({ color: 0x15110d })));
  // a few warm lights so the road glows under the lanterns
  for (const t of [0.0, 0.12, 0.25, 0.49, 0.62, 0.8, 0.92]) {
    const p = pts[at(t)]; const l = new THREE.PointLight(0xffb45a, 26, 34, 2); l.position.set(p.x, 6, p.z); scene.add(l);
  }

  // ---------------- glowing mushrooms near the road
  for (let k = 0; k < 26; k++) {
    let x = 0, z = 0, ok = false;
    for (let t = 0; t < 40; t++) { const i = Math.floor(rnd() * N), p = pts[i], s = track.side(i), off = (track.wallOffset + 2 + rnd() * 6) * (rnd() < 0.5 ? 1 : -1); x = p.x + s.x * off; z = p.z + s.z * off; if (clear(x, z, 1) && !nearStream(x, z, 1)) { ok = true; break; } }
    if (ok) scene.add(glowShroom(x, z, 0.7 + rnd() * 0.9, [LAVENDER, SKY, SAGE][k % 3]));
  }

  // ---------------- moon and stars
  const moon = new THREE.Mesh(new THREE.SphereGeometry(36, 32, 20), new THREE.MeshBasicMaterial({ color: 0xf2f4ff, fog: false }));
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  moon.position.set(cx, 0, cz).addScaledVector(SUN_DIR, 1000); scene.add(moon);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(70, 24, 16), new THREE.MeshBasicMaterial({ color: 0x8fa2e8, transparent: true, opacity: 0.12, fog: false, depthWrite: false }));
  halo.position.copy(moon.position); scene.add(halo);
  const starPos: number[] = [];
  for (let k = 0; k < 900; k++) {
    const a = rnd() * Math.PI * 2, e = 0.12 + rnd() * 1.3, r = 1250;
    starPos.push(cx + Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r * 0.8, cz + Math.sin(a) * Math.cos(e) * r);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));

  // ---------------- fireflies: drift and blink all around the track
  const COUNT = 700;
  const ff = new THREE.BufferGeometry(), fpos = new Float32Array(COUNT * 3), fcol = new Float32Array(COUNT * 3), seeds = new Float32Array(COUNT * 4);
  for (let k = 0; k < COUNT; k++) {
    let x = 0, z = 0;
    for (let t = 0; t < 10; t++) { x = minX - 30 + rnd() * (maxX - minX + 60); z = minZ - 30 + rnd() * (maxZ - minZ + 60); if (clear(x, z, -track.wallOffset + 2)) break; }
    seeds[k * 4] = x; seeds[k * 4 + 1] = 0.6 + rnd() * 4.5; seeds[k * 4 + 2] = z; seeds[k * 4 + 3] = rnd() * 100;
  }
  ff.setAttribute('position', new THREE.BufferAttribute(fpos, 3)); ff.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
  const flies = new THREE.Points(ff, new THREE.PointsMaterial({ size: 0.85, map: glowDot(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  flies.frustumCulled = false; scene.add(flies);
  const base = new THREE.Color(0xfff07a);
  const update = (_target: THREE.Vector3, time: number) => {
    for (let k = 0; k < COUNT; k++) {
      const s = seeds[k * 4 + 3];
      fpos[k * 3] = seeds[k * 4] + Math.sin(time * 0.3 + s) * 1.6;
      fpos[k * 3 + 1] = seeds[k * 4 + 1] + Math.sin(time * 0.7 + s * 2) * 0.5;
      fpos[k * 3 + 2] = seeds[k * 4 + 2] + Math.cos(time * 0.25 + s) * 1.6;
      const blink = Math.max(0, Math.sin(time * (1.2 + (s % 1.3)) + s * 7)) ** 3;
      fcol[k * 3] = base.r * (0.15 + blink * 1.6); fcol[k * 3 + 1] = base.g * (0.15 + blink * 1.6); fcol[k * 3 + 2] = base.b * (0.15 + blink * 1.6);
    }
    (ff.attributes.position as THREE.BufferAttribute).needsUpdate = true; (ff.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  };
  update(new THREE.Vector3(), 0);
  void yawAt; void CHARCOAL;
  return { update };
}

/** A round paper lantern: glowing body, dark cap and base. */
function lantern(colour: number, s: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 2.4, roughness: 0.6 }));
  body.scale.y = 1.2; g.add(body);
  const cap = new THREE.MeshStandardMaterial({ color: CHARCOAL });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.12, 10), cap); top.position.y = 0.52; g.add(top);
  const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.1, 10), cap); bot.position.y = -0.5; g.add(bot);
  g.scale.setScalar(s);
  return g;
}

/** A mushroom with a softly glowing cap and dots. */
function glowShroom(x: number, z: number, s: number, colour: number): THREE.Group {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.1, 10), new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.9 }));
  stem.position.y = 0.55; g.add(stem);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 1.3, roughness: 0.5 }));
  cap.position.y = 1.0; cap.scale.set(1, 0.65, 1); g.add(cap);
  const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2 });
  for (let i = 0; i < 5; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), dotMat); const a = i * 1.3; d.position.set(Math.cos(a) * 0.5, 1.4, Math.sin(a) * 0.5); g.add(d); }
  g.position.set(x, 0, z); g.scale.setScalar(s);
  return g;
}

function plankTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 128; y += 32) {
    g.fillStyle = ['#7a5636', '#6e4c2f', '#835d3b', '#74502f'][y / 32]; g.fillRect(0, y, 256, 32);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y + 29, 256, 3);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(12, y + 13, 5, 5); g.fillRect(238, y + 13, 5, 5);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function glowDot(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.7)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
