import * as THREE from 'three';
import { G, blob, cone, cyl, decal, glass, group, matte, part, tube, vinyl, flat, sculpted, smooth, mix } from '../toy';
import { toonEye } from './parts';
import { toyBody, type CharacterRig } from './rig';

// Nimbus's colours (design bible v2.0)
const WOOL = 0xf6f1e7, WOOL_SHADE = 0xe6ddcd, FACE = 0xf0dcc6, MUZZLE = 0xf7e9dc, BLUSH = 0xf2a4a0, NOSE = 0xc98586;
const SWEATER = 0x5d6db0, SWEATER_DARK = 0x4a5895, CREAM = 0xf6f1e7, FRAME = 0x252638, BOW = 0xf05b65, PENCIL = 0xe5a94b;

/** Wool puffs spread over part of a sphere (`keep` decides which). Deterministic. */
function woolCap(parent: THREE.Object3D, c: [number, number, number], r: [number, number, number], n: number, size: number, keep: (x: number, y: number, z: number) => boolean) {
  const mats = [matte(WOOL), matte(WOOL_SHADE)];
  for (let i = 0; i < n; i++) {
    const a = i * 2.399963, y = 1 - ((i + 0.5) / n) * 2, rr = Math.sqrt(1 - y * y);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (!keep(x, y, z)) continue;
    const s = size * (0.82 + ((i * 37) % 10) / 30);
    parent.add(blob(mats[i % 5 === 0 ? 1 : 0], [c[0] + x * r[0], c[1] + y * r[1], c[2] + z * r[2]], s, [0, 0, 0], 20));
  }
}

/**
 * Nimbus, "The Worried Genius": a soft-faced sheep with a fluffy wool crown, big
 * round glasses, a pencil tucked behind one ear and a cosy sweater with a bow tie.
 * Always calculating, always slightly worried.
 */
