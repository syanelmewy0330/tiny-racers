import * as THREE from 'three';
import { yawAt } from '@shared/trackMath';
import type { Track } from './Track';

/**
 * Frostbite Pass scenery (test): snowy pines, a frozen lake, cabins with glowing windows,
 * snowmen, warm lamp posts, a tunnel through the mountain and falling snow.
 * Display only: nothing here changes how karts drive (ice patches live in Track).
 */
const CHARCOAL = 0x1c1f26, ORANGE = 0xff8a00, YELLOW = 0xfcc945, LAVENDER = 0x8f84d9;
const SNOW = 0xf4f8ff;

export interface Snowfall { update(target: THREE.Vector3, time: number): void }

type Clear = (x: number, z: number, margin: number) => boolean;

export function frostScenery(scene: THREE.Scene, track: Track, rnd: () => number, clear: Clear): Snowfall {
  const pts = track.path.pts, N = pts.length;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }

  // tunnel range (sample indices), kept clear of other scenery
  const tun = track.def.tunnel ? { a: Math.floor(track.def.tunnel.from * N), b: Math.floor(track.def.tunnel.to * N) } : null;
  const nearTunnel = (x: number, z: number, m: number) => {
    if (!tun) return false;
    for (let i = tun.a - 8; i <= tun.b + 8; i += 2) { const p = pts[(i + N) % N]; if (Math.hypot(p.x - x, p.z - z) < track.wallOffset + m) return true; }
    return false;
  };

  // ---------------- frozen lake, inside the first loop
  const lake = { x: 58, z: 26, rx: 30, rz: 20 };
  for (let k = 0; k < 10 && !(clear(lake.x - lake.rx, lake.z, 3) && clear(lake.x + lake.rx, lake.z, 3) && clear(lake.x, lake.z - lake.rz, 3) && clear(lake.x, lake.z + lake.rz, 3)); k++) { lake.rx *= 0.9; lake.rz *= 0.9; }
  const inLake = (x: number, z: number, m: number) => ((x - lake.x) / (lake.rx + m)) ** 2 + ((z - lake.z) / (lake.rz + m)) ** 2 < 1;
  const lakeMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ map: lakeTexture(), color: 0xd8ecff, roughness: 0.06, metalness: 0.35, emissive: 0x6ca9e6, emissiveIntensity: 0.12 }));
  lakeMesh.rotation.x = -Math.PI / 2; lakeMesh.scale.set(lake.rx, lake.rz, 1); lakeMesh.position.set(lake.x, 0.03, lake.z); lakeMesh.receiveShadow = true;
  scene.add(lakeMesh);
  const rim = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
  rim.rotation.x = -Math.PI / 2; rim.scale.set(lake.rx, lake.rz, 1); rim.position.set(lake.x, 0.04, lake.z); scene.add(rim);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4f5878, flatShading: true, roughness: 1 });
  const snowMat = new THREE.MeshStandardMaterial({ color: SNOW, flatShading: true, roughness: 0.9 });
  for (let k = 0; k < 14; k++) {
    const a = rnd() * Math.PI * 2, x = lake.x + Math.cos(a) * lake.rx * 1.12, z = lake.z + Math.sin(a) * lake.rz * 1.12;
    if (!clear(x, z, 2)) continue;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + rnd() * 0.9, 0), k % 3 ? rockMat : snowMat);
    r.position.set(x, 0.3, z); r.rotation.set(rnd(), rnd() * 6, rnd()); r.scale.y = 0.6; r.castShadow = true; scene.add(r);
  }

  // ---------------- snowy pine trees (instanced)
  const MAX = 380;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.42, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x5a3b2b }), MAX);
  const tierGeo = new THREE.ConeGeometry(2.2, 3.2, 8);
  const capGeo = new THREE.ConeGeometry(1.25, 1.3, 8);
  const tierMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 });
  const tiers = [0, 1, 2].map(() => new THREE.InstancedMesh(tierGeo, tierMat, MAX));
  const caps = [0, 1, 2].map(() => new THREE.InstancedMesh(capGeo, new THREE.MeshStandardMaterial({ color: SNOW, flatShading: true, roughness: 0.8 }), MAX));
  const greens = [0x24493d, 0x2c5446, 0x1f4036, 0x335e4c];
  const o = new THREE.Object3D(); let n = 0;
  for (let tries = 0; tries < 6000 && n < MAX; tries++) {
    const x = minX - 70 + rnd() * (maxX - minX + 140), z = minZ - 70 + rnd() * (maxZ - minZ + 140);
    if (!clear(x, z, 3) || inLake(x, z, 4) || nearTunnel(x, z, 6)) continue;
    const s = 0.8 + rnd() * 1.0, rot = rnd() * 6;
    o.rotation.set(0, rot, 0);
    o.position.set(x, 0.8 * s, z); o.scale.setScalar(s); o.updateMatrix(); trunk.setMatrixAt(n, o.matrix);
    const col = new THREE.Color(greens[Math.floor(rnd() * greens.length)]);
    for (let t = 0; t < 3; t++) {
      const ts = s * (1 - t * 0.24);
      o.position.set(x, s * (2.6 + t * 1.75), z); o.scale.setScalar(ts); o.updateMatrix(); tiers[t].setMatrixAt(n, o.matrix); tiers[t].setColorAt(n, col);
      o.position.set(x, s * (2.6 + t * 1.75) + ts * 1.0, z); o.scale.setScalar(ts); o.updateMatrix(); caps[t].setMatrixAt(n, o.matrix);
    }
    n++;
  }
  for (const m of [trunk, ...tiers, ...caps]) { m.count = n; m.castShadow = true; m.receiveShadow = true; scene.add(m); }

  // ---------------- snow drifts
  const drifts = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: SNOW, roughness: 0.9 }), 160);
  n = 0;
  for (let tries = 0; tries < 2000 && n < 160; tries++) {
    const x = minX - 40 + rnd() * (maxX - minX + 80), z = minZ - 40 + rnd() * (maxZ - minZ + 80);
    if (!clear(x, z, 1) || inLake(x, z, 1)) continue;
    o.rotation.set(0, rnd() * 6, 0); o.position.set(x, 0, z); o.scale.set(1.5 + rnd() * 3, 0.5 + rnd() * 0.8, 1.2 + rnd() * 2); o.updateMatrix(); drifts.setMatrixAt(n++, o.matrix);
  }
  drifts.count = n; drifts.receiveShadow = true; scene.add(drifts);

  // ---------------- cabins with warm windows, by the lake and the start
  const spots: [number, number][] = [[lake.x - lake.rx - 2, lake.z - 14], [lake.x + 6, lake.z + lake.rz + 9], [lake.x + lake.rx + 4, lake.z - 6], [-26, 10], [-24, 40], [120, 30], [150, 26], [250, -6], [70, 120], [20, -60]];
  for (const [x0, z0] of spots) {
    let x = x0, z = z0, ok = false;
    for (let t = 0; t < 30; t++) { if (clear(x, z, 5) && !inLake(x, z, 4) && !nearTunnel(x, z, 8)) { ok = true; break; } x = x0 + (rnd() - 0.5) * 20; z = z0 + (rnd() - 0.5) * 20; }
    if (!ok) continue;
    const near = nearestIdx(track, x, z), p = pts[near];
    scene.add(cabin(x, z, Math.atan2(p.x - x, p.z - z), rnd));
  }

  // ---------------- snowmen near the start
  for (const [x0, z0, s] of [[-17, 20, 1], [17, -6, 0.85], [-19, -30, 1.1]] as const) {
    if (clear(x0, z0, 1.5)) scene.add(snowman(x0, z0, s, rnd));
  }

  // ---------------- warm lamp posts along the road (skip the tunnel)
  const postMat = new THREE.MeshStandardMaterial({ color: CHARCOAL, metalness: 0.5, roughness: 0.5 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffb24a, emissiveIntensity: 3 });
  const lamps = 28;
  for (let k = 0; k < lamps; k++) {
    const i = Math.floor((k + 0.5) / lamps * N);
    if (tun && i > tun.a - 6 && i < tun.b + 6) continue;
    const side = k % 2 ? 1 : -1, s = track.side(i), off = track.wallOffset + 1.6;
    const x = pts[i].x + s.x * off * side, z = pts[i].z + s.z * off * side;
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5, 8), postMat); pole.position.y = 2.5; pole.castShadow = true; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.2), postMat); arm.position.set(0, 4.9, 0.5); g.add(arm);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), glowMat); lamp.position.set(0, 4.65, 1.05); g.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.3, 10), snowMat); cap.position.set(0, 5.05, 1.05); g.add(cap);
    g.position.set(x, 0, z); g.rotation.y = Math.atan2(pts[i].x - x, pts[i].z - z);
    scene.add(g);
  }

  if (tun) scene.add(tunnel(track, tun.a, tun.b, rnd));

  // ---------------- falling snow around the camera target
  const COUNT = 2600, BOX = 90, H = 34;
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(COUNT * 3), seeds = new Float32Array(COUNT);
  for (let k = 0; k < COUNT; k++) { pos[k * 3] = (rnd() - 0.5) * BOX; pos[k * 3 + 1] = rnd() * H; pos[k * 3 + 2] = (rnd() - 0.5) * BOX; seeds[k] = rnd(); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const flakes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0.9, depthWrite: false, map: flakeTexture(), alphaTest: 0.01 }));
  flakes.frustumCulled = false;
  scene.add(flakes);
  const base = pos.slice();
  return {
    update(target, time) {
      flakes.position.set(target.x, 0, target.z);
      const a = geo.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < COUNT; k++) {
        const sp = 1.6 + seeds[k] * 1.4;
        let y = base[k * 3 + 1] - time * sp; y = ((y % H) + H) % H;
        // wrap x/z relative to the moving target so flakes always surround the kart
        let x = base[k * 3] + Math.sin(time * 0.7 + seeds[k] * 20) * 0.8 - target.x; x = ((x + BOX / 2) % BOX + BOX) % BOX - BOX / 2;
        let z = base[k * 3 + 2] - target.z; z = ((z + BOX / 2) % BOX + BOX) % BOX - BOX / 2;
        a.setXYZ(k, x, y, z);
      }
      a.needsUpdate = true;
    },
  };
}

