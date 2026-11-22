import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { yawAt } from '@shared/trackMath';
import type { Track } from './Track';
import { THEME, IS_FROST } from './theme';

/**
 * Jump ramps and hay bale stacks (obstacles batch 1).
 * Everything is placed from the shared track definition, so every computer in a race
 * builds the same course and nothing needs sending over the network: your own game
 * handles your own jumps and bumps, and your partner sees them through your position.
 */

// Design board v3.0 colours
const CHARCOAL = 0x1c1f26, WARM_GRAY = 0x3a3f47, ORANGE = 0xff8a00, YELLOW = 0xfcc945;
/** Petals on Meadow Loop, snow on Frostbite Pass. */
const BLOSSOM = THEME.decor;

/** Ramp size in metres: length along the road, width across it, height of the lip. */
const RAMP_L = 8, RAMP_W = 5.2, RAMP_H = 1.5;
/** Hay stack footprint (half sizes) for its physics box. */
const HAY_HX = 2.3, HAY_HZ = 1.45, HAY_H = 2.2;
const KART_R = 0.75;

interface Placed { x: number; z: number; yaw: number }
interface Ramp extends Placed { onDeck: boolean }
interface Hay extends Placed { group: THREE.Group; wobble: number; cool: number; side: number }
interface Straw { m: THREE.Mesh; vx: number; vy: number; vz: number; life: number }

export class Obstacles {
  readonly group = new THREE.Group();
  private ramps: Ramp[] = [];
  private hay: Hay[] = [];
  private straws: Straw[] = [];
  private airborne = false;
  /** Called when you fly off a ramp, and when you bump a hay stack. */
  onLaunch?: () => void;
  /** `turn`: how far (radians) to swing the kart's heading towards the open road. */
  onHay?: (turn: number) => void;

  constructor(track: Track, world: RAPIER.World) {
    const N = track.path.pts.length, half = track.def.roadHalfWidth;
    const place = (t: number, side: number, off: number): Placed => {
      const i = Math.floor(t * N) % N, p = track.path.pts[i], s = track.side(i);
      return { x: p.x + s.x * off * side, z: p.z + s.z * off * side, yaw: yawAt(track.path, i) };
    };

    const deckTex = rampTexture();
    for (const r of track.def.ramps) {
      const at = place(r.t, r.side, half - RAMP_W / 2 - 0.4);
      this.group.add(rampModel(at, deckTex, r.side));
      // physics: a wedge the kart's ball slides up, so it really leaves the ground
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(at.x, 0, at.z).setRotation(yawQuat(at.yaw)));
      const w = RAMP_W / 2, l = RAMP_L / 2;
      const hull = new Float32Array([-w, 0, -l, w, 0, -l, -w, 0, l, w, 0, l, -w, RAMP_H, l, w, RAMP_H, l]);
      world.createCollider(RAPIER.ColliderDesc.convexHull(hull)!.setFriction(0).setRestitution(0), body);
      this.ramps.push({ ...at, onDeck: false });
    }

