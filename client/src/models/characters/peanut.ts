import { G, blob, eye, group, part, tube, vinyl, mouth, INK } from '../toy';
import { toyBody, type CharacterRig } from './rig';

const ORANGE = 0xe06a2c, CREAM = 0xfff3e6, DARK = 0x4a2418, VEST = 0x2fb5a3;

/** Peanut: red panda with a wink, a cheeky grin, racing gloves and a big striped tail. */
export function buildPeanut(): CharacterRig {
  const rig = toyBody({ outfit: VEST, trim: 0xff9a3c, chest: ORANGE, hands: 0x2c2a35, handsMatte: true, feet: DARK });
  const h = rig.head, fur = vinyl(ORANGE, 0.55), cream = vinyl(CREAM, 0.5), dark = vinyl(DARK, 0.5);
  // dark arms like a real red panda, under the vest sleeves: tint the sleeve capsules
  for (const arm of [rig.armL, rig.armR]) arm.add(blob(vinyl(0xff9a3c, 0.4), [0, -0.27, 0], [0.105, 0.04, 0.105]));   // glove cuffs

  h.add(blob(fur, [0, 0.4, 0], [0.5, 0.42, 0.43]));
  h.add(blob(cream, [0, 0.25, 0.3], [0.24, 0.16, 0.16]));                   // muzzle
  for (const x of [-1, 1]) {
    h.add(blob(cream, [x * 0.3, 0.3, 0.26], [0.15, 0.12, 0.12]));          // cheek patches
    h.add(blob(cream, [x * 0.16, 0.6, 0.35], [0.06, 0.04, 0.03]));          // eyebrow dots
    h.add(blob(dark, [x * 0.2, 0.3, 0.34], [0.05, 0.13, 0.05], [0, 0, x * 0.25]));   // tear markings
    const ear = group([x * 0.33, 0.72, 0.0]); ear.rotation.z = -x * 0.45;
    ear.add(blob(fur, [0, 0.06, 0], [0.15, 0.15, 0.07]));
    ear.add(blob(cream, [0, 0.08, 0.035], [0.11, 0.11, 0.04]));
    ear.add(blob(dark, [0, 0.05, 0.05], [0.06, 0.07, 0.03]));
    h.add(ear); rig.ears.push(ear);
  }
  // left eye open and sly, right eye winking
  const e = eye(0.14, 0x5a3014, { lid: ORANGE, lidAngle: 0.5, look: [0.4, 0] });
  e.position.set(0.19, 0.44, 0.32); e.rotation.y = 0.3; h.add(e); rig.eyes.push(e);
  const wink = part(G.torus(0.08, 0.018, Math.PI * 0.8), dark, [-0.19, 0.42, 0.4], 1, [0, -0.3, Math.PI * 0.1 + Math.PI]);
  h.add(wink);
  h.add(blob(vinyl(0x1b1418, 0.3), [0, 0.33, 0.46], [0.07, 0.05, 0.04]));      // nose
  const grin = mouth(0.1, 0.02, Math.PI * 0.75); grin.position.set(0.04, 0.22, 0.44); grin.rotation.z += 0.25;   // lopsided grin
  h.add(grin);
  h.add(part(G.cone(8), cream, [-0.03, 0.15, 0.45], [0.025, 0.05, 0.025], [Math.PI, 0, 0]));   // little fang

  // big ringed tail curving up behind the seat
  const tail = group([0, 0.12, -0.25]);
  const path: [number, number, number][] = [[0, 0, 0], [0, -0.02, -0.3], [0.06, 0.2, -0.55], [0.12, 0.55, -0.6], [0.18, 0.85, -0.45]];
  const rings = 7;
  for (let i = 0; i < rings; i++) {
    const a = i / rings, b = (i + 1) / rings;
    const pts = [a, (a + b) / 2, b].map((t) => samplePath(path, t));
    tail.add(tube(pts, 0.15 - i * 0.008, i % 2 ? dark : fur, 1));
  }
  rig.torso.add(tail); rig.tail = tail;

  rig.idle = (t, _dt, excited) => {
    grin.scale.x = 1 + Math.sin(t * 3) * 0.05 + excited * 0.2;
    wink.scale.y = 1 + Math.sin(t * 5) * 0.1;
  };
  return rig;
}

function samplePath(p: [number, number, number][], t: number): [number, number, number] {
  const f = t * (p.length - 1), i = Math.min(p.length - 2, Math.floor(f)), u = f - i;
  return [0, 1, 2].map((k) => p[i][k] + (p[i + 1][k] - p[i][k]) * u) as [number, number, number];
}
void INK;
