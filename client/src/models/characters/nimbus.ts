import * as THREE from 'three';
import { G, blob, cone, cyl, eye, group, part, vinyl, glass, mouth, INK } from '../toy';
import { toyBody, type CharacterRig } from './rig';

const WOOL = 0xf7f4ee, FACE = 0xead3bd, SWEATER = 0x3f5fa8;

/** A cloud of wool puffs around a centre. Deterministic, so every Nimbus looks the same. */
function wool(parent: THREE.Object3D, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, n: number, size: number, skipFront = false) {
  const m = vinyl(WOOL, 0.75);
  for (let i = 0; i < n; i++) {
    const a = i * 2.399963, y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (skipFront && z > 0.45 && y < 0.35) continue;    // leave the face clear
    parent.add(blob(m, [cx + x * rx, cy + y * ry, cz + z * rz], size * (0.85 + ((i * 37) % 10) / 40), [0, 0, 0], 16));
  }
}

/** Nimbus: fluffy sheep with round glasses, a pencil behind the ear and a worried look. */
export function buildNimbus(): CharacterRig {
  const rig = toyBody({ outfit: SWEATER, trim: 0xffffff, hands: FACE, feet: 0x3b3a4a });
  const h = rig.head, face = vinyl(FACE, 0.55);
  rig.torso.add(blob(vinyl(SWEATER, 0.6), [0, 0.28, 0.04], [0.31, 0.32, 0.28]));
  h.add(blob(vinyl(WOOL, 0.75), [0, 0.42, -0.04], [0.44, 0.42, 0.4]));     // wool head core
  wool(h, 0, 0.47, -0.04, 0.42, 0.4, 0.38, 34, 0.15, true);
  h.add(blob(face, [0, 0.33, 0.2], [0.3, 0.33, 0.27]));                     // face
  h.add(blob(face, [0, 0.22, 0.34], [0.18, 0.13, 0.13]));                   // snout
  h.add(blob(vinyl(0xd9a3a0, 0.4), [0, 0.27, 0.46], [0.06, 0.035, 0.03]));   // nose
  const m = mouth(0.05, 0.012, Math.PI * 0.6); m.position.set(0, 0.16, 0.45); m.rotation.z = 0.0 + Math.PI * 0.2 - Math.PI * 0.2;   // worried flat-ish line
  m.rotation.z = Math.PI * 0.2; h.add(m);
  for (const x of [-1, 1]) {
    const e = eye(0.12, 0x3b6ea8, { look: [-x * 0.3, 0.2] });
    e.position.set(x * 0.13, 0.42, 0.39); e.rotation.y = x * 0.2;
    h.add(e); rig.eyes.push(e);
    // round glasses
    h.add(part(G.torus(0.14, 0.022), vinyl(INK, 0.35), [x * 0.14, 0.42, 0.47], 1, [0, x * 0.15, 0]));
    h.add(blob(glass(0xdff4ff, 0.25), [x * 0.14, 0.42, 0.47], [0.13, 0.13, 0.02]));
    h.add(cyl(vinyl(INK, 0.35), [x * 0.33, 0.43, 0.32], 0.015, 0.3, [Math.PI / 2, 0, -x * 0.35], 6));   // arms of the glasses
    h.add(blob(vinyl(0x6b5a4a), [x * 0.15, 0.6, 0.44], [0.06, 0.016, 0.02], [0, 0, x * 0.45]));          // worried eyebrows
    const ear = group([x * 0.38, 0.4, 0.08]); ear.rotation.z = x * 1.25;    // droopy sideways ears
    ear.add(blob(face, [0, -0.1, 0], [0.08, 0.15, 0.05]));
    h.add(ear); rig.ears.push(ear);
  }
  h.add(cyl(vinyl(INK, 0.35), [0, 0.43, 0.48], 0.015, 0.06, [0, 0, Math.PI / 2], 6));   // bridge
  // pencil behind the ear
  const pencil = group([-0.38, 0.6, 0.06]); pencil.rotation.set(0.3, 0, -0.9);
  pencil.add(cyl(vinyl(0xe5a94b, 0.4), [0, 0, 0], 0.035, 0.42, [0, 0, 0], 6));
  pencil.add(cone(vinyl(0xf3d9b0), [0, 0.25, 0], 0.035, 0.08, [0, 0, 0], 6));
  pencil.add(cone(vinyl(INK), [0, 0.29, 0], 0.012, 0.03, [0, 0, 0], 6));
  pencil.add(cyl(metal_(), [0, -0.22, 0], 0.037, 0.04, [0, 0, 0], 6));
  pencil.add(cyl(vinyl(0xf05b65), [0, -0.26, 0], 0.035, 0.05, [0, 0, 0], 6));
  h.add(pencil);
  // bow tie
  for (const x of [-1, 1]) rig.torso.add(cone(vinyl(0x4f8fe8, 0.4), [x * 0.07, 0.55, 0.22], 0.06, 0.12, [0, 0, x * Math.PI / 2], 8));
  rig.torso.add(blob(vinyl(0x4f8fe8, 0.4), [0, 0.55, 0.23], 0.035));
  // nervous sweat drop that comes and goes
  const drop = blob(glass(0x8fd0ff, 0.85), [0.3, 0.6, 0.3], [0.04, 0.06, 0.03]);
  h.add(drop);
  const tail = group([0, 0.2, -0.3]); wool(tail, 0, 0, 0, 0.07, 0.07, 0.07, 6, 0.07); rig.torso.add(tail); rig.tail = tail;

  rig.idle = (t, _dt, excited) => {
    const cycle = (t * 0.4) % 1;
    drop.visible = excited === 0 && cycle > 0.5;
    drop.position.y = 0.62 - (cycle - 0.5) * 0.4;
  };
  return rig;
}
const metal_ = () => vinyl(0xc9ccd6, 0.25);
