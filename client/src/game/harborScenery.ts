import * as THREE from 'three';
import { yawAt } from '@shared/trackMath';
import type { Track } from './Track';
import type { Snowfall } from './frostScenery';

/**
 * Neon Harbor scenery (test): a rainy night at the docks. Warehouses with neon signs and lit
 * windows, stacks of shipping containers, two big cranes on the quay, dark harbour water with
 * neon reflections, street lamps, traffic cones, and rain falling around the camera.
 * Display only: nothing here changes how karts drive (puddles and the bridge live in Track).
 */
const CHARCOAL = 0x1c1f26, ORANGE = 0xff8a00, YELLOW = 0xfcc945, RED = 0xe54b4b, SAGE = 0x7aa58a, SKY = 0x6ca9e6, LAVENDER = 0x8f84d9, OFF = 0xf2f2f0;
type Clear = (x: number, z: number, margin: number) => boolean;

/** Original shop names for the neon signs (nothing borrowed). */
const SIGNS: { text: string; col: string }[] = [
  { text: 'NOODLE BAR', col: '#E54B4B' }, { text: 'HARBOR 8', col: '#8F84D9' }, { text: 'OPEN 24H', col: '#6CA9E6' },
  { text: 'MEOW MART', col: '#FCC945' }, { text: 'TURBO TACOS', col: '#FF8A00' }, { text: 'CLOUD NINE', col: '#6CA9E6' },
  { text: 'PIER 4', col: '#E54B4B' }, { text: 'KARAOKE', col: '#8F84D9' }, { text: 'BUBBLE TEA', col: '#7AA58A' },
  { text: 'DOCK DINER', col: '#FF8A00' },
];