function nearestIdx(track: Track, x: number, z: number) {
  let best = 0, bd = Infinity;
  track.path.pts.forEach((p, i) => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } });
  return best;
}

/** Little log cabin: warm wood, snowy roof, glowing windows and a chimney. */
function cabin(x: number, z: number, face: number, rnd: () => number): THREE.Group {
  const g = new THREE.Group();
  const w = 5 + rnd() * 2, d = 4.4, h = 3.2;
  const wood = new THREE.MeshStandardMaterial({ color: [0x7a4a33, 0x6b3f2c, 0x5e4a6e][Math.floor(rnd() * 3)], roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood); body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
  // roof: a prism, snow on top
  const roofShape = new THREE.Shape(); roofShape.moveTo(-d / 2 - 0.6, 0); roofShape.lineTo(0, 2.4); roofShape.lineTo(d / 2 + 0.6, 0); roofShape.lineTo(-d / 2 - 0.6, 0);
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: w + 0.8, bevelEnabled: false });
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0xf6f9ff, roughness: 0.85 }));
  roof.rotation.y = Math.PI / 2; roof.position.set(-(w + 0.8) / 2, h, 0); roof.castShadow = true; g.add(roof);
  const eave = new THREE.Mesh(new THREE.BoxGeometry(w + 0.9, 0.25, d + 1.3), new THREE.MeshStandardMaterial({ color: CHARCOAL })); eave.position.y = h + 0.05; g.add(eave);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), new THREE.MeshStandardMaterial({ color: 0x4a4f5a })); chim.position.set(w * 0.28, h + 1.7, -0.6); chim.castShadow = true; g.add(chim);
  const glow = new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffa640, emissiveIntensity: 2.4 });
  for (const sx of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.0), glow); win.position.set(sx * w * 0.27, h * 0.55, d / 2 + 0.01); g.add(win);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.1), new THREE.MeshStandardMaterial({ color: 0xf2f2f0 })); frame.position.set(sx * w * 0.27, h * 0.55 - 0.55, d / 2 + 0.05); g.add(frame);
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), new THREE.MeshStandardMaterial({ color: 0x2b2f38 })); door.position.set(0, 0.9, d / 2 + 0.01); g.add(door);
  const lightPt = new THREE.PointLight(0xffa640, 6, 12, 2); lightPt.position.set(0, 1.6, d / 2 + 1.2); g.add(lightPt);
  g.position.set(x, 0, z); g.rotation.y = face;
  return g;
}