export function buildNimbus(): CharacterRig {
  const rig = toyBody({ outfit: SWEATER, trim: CREAM, hands: FACE, feet: FRAME });
  const h = rig.head;

  // ---- head: soft sheep face with a gentle snout, painted blush, nose and worried mouth ----
  const head = sculpted(
    (p) => {
      const snout = Math.exp(-((p.y + 0.22) ** 2) / 0.1) * smooth(0.2, 0.95, p.z) * smooth(0.6, 0.2, Math.abs(p.x));
      p.x *= 0.42 * (1 - Math.max(0, -p.y) * 0.08);
      p.y *= 0.42;
      p.z *= 0.41 * (1 + snout * 0.22);
    },
    (p) => {
      const ax = Math.abs(p.x);
      const muzzle = smooth(0.45, 0.25, Math.hypot(p.x * 1.1, p.y + 0.22)) * smooth(0.5, 0.8, p.z);
      let c = mix(FACE, MUZZLE, muzzle * 0.9).clone();
      const blush = smooth(0.2, 0.06, Math.hypot(ax - 0.52, p.y + 0.12, (p.z - 0.72) * 0.7));
      if (blush > 0) c = c.lerp(new THREE.Color(BLUSH), blush * 0.75);
      // nose: soft rounded triangle at the tip of the snout
      const ny = p.y + 0.02;
      const nose = p.z > 0.6 ? smooth(0.115, 0.095, Math.hypot(p.x * (1.15 + Math.max(0, -ny) * 2.5), ny * 1.5)) : 0;
      // philtrum and a small wavy, worried mouth
      const phil = p.z > 0.6 ? smooth(0.016, 0.008, ax) * smooth(-0.05, -0.08, p.y) * smooth(-0.3, -0.26, p.y) : 0;
      const my = -0.31 + 0.025 * Math.cos(p.x * 18);
      const mouthLine = p.z > 0.6 ? smooth(0.02, 0.012, Math.abs(p.y - my)) * smooth(0.17, 0.13, ax) : 0;
      const ink = Math.max(phil, mouthLine);
      if (ink > 0) c = c.lerp(new THREE.Color(0x5a3c40), ink);
      if (nose > 0) c = c.lerp(new THREE.Color(NOSE), nose);
      return c;
    },
    { rough: 0.6, seg: 96 },
  );
  head.position.set(0, 0.4, 0);
  h.add(head);
  // nose glint
  h.add(blob(flat(0xffffff), [0.025, 0.41, 0.545], [0.022, 0.01, 0.004], [0, 0, 0.3], 8));

  // ---- big blue eyes behind round glasses ----
  for (const x of [-1, 1]) {
    const e = toonEye(0.13, { iris: 0x2f6fb7, irisLight: 0x6aa6e0, look: [0, 0.1] });
    e.position.set(x * 0.165, 0.48, 0.325); e.rotation.set(0, x * 0.35, 0);
    h.add(e); rig.eyes.push(e);
  }
  const specs = group([0, 0.49, 0.47]); h.add(specs);
  for (const x of [-1, 1]) {
    specs.add(part(G.torus(0.15, 0.022, Math.PI * 2), vinyl(FRAME, 0.3), [x * 0.175, 0, 0], 1, [0, x * 0.22, 0]));
    specs.add(blob(glass(0xe6f6ff, 0.18), [x * 0.175, 0, -0.005], [0.145, 0.145, 0.015], [0, x * 0.22, 0]));
    specs.add(blob(flat(0xffffff), [x * 0.175 + 0.05, 0.06, 0.01], [0.035, 0.012, 0.004], [0, x * 0.22, 0.6], 8));   // lens glint
    // temples run back into the wool, over the ears
    specs.add(tube([[x * 0.32, 0.01, -0.06], [x * 0.38, 0.02, -0.22], [x * 0.39, -0.01, -0.4]], 0.014, vinyl(FRAME, 0.3)));
  }
  specs.add(part(G.torus(0.04, 0.016, Math.PI), vinyl(FRAME, 0.3), [0, 0.005, 0.02], 1, [0, 0, 0]));   // bridge

  // ---- worried eyebrows tucked under the fringe ----
  for (const x of [-1, 1]) h.add(blob(vinyl(0x8a6e5a, 0.5), [x * 0.16, 0.685, 0.33], [0.065, 0.017, 0.02], [0.3, 0, -x * 0.35]));

  // ---- floppy ears, sticking out sideways under the wool ----
  for (const x of [-1, 1]) {
    const ear = group([x * 0.38, 0.44, 0.06]); ear.rotation.set(0, x * 0.25, x * 1.35);
    ear.add(blob(vinyl(0xe7cdb3, 0.55), [0, -0.14, 0], [0.09, 0.17, 0.05]));
    ear.add(blob(vinyl(0xf3b8b2, 0.55), [0, -0.15, 0.03], [0.055, 0.12, 0.025]));
    h.add(ear); rig.ears.push(ear);
  }

  // ---- fluffy wool crown and a fringe curl over the forehead ----
  h.add(blob(matte(WOOL), [0, 0.47, -0.1], [0.41, 0.4, 0.38]));
  woolCap(h, [0, 0.5, -0.06], [0.42, 0.38, 0.4], 46, 0.14, (x, y, z) => y > (z > 0 ? 0.42 + z * 0.15 : -0.1 + z * 0.6) && !(y < 0.15 && Math.abs(x) > 0.75));
  for (const [x, y, z, s] of [[-0.12, 0.76, 0.27, 0.11], [0.03, 0.79, 0.3, 0.12], [0.16, 0.75, 0.27, 0.1], [0.08, 0.72, 0.34, 0.08]] as const)
    h.add(blob(matte(WOOL), [x, y, z], s, [0, 0, 0], 20));

  // ---- pencil tucked behind the left ear ----
  const pencil = group([-0.36, 0.66, -0.02]); pencil.rotation.set(0.25, 0.2, -1.15);
  pencil.add(cyl(vinyl(PENCIL, 0.4), [0, 0, 0], 0.03, 0.36, [0, 0, 0], 6));
  pencil.add(cone(vinyl(0xf3d9b0, 0.6), [0, 0.22, 0], 0.03, 0.08, [0, 0, 0], 6));
  pencil.add(cone(vinyl(FRAME, 0.4), [0, 0.255, 0], 0.011, 0.03, [0, 0, 0], 6));
  pencil.add(cyl(vinyl(0xc9ccd6, 0.25), [0, -0.19, 0], 0.032, 0.04, [0, 0, 0], 6));
  pencil.add(cyl(vinyl(BOW, 0.5), [0, -0.235, 0], 0.03, 0.05, [0, 0, 0], 6));
  h.add(pencil);

  // ---- sweater: rib hem and cuffs, shirt collar, bow tie, little badge ----
  const t = rig.torso;
  t.add(part(G.torus(0.26, 0.035), vinyl(SWEATER_DARK, 0.7), [0, 0.09, 0], [1, 1, 0.88], [Math.PI / 2, 0, 0]));
  for (const arm of [rig.armL, rig.armR]) arm.add(part(G.torus(0.075, 0.025), vinyl(SWEATER_DARK, 0.7), [0, -0.27, 0], 1, [Math.PI / 2, 0, 0]));
  for (const x of [-1, 1]) t.add(cone(vinyl(CREAM, 0.45), [x * 0.07, 0.535, 0.2], 0.05, 0.11, [0.9, 0, x * 2.3], 3));   // collar points
  for (const x of [-1, 1]) t.add(part(G.sphere(16), vinyl(BOW, 0.4), [x * 0.065, 0.5, 0.25], [0.06, 0.04, 0.025], [0, 0, x * 0.25]));
  t.add(blob(vinyl(0xd94a54, 0.4), [0, 0.5, 0.27], [0.026, 0.028, 0.02]));
  const badge = decal('nimbus-badge', 0.1, 0.1, (g, W, H) => {
    g.fillStyle = '#e5a94b'; g.beginPath(); g.arc(W / 2, H / 2, W * 0.46, 0, 7); g.fill();
    g.fillStyle = '#252638'; g.font = `bold ${H * 0.62}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('π', W / 2, H * 0.53);
  });
  badge.position.set(-0.16, 0.34, 0.268); badge.rotation.y = -0.5; t.add(badge);

  // ---- little wool tail ----
  const tail = group([0, 0.2, -0.3]);
  woolCap(tail, [0, 0, 0], [0.06, 0.06, 0.06], 8, 0.065, () => true);
  rig.torso.add(tail); rig.tail = tail;

  // ---- nervous sweat drop that comes and goes ----
  const drop = blob(glass(0x8fd0ff, 0.85), [0.33, 0.62, 0.26], [0.035, 0.05, 0.025]);
  h.add(drop);
  rig.idle = (time, _dt, excited) => {
    const cycle = (time * 0.4) % 1;
    drop.visible = excited === 0 && cycle > 0.5;
    drop.position.y = 0.64 - (cycle - 0.5) * 0.35;
  };
  return rig;
}