export function harborScenery(scene: THREE.Object3D, track: Track, rnd: () => number, clear: Clear): Snowfall {
  const pts = track.path.pts, N = pts.length;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const cx = (minX + maxX) / 2;
  const QUAY = maxZ + 26;   // the water starts here (north side)
  const o = new THREE.Object3D();

  // ---------------- the harbour: dark glossy water past the quay, with neon reflections
  {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 700), new THREE.MeshStandardMaterial({ color: 0x0d1430, roughness: 0.45, metalness: 0.2, emissive: 0x0a0f2a, emissiveIntensity: 0.6 }));
    water.rotation.x = -Math.PI / 2; water.position.set(cx, 0.05, QUAY + 350); scene.add(water);
    // quay edge: a pale concrete lip with yellow safety paint and bollards
    const lip = new THREE.Mesh(new THREE.BoxGeometry(1400, 0.6, 1.6), new THREE.MeshStandardMaterial({ color: 0x5a5e68, roughness: 0.9 }));
    lip.position.set(cx, 0.3, QUAY); lip.receiveShadow = true; scene.add(lip);
    const paint = new THREE.Mesh(new THREE.BoxGeometry(1400, 0.05, 0.35), new THREE.MeshStandardMaterial({ color: YELLOW, emissive: YELLOW, emissiveIntensity: 0.25 }));
    paint.position.set(cx, 0.62, QUAY - 0.5); scene.add(paint);
    const bollard = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.38, 0.9, 10), new THREE.MeshStandardMaterial({ color: CHARCOAL, metalness: 0.5, roughness: 0.5 }), 40);
    for (let k = 0; k < 40; k++) { o.position.set(minX - 80 + k * 11, 0.9, QUAY - 1.2); o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrix(); bollard.setMatrixAt(k, o.matrix); }
    scene.add(bollard);
    // long blurry streaks of neon colour on the water (fake reflections of the city lights)
    const streak = (x: number, col: number, w: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 60 + rnd() * 50), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.08, QUAY + 40 + rnd() * 20); scene.add(m);
    };
    for (let k = 0; k < 16; k++) streak(minX - 60 + rnd() * (maxX - minX + 120), [LAVENDER, RED, SKY, ORANGE][k % 4], 1.2 + rnd() * 2.5);
    // a little lit-up ferry out on the water, and the far shore's skyline
    scene.add(boat(cx + 40, QUAY + 70));
    skyline(scene, rnd, cx, QUAY + 260);
  }

  // ---------------- warehouses with neon signs: a row along the south and the two ends
  const winTex = windowTexture(rnd);
  const shells = [0x2a2c35, 0x30323c, 0x272a33, 0x343641];
  let sign = 0;
  const warehouse = (x: number, z: number, w: number, d: number, h: number, face: number) => {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: shells[Math.floor(rnd() * shells.length)], roughness: 0.85 });
    const t = winTex.clone(); t.needsUpdate = true; t.repeat.set(w / 12, h / 8);
    const front = new THREE.MeshStandardMaterial({ color: 0x2c2e38, map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9, roughness: 0.7 });
    // box faces: +x, -x, +y, -y, +z, -z. The front (facing the road) gets the windows.
    const mats = [wallMat, wallMat, wallMat, wallMat, front, wallMat];
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats); body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
    // flat roof edge and a rooftop water tank or vent
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), new THREE.MeshStandardMaterial({ color: 0x1f2128 })); roof.position.y = h + 0.25; g.add(roof);
    if (rnd() < 0.6) { const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 12), wallMat); tank.position.set((rnd() - 0.5) * w * 0.6, h + 1.8, (rnd() - 0.5) * d * 0.5); g.add(tank); }
    // the neon sign, on the front, glowing
    const s = SIGNS[sign++ % SIGNS.length];
    const sw = Math.min(w * 0.92, 4 + s.text.length * 1.8);
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 0.22), new THREE.MeshBasicMaterial({ map: signTexture(s.text, s.col), transparent: true, toneMapped: false }));
    neon.position.set(0, h * 0.62 + rnd() * h * 0.2, d / 2 + 0.12); g.add(neon);
    // a light-strip along the roofline in the sign's colour
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.18), new THREE.MeshBasicMaterial({ color: new THREE.Color(s.col).multiplyScalar(1.6), toneMapped: false }));
    strip.position.set(0, h - 0.3, d / 2 + 0.1); g.add(strip);
    // a roll-up door with a little lamp over it
    const door = new THREE.Mesh(new THREE.PlaneGeometry(4, 4.4), new THREE.MeshStandardMaterial({ color: 0x4a4f5a, roughness: 0.6, metalness: 0.4 }));
    door.position.set(-w * 0.25, 2.2, d / 2 + 0.05); g.add(door);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false })); lamp.position.set(-w * 0.25, 4.8, d / 2 + 0.3); g.add(lamp);
    g.position.set(x, 0, z); g.rotation.y = face; scene.add(g);
  };
  // south row, facing north towards the track
  for (let x = minX - 50; x < maxX + 50;) {
    const w = 18 + rnd() * 14, h = 10 + rnd() * 12;
    warehouse(x + w / 2, minZ - 30 - rnd() * 6, w, 14, h, 0);
    x += w + 3 + rnd() * 4;
  }
  // west and east ends, facing the track
  for (let z = minZ - 10; z < QUAY - 14;) { const w = 16 + rnd() * 10, h = 9 + rnd() * 10; warehouse(minX - 34, z + w / 2, w, 14, h, Math.PI / 2); z += w + 4; }
  for (let z = minZ - 10; z < QUAY - 14;) { const w = 16 + rnd() * 10, h = 9 + rnd() * 10; warehouse(maxX + 34, z + w / 2, w, 14, h, -Math.PI / 2); z += w + 4; }

  // ---------------- shipping containers: stacks inside both loops and along the quay
  const CW = 2.5, CH = 2.6, CL = 12;
  const corr = corrugatedTexture();
  const cols = [ORANGE, RED, SKY, SAGE, YELLOW, LAVENDER, 0x3a3f47, OFF];
  const box = new THREE.BoxGeometry(CW, CH, CL);
  const contMats = cols.map((c) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c).multiplyScalar(c === OFF ? 0.75 : 0.62), map: corr, roughness: 0.55, metalness: 0.3 }));
  const conts = contMats.map((m) => new THREE.InstancedMesh(box, m, 120));
  const counts = cols.map(() => 0);
  const stack = (x: number, z: number, yaw: number, levels: number) => {
    // all four corners must be clear of the road
    const fx = Math.sin(yaw) * CL / 2, fz = Math.cos(yaw) * CL / 2;
    if (!clear(x + fx, z + fz, 3) || !clear(x - fx, z - fz, 3)) return false;
    for (let l = 0; l < levels; l++) {
      const c = Math.floor(rnd() * cols.length);
      if (counts[c] >= 120) continue;
      o.position.set(x + (rnd() - 0.5) * 0.3, CH / 2 + l * CH, z + (rnd() - 0.5) * 0.3); o.rotation.set(0, yaw + (rnd() - 0.5) * 0.06, 0); o.scale.setScalar(1); o.updateMatrix();
      conts[c].setMatrixAt(counts[c]++, o.matrix);
    }
    return true;
  };
  // rows of stacks in the two infields (the middles of the 8) and along the quay
  const infield = [{ x: minX + 45, z: 0 }, { x: maxX - 28, z: 0 }];
  for (const f of infield) {
    for (let r = -2; r <= 2; r++) for (let c = -1; c <= 1; c++) {
      if (rnd() < 0.25) continue;
      stack(f.x + c * (CW + 0.5) * 2.2 + r * 0.6, f.z + r * (CL + 1.6) * 0.62, 0.12, 1 + Math.floor(rnd() * 3));
    }
  }
  for (let x = minX - 30; x < maxX + 30; x += CW + 0.4) if (rnd() < 0.55) stack(x, QUAY - 14 - rnd() * 2, 0, 1 + Math.floor(rnd() * 4));
  conts.forEach((m, c) => { m.count = counts[c]; m.castShadow = true; m.receiveShadow = true; scene.add(m); });

  // ---------------- two big gantry cranes on the quay, red lights on top
  for (const x of [cx - 70, cx + 60]) scene.add(crane(x, QUAY - 4, rnd() < 0.5 ? ORANGE : RED));

  // ---------------- street lamps along the road (glowing heads) with a few real lights
  const lampPost = new THREE.MeshStandardMaterial({ color: 0x2a2d35, metalness: 0.6, roughness: 0.4 });
  const lampHead = new THREE.MeshBasicMaterial({ color: 0xf4e6ff, toneMapped: false });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 8), armGeo = new THREE.BoxGeometry(0.12, 0.12, 2.2), headGeo = new THREE.BoxGeometry(0.5, 0.18, 1);
  const poles = new THREE.InstancedMesh(poleGeo, lampPost, 80), arms = new THREE.InstancedMesh(armGeo, lampPost, 80), heads = new THREE.InstancedMesh(headGeo, lampHead, 80);
  let lc = 0;
  for (let i = 0; i < N && lc < 80; i += 22) {
    const p = pts[i]; if (p.y > 0.3) continue;   // the bridge has its own trim lights
    const sd = (i / 22) % 2 ? 1 : -1, s = track.side(i), off = track.wallOffset + 1.2;
    const x = p.x + s.x * off * sd, z = p.z + s.z * off * sd;
    if (!clear(x, z, 0.6)) continue;
    const yaw = Math.atan2(-s.x * sd, -s.z * sd);   // arm leans out over the road
    o.rotation.set(0, 0, 0); o.position.set(x, 3.5, z); o.updateMatrix(); poles.setMatrixAt(lc, o.matrix);
    o.rotation.set(0, yaw, 0); o.position.set(x - s.x * sd * 1, 7, z - s.z * sd * 1); o.updateMatrix(); arms.setMatrixAt(lc, o.matrix);
    o.position.set(x - s.x * sd * 2, 6.88, z - s.z * sd * 2); o.updateMatrix(); heads.setMatrixAt(lc, o.matrix);
    lc++;
  }
  poles.count = arms.count = heads.count = lc;
  poles.castShadow = true; scene.add(poles, arms, heads);
  const lightCols = [LAVENDER, 0xffd9a6, SKY, RED, 0xffd9a6, LAVENDER, SKY, 0xffd9a6];
  [0.02, 0.1, 0.33, 0.42, 0.52, 0.62, 0.8, 0.9].forEach((t, k) => {
    const p = pts[Math.floor(t * N) % N]; const l = new THREE.PointLight(lightCols[k], 24, 36, 2); l.position.set(p.x, 7 + p.y, p.z); scene.add(l);
  });
  // a cool glow under the bridge, where the roads cross
  {
    const ci = Math.floor(0.209 * N), p = pts[ci];
    const l = new THREE.PointLight(LAVENDER, 40, 30, 2); l.position.set(p.x, 3, p.z); scene.add(l);
  }

  // ---------------- traffic cones and striped barriers by the road
  const coneMat = new THREE.MeshStandardMaterial({ color: ORANGE, roughness: 0.6 }), stripeMat = new THREE.MeshStandardMaterial({ color: OFF, emissive: OFF, emissiveIntensity: 0.4 });
  for (let k = 0; k < 40; k++) {
    const i = Math.floor(rnd() * N), p = pts[i]; if (p.y > 0.2) continue;
    const sd = rnd() < 0.5 ? 1 : -1, s = track.side(i), off = track.wallOffset + 0.9 + rnd() * 3;
    const x = p.x + s.x * off * sd, z = p.z + s.z * off * sd;
    if (!clear(x, z, 0.3)) continue;
    const g = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.95, 12), coneMat); cone.position.y = 0.5; cone.castShadow = true; g.add(cone);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.14, 12), stripeMat); band.position.y = 0.56; g.add(band);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.8), coneMat); foot.position.y = 0.04; g.add(foot);
    g.position.set(x, 0, z); g.rotation.y = rnd() * 6; scene.add(g);
  }

  // ---------------- painted dock markings and puddles on the open ground
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x15182a, roughness: 0.4, metalness: 0.3, emissive: 0x241f48, emissiveIntensity: 0.5 });
  for (let k = 0; k < 50; k++) {
    const x = minX - 40 + rnd() * (maxX - minX + 80), z = minZ - 20 + rnd() * (QUAY - minZ + 10);
    if (!clear(x, z, 0.5)) continue;
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 20), puddleMat);
    m.rotation.x = -Math.PI / 2; m.scale.set(1.5 + rnd() * 3, 1 + rnd() * 2, 1); m.rotation.z = rnd() * 3; m.position.set(x, 0.03, z); scene.add(m);
  }

  // ---------------- rain: streaks that fall around the camera and wrap
  const COUNT = 2600, R = 46, TOP = 26;
  const pos = new Float32Array(COUNT * 6), seed = new Float32Array(COUNT * 3);
  for (let k = 0; k < COUNT; k++) { seed[k * 3] = (rnd() - 0.5) * 2 * R; seed[k * 3 + 1] = rnd() * TOP; seed[k * 3 + 2] = (rnd() - 0.5) * 2 * R; }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xb9c3ff, transparent: true, opacity: 0.32, depthWrite: false }));
  rain.frustumCulled = false; scene.add(rain);
  const update = (target: THREE.Vector3, time: number) => {
    for (let k = 0; k < COUNT; k++) {
      const x = target.x + wrap(seed[k * 3] - target.x, R), z = target.z + wrap(seed[k * 3 + 2] - target.z, R);
      const y = ((seed[k * 3 + 1] - time * 28) % TOP + TOP) % TOP;
      const j = k * 6;
      pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
      pos[j + 3] = x + 0.08; pos[j + 4] = y + 0.9; pos[j + 5] = z + 0.05;
    }
    (rg.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  };
  update(new THREE.Vector3(), 0);
  void yawAt;
  return { update };
}