    const hayTex = strawTexture();
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (const h of track.def.hayBales) {
      const at = place(h.t, h.side, half - HAY_HX + 0.3);
      const group = IS_FROST ? snowPile(rnd) : hayStack(hayTex, rnd);
      group.position.set(at.x, 0, at.z); group.rotation.y = at.yaw;
      this.group.add(group);
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(at.x, HAY_H / 2, at.z).setRotation(yawQuat(at.yaw)));
      world.createCollider(RAPIER.ColliderDesc.cuboid(HAY_HX, HAY_H / 2, HAY_HZ).setFriction(0).setRestitution(0.45), body);
      this.hay.push({ ...at, group, wobble: 0, cool: 0, side: h.side });
    }

    // a small pool of straw bits for when you bump a stack
    const strawGeo = new THREE.BoxGeometry(0.05, 0.05, 0.5), strawMat = new THREE.MeshStandardMaterial({ color: IS_FROST ? 0xf4f8ff : 0xe8c66a, roughness: 1 });
    for (let k = 0; k < 40; k++) {
      const m = new THREE.Mesh(strawGeo, strawMat); m.visible = false; this.group.add(m);
      this.straws.push({ m, vx: 0, vy: 0, vz: 0, life: 0 });
    }
  }

  /**
   * Every physics step, after world.step(). Gives ramps a proper "pop" off the lip and
   * makes hay stacks soft: you bounce off and lose some speed, never a dead stop.
   */
  step(body: RAPIER.RigidBody, yaw: number, dt: number) {
    const p = body.translation(), v = body.linvel();
    const fwd = v.x * Math.sin(yaw) + v.z * Math.cos(yaw);
    for (const r of this.ramps) {
      const { along, side } = local(r, p.x, p.z);
      const on = Math.abs(side) < RAMP_W / 2 && along > -RAMP_L / 2 && along < RAMP_L / 2 && p.y > KART_R + 0.1;
      // just left the lip going forward: extra lift so the jump feels like a jump at any speed
      if (r.onDeck && !on && along >= RAMP_L / 2 - 0.5 && fwd > 8) {
        body.setLinvel({ x: v.x, y: Math.max(v.y, 4 + fwd * 0.17), z: v.z }, true);
        this.onLaunch?.();
      }
      r.onDeck = on;
    }
    this.airborne = p.y > KART_R + 0.25;

    for (const h of this.hay) {
      h.cool = Math.max(0, h.cool - dt);
      const { along, side } = local(h, p.x, p.z);
      const dx = Math.max(0, Math.abs(side) - HAY_HX), dz = Math.max(0, Math.abs(along) - HAY_HZ);
      if (h.cool === 0 && Math.hypot(dx, dz) < KART_R + 0.15 && p.y < HAY_H + KART_R) {
        h.cool = 0.6; h.wobble = 1;
        // soft: keep some speed and get nudged back towards the open road, never a dead stop
        const vv = body.linvel(), px = -Math.cos(h.yaw) * h.side * 7, pz = Math.sin(h.yaw) * h.side * 7;
        body.setLinvel({ x: vv.x * 0.6 + px, y: vv.y, z: vv.z * 0.6 + pz }, true);
        this.puff(p.x, p.y, p.z);
        let d = Math.atan2(px, pz) - yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        this.onHay?.(THREE.MathUtils.clamp(d, -0.5, 0.5));
      }
    }
  }

  /** True while the kart is off the ground (for tilting the model). */
  get inAir() { return this.airborne; }

  frame(dt: number) {
    for (const h of this.hay) {
      if (h.wobble <= 0) continue;
      h.wobble = Math.max(0, h.wobble - dt * 1.6);
      const w = Math.sin(h.wobble * 22) * h.wobble * 0.05;
      h.group.children.forEach((c, i) => { c.rotation.z = w * (i % 2 ? 1 : -1) * (c.position.y > 1 ? 2 : 1); });
    }
    for (const s of this.straws) {
      if (s.life <= 0) continue;
      s.life -= dt; s.vy -= 9 * dt;
      s.m.position.x += s.vx * dt; s.m.position.y = Math.max(0.05, s.m.position.y + s.vy * dt); s.m.position.z += s.vz * dt;
      s.m.rotation.x += dt * 6; s.m.rotation.y += dt * 4;
      s.m.visible = s.life > 0;
    }
  }

  private puff(x: number, y: number, z: number) {
    let n = 0;
    for (const s of this.straws) {
      if (s.life > 0) continue;
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4;
      s.m.position.set(x, y + 0.5, z); s.vx = Math.cos(a) * sp; s.vz = Math.sin(a) * sp; s.vy = 3 + Math.random() * 4;
      s.life = 0.8 + Math.random() * 0.5; s.m.visible = true;
      if (++n >= 14) break;
    }
  }
}

function local(o: Placed, x: number, z: number) {
  const dx = x - o.x, dz = z - o.z;
  return { along: dx * Math.sin(o.yaw) + dz * Math.cos(o.yaw), side: dx * Math.cos(o.yaw) - dz * Math.sin(o.yaw) };
}