/** A friendly snowman with a racing-orange scarf and a lavender beanie. */
function snowman(x: number, z: number, s: number, rnd: () => number): THREE.Group {
  const g = new THREE.Group();
  const snow = new THREE.MeshStandardMaterial({ color: SNOW, roughness: 0.85 });
  const balls: [number, number][] = [[0.95, 0.85], [0.68, 2.2], [0.5, 3.2]];
  for (const [r, y] of balls) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), snow); b.position.y = y; b.castShadow = true; g.add(b); }
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.13, 8, 20), new THREE.MeshStandardMaterial({ color: ORANGE })); scarf.rotation.x = Math.PI / 2; scarf.position.y = 2.78; g.add(scarf);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.08), scarf.material); tail.position.set(0.3, 2.45, 0.45); tail.rotation.z = 0.3; g.add(tail);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: LAVENDER })); hat.position.y = 3.45; g.add(hat);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: YELLOW })); pom.position.y = 3.95; g.add(pom);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 8), new THREE.MeshStandardMaterial({ color: ORANGE })); nose.rotation.x = Math.PI / 2; nose.position.set(0, 3.2, 0.62); g.add(nose);
  const coal = new THREE.MeshStandardMaterial({ color: CHARCOAL });
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), coal); e.position.set(sx * 0.17, 3.35, 0.45); g.add(e); }
  for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), coal); b.position.set(0, 2.45 - k * 0.3, 0.66 - k * 0.02); g.add(b); }
  g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = rnd() * 6;
  return g;
}