const wrap = (v: number, r: number) => ((v + r) % (2 * r) + 2 * r) % (2 * r) - r;

/** A gantry crane: two legs, a long boom out over the water, a hanging hook, warning lights. */
function crane(x: number, z: number, colour: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(colour).multiplyScalar(0.7), roughness: 0.6, metalness: 0.3 });
  const H = 34;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1, H, 1), mat); leg.position.set(sx * 6, H / 2, sz * 5); leg.castShadow = true; g.add(leg);
  }
  for (const y of [H * 0.35, H * 0.7]) for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 10), mat); b.position.set(sx * 6, y, 0); g.add(b); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(14, 2.4, 11), mat); top.position.y = H; g.add(top);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 70), mat); boom.position.set(0, H + 2.2, 22); boom.castShadow = true; g.add(boom);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3), new THREE.MeshStandardMaterial({ color: 0x2a2d35, emissive: 0xffe2b0, emissiveIntensity: 0.5 })); cab.position.set(0, H - 2.2, 10); g.add(cab);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 18, 6), new THREE.MeshStandardMaterial({ color: 0x111111 })); cable.position.set(0, H - 7, 36); g.add(cable);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 2.4), new THREE.MeshStandardMaterial({ color: YELLOW })); hook.position.set(0, H - 16.5, 36); g.add(hook);
  const red = new THREE.MeshBasicMaterial({ color: 0xff3b3b, toneMapped: false });
  for (const [lx, ly, lz] of [[-6, H + 1.5, 0], [6, H + 1.5, 0], [0, H + 3.4, 56]]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), red); l.position.set(lx, ly, lz); g.add(l); }
  g.position.set(x, 0, z);
  return g;
}

