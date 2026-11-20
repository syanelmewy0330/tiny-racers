import * as THREE from 'three';
import { G, blob, cone, group, part, vinyl, flat, sculpted, smooth, mix } from '../toy';
import { toonEye, closedEye, paintedTube } from './parts';
import { toyBody, type CharacterRig } from './rig';

// Peanut's colours (design bible v2.0)
const ORANGE = 0xd9622b, ORANGE_DEEP = 0xb84a1e, CREAM = 0xfbf3e8, BUFF = 0xf0b47a, DARK = 0x3f2017;
const VEST = 0x30324a, AMBER = 0xe5a94b, GLOVE = 0x2a2a33;

/** Distance from point (x, y) to the segment a-b, in 2D. */
function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return { d: Math.hypot(x - ax - dx * t, y - ay - dy * t), t };
}

/**
 * Peanut, "The Little Troublemaker": a red panda with a cheeky wink, a lopsided
 * grin, painted cream cheek and brow markings, racing gloves and a big ringed tail.
 */
export function buildPeanut(): CharacterRig {
  const rig = toyBody({ outfit: VEST, trim: AMBER, chest: ORANGE, hands: GLOVE, handsMatte: true, feet: DARK, stripes: true });
  const h = rig.head;

  // ---- head: round face with fluffy cheek tufts and a small muzzle, markings painted on ----
  const head = sculpted(
    (p) => {
      const ax = Math.abs(p.x);
      const tuft = Math.exp(-((p.y + 0.15) ** 2) / 0.05) * smooth(0.55, 0.95, ax) * smooth(-0.4, 0.3, p.z);
      const muzzle = Math.exp(-((p.y + 0.3) ** 2) / 0.05) * smooth(0.5, 0.95, p.z) * smooth(0.45, 0.1, ax);
      p.x *= 0.5 * (1 + tuft * 0.14);
      p.y *= 0.42 * (1 - tuft * 0.04);
      p.z *= 0.43 * (1 + muzzle * 0.16);
    },
    (p) => {
      const ax = Math.abs(p.x);
      let c = mix(ORANGE, ORANGE_DEEP, smooth(0.2, -0.7, p.z) * 0.8).clone();
      const front = smooth(0.35, 0.55, p.z);
      const muzzle = smooth(0.47, 0.41, Math.hypot(p.x * 1.1, (p.y + 0.36) * 1.05)) * front;
      const cheek = smooth(0.3, 0.24, Math.hypot(ax - 0.66, (p.y + 0.1) * 1.1, (p.z - 0.5) * 0.6));
      const brow = smooth(0.11, 0.08, Math.hypot(ax - 0.3, (p.y - 0.42) * 1.3)) * smooth(0.6, 0.7, p.z);
      c = c.lerp(new THREE.Color(CREAM), Math.max(muzzle, cheek, brow));
      // dark "tear" markings from the eyes down to the corners of the muzzle
      const { d, t } = segDist(ax, p.y, 0.42, 0.0, 0.33, -0.42);
      const tear = smooth(0.05 + t * 0.03, 0.03 + t * 0.03, d) * smooth(0.55, 0.65, p.z);
      if (tear > 0) c = c.lerp(new THREE.Color(DARK), tear * 0.9);
      // lopsided grin
      const gx = p.x - 0.05;
      const gy = -0.43 + 1.5 * gx * gx + 0.12 * gx;
      const grin = p.z > 0.6 ? smooth(0.03, 0.018, Math.abs(p.y - gy)) * smooth(0.22, 0.17, Math.abs(gx + 0.01)) : 0;
      if (grin > 0) c = c.lerp(new THREE.Color(0x3a1f1a), grin);
      return c;
    },
    { rough: 0.58, seg: 96 },
  );
  head.position.set(0, 0.4, 0);
  h.add(head);

  // ---- one sly open eye and one wink ----
  const e = toonEye(0.14, { iris: 0x5a3014, irisLight: 0x9a5a28, lid: ORANGE, lidDrop: 0.22, look: [0.35, 0] });
  e.position.set(0.19, 0.45, 0.36); e.rotation.set(0, 0.35, -0.08);
  h.add(e); rig.eyes.push(e);
  const wink = closedEye(0.14, DARK);
  wink.position.set(-0.19, 0.44, 0.385); wink.rotation.set(0, -0.35, 0.12);
  h.add(wink);

  // ---- glossy nose, fang and whisker dots ----
  h.add(blob(vinyl(0x1b1418, 0.2), [0, 0.32, 0.47], [0.075, 0.05, 0.045]));
  h.add(blob(flat(0xffffff), [0.022, 0.345, 0.51], [0.022, 0.009, 0.004], [0, 0, 0.3], 8));
  h.add(part(G.cone(8), vinyl(0xffffff, 0.3), [-0.06, 0.2, 0.435], [0.022, 0.045, 0.02], [Math.PI + 0.2, 0, 0]));   // little fang
  for (const x of [-1, 1]) for (const [dx, dy] of [[0.1, 0.27], [0.14, 0.25], [0.12, 0.23]]) h.add(blob(vinyl(DARK, 0.5), [x * dx, dy, 0.44 - dx * 0.25], 0.008, [0, 0, 0], 6));

  // ---- big ears: orange back, cream rim, dark inside ----
  for (const x of [-1, 1]) {
    const ear = group([x * 0.33, 0.72, 0.0]); ear.rotation.set(0, 0, -x * 0.45);
    ear.add(blob(vinyl(ORANGE, 0.55), [0, 0.06, -0.01], [0.15, 0.15, 0.07]));
    ear.add(blob(vinyl(CREAM, 0.5), [0, 0.07, 0.02], [0.135, 0.135, 0.05]));
    ear.add(blob(vinyl(DARK, 0.5), [0, 0.05, 0.045], [0.095, 0.1, 0.035]));
    ear.add(cone(vinyl(CREAM, 0.6), [0, -0.01, 0.07], 0.04, 0.09, [0.1, 0, 0], 8));   // fluffy tuft
    h.add(ear); rig.ears.push(ear);
  }

  // ---- racing gloves with amber cuffs, little lightning patch on the vest ----
  for (const arm of [rig.armL, rig.armR]) arm.add(blob(vinyl(AMBER, 0.4), [0, -0.27, 0], [0.105, 0.04, 0.105]));
  rig.torso.add(blob(vinyl(AMBER, 0.4), [-0.19, 0.4, 0.24], [0.045, 0.045, 0.02], [0, -0.6, 0]));

  // ---- big ringed tail curving up behind the seat ----
  const tail = group([0, 0.12, -0.25]);
  const rings = 7;
  tail.add(paintedTube(
    [[0, 0, 0], [0, -0.02, -0.3], [0.06, 0.2, -0.55], [0.12, 0.55, -0.6], [0.18, 0.85, -0.45]],
    0.15,
    (t) => (t > 0.9 ? DARK : Math.floor(t * rings) % 2 ? BUFF : ORANGE),
    0.72,
  ));
  rig.torso.add(tail); rig.tail = tail;

  rig.idle = (time, _dt, excited) => {
    wink.scale.y = 1 + Math.sin(time * 5) * 0.08 + excited * 0.15;
  };
  return rig;
}