/** Rock tunnel over the road from sample a to b: walls, roof, snow on top, lit with orange strips, portals at both ends. */
function tunnel(track: Track, a: number, b: number, rnd: () => number): THREE.Group {
  const g = new THREE.Group(), pts = track.path.pts, N = pts.length;
  const W = track.wallOffset + 1.2, H = 8.5, step = 2;
  const rock = new THREE.MeshStandardMaterial({ color: 0x3e4766, flatShading: true, roughness: 1 });
  const inner = new THREE.MeshStandardMaterial({ color: 0x2a3046, roughness: 0.95 });
  const snow = new THREE.MeshStandardMaterial({ color: SNOW, flatShading: true, roughness: 0.9 });
  const strip = new THREE.MeshStandardMaterial({ color: ORANGE, emissive: ORANGE, emissiveIntensity: 2.6 });
  const o = new THREE.Object3D();
  const count = Math.ceil((b - a) / step) + 1;
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), inner, count * 2);
  const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), rock, count);
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), snow, count);
  const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), strip, count * 2);
  let w = 0, r = 0, l = 0;
  for (let i = a; i < b; i += step) {
    const p = pts[i % N], yaw = yawAt(track.path, i % N), s = track.side(i % N), len = step + 0.4;
    for (const sd of [-1, 1]) {
      o.position.set(p.x + s.x * (W + 0.8) * sd, H / 2, p.z + s.z * (W + 0.8) * sd); o.rotation.set(0, yaw, 0); o.scale.set(1.6, H, len); o.updateMatrix(); walls.setMatrixAt(w++, o.matrix);
      o.position.set(p.x + s.x * (W - 0.05) * sd, 2.2, p.z + s.z * (W - 0.05) * sd); o.scale.set(0.08, 0.18, len * 0.7); o.updateMatrix(); lights.setMatrixAt(l++, o.matrix);
    }
    o.position.set(p.x, H + 0.8, p.z); o.rotation.set(0, yaw, 0); o.scale.set(W * 2 + 3.2, 1.6, len); o.updateMatrix(); roofs.setMatrixAt(r, o.matrix);
    o.position.set(p.x, H + 1.9 + rnd() * 0.3, p.z); o.scale.set(W * 2 + 2.4, 0.7, len); o.updateMatrix(); caps.setMatrixAt(r++, o.matrix);
  }
  walls.count = w; roofs.count = caps.count = r; lights.count = l;
  for (const m of [walls, roofs, caps]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  g.add(lights);

  // the mountain the tunnel cuts through: rocky snow-capped lumps on both sides
  const mid = pts[Math.floor((a + b) / 2) % N], ms = track.side(Math.floor((a + b) / 2) % N), lenT = (b - a) * track.path.spacing;
  for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) {
    const along = (k / 3 - 0.5) * lenT * 0.9, yawM = yawAt(track.path, Math.floor((a + b) / 2) % N);
    const off = W + 10 + rnd() * 6, hgt = 16 + rnd() * 10;
    const x = mid.x + ms.x * off * sd + Math.sin(yawM) * along, z = mid.z + ms.z * off * sd + Math.cos(yawM) * along;
    const m = new THREE.Mesh(new THREE.ConeGeometry(12 + rnd() * 5, hgt, 7), rock); m.position.set(x, hgt / 2 - 1, z); m.rotation.y = rnd() * 6; m.castShadow = true; g.add(m);
    const c = new THREE.Mesh(new THREE.ConeGeometry(5.5, hgt * 0.32, 7), snow); c.position.set(x, hgt - 1 - hgt * 0.16 + 0.2, z); c.rotation.y = m.rotation.y; g.add(c);
  }

  // long rocky ridges either side that rise over the tunnel roof, with snowy tops
  const yawMid = yawAt(track.path, Math.floor((a + b) / 2) % N);
  for (const sd of [-1, 1]) {
    const ridge = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), rock);
    ridge.scale.set(12, 17, lenT * 0.6); ridge.rotation.y = yawMid;
    ridge.position.set(mid.x + ms.x * (W + 12) * sd, 0, mid.z + ms.z * (W + 12) * sd); ridge.castShadow = true; g.add(ridge);
    const top = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), snow);
    top.scale.set(7, 5, lenT * 0.42); top.rotation.y = yawMid;
    top.position.set(ridge.position.x, 13.2, ridge.position.z); g.add(top);
  }

  // portals at both ends: charcoal frame, orange lamps, sky-blue name sign on the entrance
  for (const [i, entry] of [[a, true], [b, false]] as const) {
    const p = pts[i % N], yaw = yawAt(track.path, i % N);
    const portal = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: CHARCOAL, metalness: 0.4, roughness: 0.5 });
    for (const sd of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, H + 1, 1.2), frameMat); post.position.set(sd * W, (H + 1) / 2, 0); post.castShadow = true; portal.add(post); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 1.2, 1.6, 1.2), frameMat); beam.position.y = H + 0.4; portal.add(beam);
    for (let k = -3; k <= 3; k++) { const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), strip); lamp.position.set(k * W / 3.6, H - 0.55, entry ? -0.62 : 0.62); portal.add(lamp); }
    if (entry) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.5, 1.3), new THREE.MeshStandardMaterial({ map: signTexture('FROSTBITE PASS'), emissive: 0xffffff, emissiveIntensity: 0.5, emissiveMap: signTexture('FROSTBITE PASS') }));
      sign.position.set(0, H + 0.4, -0.62); sign.rotation.y = Math.PI; portal.add(sign);
    }
    portal.position.set(p.x, 0, p.z); portal.rotation.y = yaw;
    g.add(portal);
  }
  return g;
}

function signTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 112;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1C1F26'; g.fillRect(0, 0, 1024, 112);
  g.fillStyle = '#6CA9E6'; g.fillRect(0, 0, 1024, 8); g.fillRect(0, 104, 1024, 8);
  g.fillStyle = '#F2F2F0'; g.font = 'italic 800 76px "Inter", "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 512, 60);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function lakeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(256, 256, 40, 256, 256, 256);
  grad.addColorStop(0, '#9cc6f0'); grad.addColorStop(0.75, '#c9e2fb'); grad.addColorStop(1, '#f2f8ff');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
  let s = 5; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5;
  for (let k = 0; k < 14; k++) { let x = r() * 512, y = r() * 512; g.beginPath(); g.moveTo(x, y); for (let q = 0; q < 6; q++) { x += (r() - 0.5) * 120; y += (r() - 0.5) * 120; g.lineTo(x, y); } g.stroke(); }
  // skate-mark swirls
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
  for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(150 + r() * 200, 150 + r() * 200, 40 + r() * 80, 20 + r() * 40, r() * 3, 0, Math.PI * 1.6); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function flakeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