/** A small ferry with a row of lit windows, sitting on the water. */
function boat(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(26, 3, 7), new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.6 })); hull.position.y = 1.2; g.add(hull);
  const band = new THREE.Mesh(new THREE.BoxGeometry(26.1, 0.6, 7.1), new THREE.MeshStandardMaterial({ color: RED })); band.position.y = 0.4; g.add(band);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(14, 2.6, 5), new THREE.MeshStandardMaterial({ color: 0x2c2e38 })); cabin.position.set(-2, 4, 0); g.add(cabin);
  const glow = new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false });
  for (let k = 0; k < 7; k++) for (const sz of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), glow); w.position.set(-8 + k * 2, 4.1, sz * 2.52); w.rotation.y = sz > 0 ? 0 : Math.PI; g.add(w); }
  g.position.set(x, 0, z); g.rotation.y = 0.15;
  return g;
}

/** The far shore: a line of dark towers with lit windows and a few neon tops. */
function skyline(scene: THREE.Object3D, rnd: () => number, cx: number, z: number) {
  const tex = windowTexture(rnd);
  const mat = new THREE.MeshStandardMaterial({ color: 0x15151f, map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.7, fog: true });
  const tops = [LAVENDER, RED, SKY, ORANGE].map((c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
  for (let x = cx - 520; x < cx + 520;) {
    const w = 18 + rnd() * 26, h = 30 + rnd() * 90;
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, 20), mat); t.position.set(x, h / 2, z + rnd() * 40); scene.add(t);
    if (rnd() < 0.35) { const s = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 1.2, 0.4), tops[Math.floor(rnd() * 4)]); s.position.set(x, h - 2, t.position.z - 10.3); scene.add(s); }
    x += w + 2 + rnd() * 8;
  }
}

