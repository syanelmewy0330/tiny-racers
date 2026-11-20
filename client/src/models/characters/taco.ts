import { G, blob, cyl, eye, group, part, tube, vinyl } from '../toy';
import { toyBody, type CharacterRig } from './rig';

const FAWN = 0xdcb88c, MASK = 0x35292c, CAP = 0xd9403f, PHONES = 0xd9403f;

/** Taco: round-faced pug with sleepy eyes, a backwards red cap and big headphones. */
export function buildTaco(): CharacterRig {
  const rig = toyBody({ outfit: 0xc93a3c, trim: 0xf3e6cf, chest: FAWN, hands: FAWN, feet: MASK });
  rig.torso.scale.set(1.08, 1, 1.05);   // a well-fed pug
  const h = rig.head, fur = vinyl(FAWN, 0.6), mask = vinyl(MASK, 0.5);

  h.add(blob(fur, [0, 0.38, 0], [0.53, 0.42, 0.43]));                    // wide round head
  for (const x of [-1, 1]) h.add(blob(fur, [x * 0.24, 0.26, 0.26], [0.2, 0.16, 0.17]));   // jowls
  h.add(blob(mask, [0, 0.27, 0.33], [0.26, 0.19, 0.16]));                // dark muzzle
  h.add(blob(vinyl(0x15101a, 0.3), [0, 0.35, 0.47], [0.1, 0.06, 0.05])); // nose
  for (const k of [0, 1]) {                                               // forehead wrinkles
    const w = part(G.torus(0.13 - k * 0.03, 0.014, Math.PI * 0.7), vinyl(0xc79a6e), [0, 0.6 - k * 0.06, 0.38 - k * 0.01], 1, [-0.45, 0, Math.PI * 0.15]);
    h.add(w);
  }
  for (const x of [-1, 1]) {
    const e = eye(0.14, 0x3a2416, { lid: FAWN, lidAngle: 0.15 });          // sleepy half-closed eyes
    e.position.set(x * 0.21, 0.44, 0.31); e.rotation.y = x * 0.32;
    h.add(e); rig.eyes.push(e);
    h.add(blob(mask, [x * 0.21, 0.44, 0.27], [0.19, 0.17, 0.1]));          // dark eye patches
    const ear = group([x * 0.42, 0.58, 0.04]); ear.rotation.z = x * 0.7;    // floppy ears
    ear.add(blob(mask, [0, -0.08, 0], [0.14, 0.17, 0.06]));
    h.add(ear); rig.ears.push(ear);
  }
  const tongue = blob(vinyl(0xff7a9a, 0.35), [0.05, 0.16, 0.43], [0.07, 0.035, 0.09], [0.4, 0, 0]);
  h.add(tongue);

  // red baseball cap, worn backwards
  const cap = group([0, 0.6, -0.05]); cap.rotation.x = -0.2;
  cap.add(part(G.halfSphere(), vinyl(CAP, 0.45), [0, 0, 0], [0.46, 0.32, 0.46]));
  cap.add(blob(vinyl(CAP, 0.45), [0, 0.02, -0.5], [0.3, 0.035, 0.24]));      // brim at the back
  cap.add(blob(vinyl(0xfff1d6), [0, 0.36, 0], 0.05));                         // button
  cap.add(blob(vinyl(0xf3e6cf), [0, 0.14, -0.43], [0.13, 0.09, 0.03], [0.3, 0, 0]));   // strap badge at the back
  h.add(cap);

  // headphones over the cap
  h.add(part(G.torus(0.53, 0.045, Math.PI), vinyl(0x252638, 0.4), [0, 0.4, 0.02], 1, [0, 0, 0]));
  for (const x of [-1, 1]) {
    h.add(cyl(vinyl(PHONES, 0.35), [x * 0.5, 0.4, 0.02], 0.15, 0.12, [0, 0, Math.PI / 2]));
    h.add(cyl(vinyl(0x252638, 0.6), [x * 0.45, 0.4, 0.02], 0.13, 0.05, [0, 0, Math.PI / 2]));
    h.add(cyl(vinyl(0xf3e6cf, 0.4), [x * 0.565, 0.4, 0.02], 0.06, 0.01, [0, 0, Math.PI / 2]));
  }

  // little curly tail
  const tail = group([0, 0.18, -0.28]);
  tail.add(tube([[0, 0, 0], [0, 0.08, -0.12], [0.06, 0.18, -0.12], [0.06, 0.16, -0.02], [0, 0.1, -0.04]], 0.05, fur));
  rig.torso.add(tail); rig.tail = tail;

  rig.idle = (t, _dt, excited) => {
    tongue.position.y = 0.16 + Math.sin(t * (4 + excited * 8)) * 0.012;
    tongue.rotation.z = Math.sin(t * 2.3) * 0.15;
  };
  return rig;
}
