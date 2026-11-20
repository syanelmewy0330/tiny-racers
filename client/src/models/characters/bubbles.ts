import * as THREE from 'three';
import { G, blob, cone, cyl, eye, group, part, tube, vinyl, glass, INK } from '../toy';
import { toyBody, type CharacterRig } from './rig';

const GRAY = 0x9a98a8, DARK = 0x5d5b6e, WHITE = 0xfbf8f2, PINK = 0xf2a5b0, GOGGLE = 0xf2bf2e;

/** Bubbles: gray and white cat, yellow racing goggles, big excited eyes. */
export function buildBubbles(): CharacterRig {
  const rig = toyBody({ outfit: 0x2c2e45, trim: 0xe5a94b, chest: WHITE, hands: WHITE, feet: 0x252638 });
  const h = rig.head;
  const fur = vinyl(GRAY, 0.6), white = vinyl(WHITE, 0.55);

  h.add(blob(fur, [0, 0.4, 0], [0.5, 0.44, 0.45]));                     // big round head
  h.add(blob(white, [0, 0.27, 0.25], [0.33, 0.22, 0.24]));               // white muzzle
  h.add(blob(white, [0, 0.6, 0.33], [0.09, 0.16, 0.08], [0.35, 0, 0]));  // forehead blaze
  for (const x of [-1, 1]) {                                              // tabby stripes
    h.add(blob(vinyl(DARK), [x * 0.36, 0.55, 0.22], [0.03, 0.09, 0.03], [0, 0, x * 0.7]));
    h.add(blob(vinyl(DARK), [x * 0.42, 0.45, 0.2], [0.03, 0.08, 0.03], [0, 0, x * 0.9]));
  }
  for (const x of [-1, 1]) {
    const e = eye(0.15, 0xc98a2a, { look: [0, 0.1] });
    e.position.set(x * 0.19, 0.42, 0.33); e.rotation.y = x * 0.28;
    h.add(e); rig.eyes.push(e);
    for (const k of [0, 1]) {                                                       // whiskers
      const w = cyl(vinyl(INK), [x * 0.36, 0.27 - k * 0.05, 0.32], 0.006, 0.22, [0, 0, Math.PI / 2 + x * (0.15 - k * 0.2)], 6);
      h.add(w);
    }
    const ear = group([x * 0.3, 0.72, 0.02]); ear.rotation.z = -x * 0.35;
    ear.add(cone(fur, [0, 0.1, 0], 0.15, 0.26));
    ear.add(cone(vinyl(PINK), [0, 0.09, 0.05], 0.09, 0.17));
    h.add(ear); rig.ears.push(ear);
  }
  h.add(blob(vinyl(0xff7aa8, 0.3), [0, 0.32, 0.49], [0.05, 0.035, 0.03]));      // nose
  h.add(blob(vinyl(0x5b2340, 0.4), [0, 0.2, 0.46], [0.09, 0.07, 0.04]));        // open happy mouth
  h.add(blob(vinyl(0xff7a9a, 0.4), [0, 0.17, 0.48], [0.055, 0.035, 0.025]));    // tongue

  // Yellow racing goggles pushed up on the forehead, strap all round the head
  h.add(part(G.torus(0.455, 0.03), vinyl(INK, 0.4), [0, 0.52, 0.0], [1.06, 1, 1], [Math.PI / 2 - 0.12, 0, 0]));
  for (const x of [-1, 1]) {
    const g = group([x * 0.16, 0.7, 0.33]); g.rotation.set(-0.75, x * 0.15, 0);
    g.add(part(G.torus(0.12, 0.045), vinyl(GOGGLE, 0.3)));
    g.add(blob(glass(0x9fe4ff, 0.6), [0, 0, 0], [0.11, 0.11, 0.035]));
    g.add(blob(new THREE.MeshBasicMaterial({ color: 0xffffff }), [0.04, 0.04, 0.03], [0.025, 0.025, 0.01], [0, 0, 0], 8));
    h.add(g);
  }
  h.add(cyl(vinyl(GOGGLE, 0.3), [0, 0.72, 0.4], 0.03, 0.12, [0, 0, Math.PI / 2], 8));    // bridge

  // Curly tail with a white tip
  const tail = group([0, 0.12, -0.24]);
  tail.add(tube([[0, 0, 0], [0.08, 0.0, -0.22], [0.25, 0.12, -0.32], [0.38, 0.32, -0.22], [0.36, 0.45, -0.05]], 0.07, fur, 0.85));
  tail.add(blob(white, [0.36, 0.45, -0.05], 0.065));
  rig.torso.add(tail); rig.tail = tail;

  rig.idle = (t, _dt, excited) => {
    // can't sit still: little bounce of the ears
    for (const [i, e] of rig.ears.entries()) e.rotation.x = Math.sin(t * (6 + excited * 6) + i) * 0.08;
  };
  return rig;
}