/** Dark wall with a grid of windows, some lit warm or cool. Used as both colour and glow. */
function windowTexture(rnd: () => number): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
  for (let y = 8; y < 128; y += 20) for (let x = 6; x < 128; x += 16) {
    const r = rnd();
    g.fillStyle = r < 0.45 ? '#0a0a10' : r < 0.75 ? '#ffd59a' : r < 0.9 ? '#b9c6ff' : '#ff9a8a';
    g.globalAlpha = r < 0.45 ? 1 : 0.55 + rnd() * 0.45;
    g.fillRect(x, y, 9, 11);
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Neon tube lettering: bright core, soft coloured glow, on a transparent background. */
function signTexture(text: string, col: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 512; c.height = 112;
  const g = c.getContext('2d')!;
  const FONT = 'italic 800 74px "Inter", "Trebuchet MS", sans-serif';
  const paint = () => {
    g.clearRect(0, 0, 512, 112);
    g.fillStyle = 'rgba(12,10,22,0.85)'; roundRect(g, 4, 4, 504, 104, 18); g.fill();
    g.strokeStyle = col; g.lineWidth = 4; g.shadowColor = col; g.shadowBlur = 18; roundRect(g, 10, 10, 492, 92, 14); g.stroke();
    g.font = FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 74; while (g.measureText(text).width > 450 && size > 30) { size -= 4; g.font = `italic 800 ${size}px "Inter", "Trebuchet MS", sans-serif`; }
    g.shadowBlur = 24; g.fillStyle = col; g.fillText(text, 256, 58);
    g.shadowBlur = 6; g.fillStyle = '#ffffff'; g.globalAlpha = 0.75; g.fillText(text, 256, 58); g.globalAlpha = 1;
  };
  paint();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  document.fonts?.load(FONT).then(() => { paint(); t.needsUpdate = true; }).catch(() => {});
  return t;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** Ridged metal for the shipping containers (grey, tinted by the material colour). */
function corrugatedTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 8) { g.fillStyle = '#9a9a9a'; g.fillRect(0, y, 64, 3); g.fillStyle = '#f0f0f0'; g.fillRect(0, y + 4, 64, 1); }
  g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, 64, 4); g.fillRect(0, 252, 64, 4);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