function yawQuat(yaw: number) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

// ---------------------------------------------------------------- jump ramp

function rampModel(at: Placed, deckTex: THREE.Texture, roadSide: number): THREE.Group {
  const g = new THREE.Group(), w = RAMP_W / 2, l = RAMP_L / 2, h = RAMP_H;
  const steel = new THREE.MeshStandardMaterial({ color: CHARCOAL, metalness: 0.6, roughness: 0.45 });
  const panel = new THREE.MeshStandardMaterial({ color: WARM_GRAY, metalness: 0.3, roughness: 0.6 });

  // sloped deck with the chevron texture
  const deck = new THREE.BufferGeometry();
  deck.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0.02, -l, w, 0.02, -l, w, h, l, -w, h, l], 3));
  deck.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  deck.setIndex([0, 2, 1, 0, 3, 2]); deck.computeVertexNormals();
  const deckMesh = new THREE.Mesh(deck, new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.55, metalness: 0.15, emissive: 0xffffff, emissiveMap: deckTex, emissiveIntensity: 0.18 }));
  deckMesh.receiveShadow = true; deckMesh.castShadow = true; g.add(deckMesh);

  // side cheeks and back wall
  const sides = new THREE.BufferGeometry();
  sides.setAttribute('position', new THREE.Float32BufferAttribute([
    -w, 0, -l, -w, 0, l, -w, h, l,   w, 0, -l, w, h, l, w, 0, l,
    -w, 0, l, w, 0, l, w, h, l,   -w, 0, l, w, h, l, -w, h, l,
  ], 3));
  sides.computeVertexNormals();
  const sideMesh = new THREE.Mesh(sides, panel); sideMesh.material.side = THREE.DoubleSide; sideMesh.castShadow = true; g.add(sideMesh);

  // steel rails along both deck edges, and a lip bar
  const slope = Math.atan2(h, RAMP_L), railLen = Math.hypot(h, RAMP_L);
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, railLen), steel);
    rail.position.set(sx * (w - 0.05), h / 2 + 0.1, 0); rail.rotation.x = -slope; rail.castShadow = true; g.add(rail);
    // back legs
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, h, 0.25), steel);
    leg.position.set(sx * (w - 0.15), h / 2, l - 0.15); g.add(leg);
    // warning light at each lip corner
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshStandardMaterial({ color: ORANGE, emissive: ORANGE, emissiveIntensity: 2.2 }));
    lamp.position.set(sx * (w - 0.05), h + 0.3, l - 0.05); g.add(lamp);
  }
  const lip = new THREE.Mesh(new THREE.BoxGeometry(RAMP_W, 0.14, 0.3), new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.4, metalness: 0.2 }));
  lip.position.set(0, h + 0.03, l - 0.15); g.add(lip);

  // cherry blossom cushions at the outside foot of the ramp
  const petalMat = BLOSSOM.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
  for (let k = 0; k < 9; k++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 + (k % 3) * 0.08, 0), petalMat[k % 3]);
    b.position.set(roadSide * (w + 0.4 + (k % 2) * 0.3), 0.2, -l + 1 + k * 0.75); b.castShadow = true; g.add(b);
  }

  g.position.set(at.x, 0, at.z); g.rotation.y = at.yaw;
  return g;
}

function rampTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3A3F47'; g.fillRect(0, 0, 256, 512);
  // subtle plank seams
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
  for (let y = 0; y < 512; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  // off-white edge stripes
  g.fillStyle = '#F2F2F0'; g.fillRect(0, 0, 14, 512); g.fillRect(242, 0, 14, 512);
  // racing orange chevrons pointing up the ramp
  for (const [y, col] of [[70, '#FF8A00'], [210, '#FF8A00'], [350, '#FCC945']] as const) {
    g.fillStyle = col; g.beginPath();
    g.moveTo(40, y + 90); g.lineTo(128, y); g.lineTo(216, y + 90); g.lineTo(186, y + 108); g.lineTo(128, y + 50); g.lineTo(70, y + 108); g.closePath(); g.fill();
  }
  // yellow and charcoal hazard band at the lip
  for (let x = -40; x < 256; x += 32) { g.fillStyle = '#FCC945'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, 0); g.lineTo(x + 36, 26); g.lineTo(x + 20, 26); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------- hay bales

function hayStack(tex: THREE.Texture, rnd: () => number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, color: 0xffffff });
  const geo = new RoundedBoxGeometry(2.2, 1.05, 1.3, 3, 0.2);
  // two across, two deep, one on top: lying with the long side across the road
  const spots: [number, number, number][] = [[-1.12, 0, -0.68], [1.12, 0, -0.68], [-1.12, 0, 0.68], [1.12, 0, 0.68], [0.1, 1, 0]];
  for (const [x, row, z] of spots) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x + (rnd() - 0.5) * 0.15, 0.53 + row * 1.04, z + (rnd() - 0.5) * 0.12);
    m.rotation.y = (rnd() - 0.5) * (row ? 0.5 : 0.12);
    m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  // fallen petals resting on top
  const petalGeo = new THREE.CircleGeometry(0.09, 5);
  const petalMats = BLOSSOM.map((c) => new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.8 }));
  for (let k = 0; k < 26; k++) {
    const top = k < 12;
    const p = new THREE.Mesh(petalGeo, petalMats[k % 3]);
    p.rotation.x = -Math.PI / 2; p.rotation.z = rnd() * 6;
    if (top) p.position.set(0.1 + (rnd() - 0.5) * 1.8, 2.14, (rnd() - 0.5) * 1.0);
    else p.position.set((rnd() - 0.5) * 4.6, k % 2 ? 1.08 : 0.03, (rnd() - 0.5) * 3.4);
    g.add(p);
  }
  return g;
}

/** Frostbite Pass's version of a hay stack: a lumpy snow pile with an orange marker pole. */
function snowPile(rnd: () => number): THREE.Group {
  const g = new THREE.Group();
  const snow = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.85, flatShading: true });
  const shade = new THREE.MeshStandardMaterial({ color: 0xdbe6f7, roughness: 0.9, flatShading: true });
  const lumps: [number, number, number, number][] = [[-1.3, 0.55, -0.4, 1.05], [1.2, 0.5, -0.3, 1.0], [0, 0.8, 0.2, 1.3], [-0.9, 0.45, 0.8, 0.85], [1.0, 0.45, 0.8, 0.85], [0.1, 1.55, -0.1, 0.8]];
  lumps.forEach(([x, y, z, r], k) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), k % 3 === 1 ? shade : snow);
    m.position.set(x + (rnd() - 0.5) * 0.2, y, z); m.scale.y = 0.8 + rnd() * 0.2; m.rotation.y = rnd() * 6;
    m.castShadow = true; m.receiveShadow = true; g.add(m);
  });
  // a snow marker pole, racing orange with a yellow reflector tip
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), new THREE.MeshStandardMaterial({ color: ORANGE, roughness: 0.5 }));
  pole.position.set(1.7, 1.6, 0.9); pole.rotation.z = -0.12; pole.castShadow = true; g.add(pole);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.18), new THREE.MeshStandardMaterial({ color: YELLOW, emissive: YELLOW, emissiveIntensity: 0.8 }));
  tip.position.set(1.89, 3.15, 0.9); g.add(tip);
  return g;
}

function strawTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#D6A94C'; g.fillRect(0, 0, 256, 128);
  let s = 3; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < 900; k++) {
    const x = r() * 256, y = r() * 128, len = 10 + r() * 26, a = (r() - 0.5) * 0.25;
    g.strokeStyle = ['#EDCB72', '#BF8E38', '#F6DE95', '#B07E32'][Math.floor(r() * 4)]; g.lineWidth = 1 + r() * 1.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
  }
  // two twine bands
  for (const x of [70, 182]) { g.fillStyle = '#E54B4B'; g.fillRect(x, 0, 6, 128); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 4, 0, 2, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
