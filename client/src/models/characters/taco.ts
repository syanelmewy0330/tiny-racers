import * as THREE from 'three';
import { G, blob, cone, cyl, decal, group, part, vinyl, flat, sculpted, smooth, mix } from '../toy';
import { toyBody, type CharacterRig } from './rig';
import { toonEye, paintedTube } from './parts';

// Taco's colours (design bible v2.0)
const FAWN = 0xd9b689, FAWN_DARK = 0xb8915f, MASK = 0x2f2528, CAP = 0xd63c3d, CREAM = 0xf3e6cf;
const JACKET = 0xc63537, MIDNIGHT = 0x252638, TONGUE = 0xf27a93;

/**
 * Taco, "The Snack Strategist": a round-faced pug with sleepy half-lidded eyes,
 * a backwards red cap, chunky red headphones and a red racing jacket. Lazy and
 * hungry, until the countdown starts.
 */
export function buildTaco(): CharacterRig {
  const rig = toyBody({ outfit: JACKET, trim: CREAM, chest: FAWN, hands: FAWN, feet: MASK });
  rig.torso.scale.set(1.08, 1, 1.05);   // a well-fed pug
  const h = rig.head;

  // ---- head: wide pug skull with a flat face and heavy jowls, mask painted on ----
  const head = sculpted(
    (p) => {
      const jowl = Math.exp(-((p.y + 0.35) ** 2) / 0.07) * smooth(0.0, 0.5, p.z);
      p.x *= 0.55 * (1 + jowl * 0.16);
      p.y *= 0.43;
      p.z *= 0.44 * (1 - Math.max(0, p.z) ** 3 * 0.22);                    // very flat face
    },
    (p) => {
      const ax = Math.abs(p.x);
      // black muzzle mask and dark patches round the eyes
      const muzzle = smooth(0.55, 0.75, p.z) * smooth(0.12, -0.08, p.y) * smooth(0.55, 0.35, ax);
      const eyeD = Math.hypot(ax - 0.42, p.y - 0.08, (p.z - 0.88) * 0.8);
      const patch = smooth(0.26, 0.18, eyeD);
      let c = mix(FAWN, MASK, Math.max(muzzle, patch)).clone();
      // forehead wrinkles: soft darker curves
      const wr = p.y - 0.33 - ax * ax * 0.5;
      const wrinkles = smooth(0.6, 0.8, p.z) * smooth(0.3, 0.1, ax) * Math.max(smooth(0.03, 0.0, Math.abs(wr)), smooth(0.03, 0.0, Math.abs(wr - 0.11)));
      if (wrinkles > 0) c = c.lerp(new THREE.Color(FAWN_DARK), wrinkles * 0.9);
      // darker "thumbprint" on top of the head
      const thumb = smooth(0.25, 0.1, Math.hypot(p.x, (p.z - 0.2))) * smooth(0.75, 0.9, p.y);
      if (thumb > 0) c = c.lerp(new THREE.Color(FAWN_DARK), thumb * 0.6);
      return c;
    },
    { rough: 0.62, seg: 96 },
  );
  head.position.set(0, 0.38, 0);
  h.add(head);

  // ---- sleepy eyes with heavy lids ----
  for (const x of [-1, 1]) {
    const e = toonEye(0.145, { iris: 0x5b3a1e, irisLight: 0x8a5a2e, lid: 0x4b3b3e, lidDrop: 0.55, look: [0, -0.3] });
    e.position.set(x * 0.215, 0.42, 0.315); e.rotation.set(0, x * 0.4, x * 0.12);
    h.add(e); rig.eyes.push(e);
  }

  // ---- big glossy nose, mouth and the tongue that never goes back in ----
  h.add(blob(vinyl(0x17121a, 0.2), [0, 0.35, 0.425], [0.105, 0.065, 0.06]));
  for (const x of [-1, 1]) h.add(blob(vinyl(0x000000, 0.4), [x * 0.035, 0.345, 0.48], [0.02, 0.012, 0.01]));   // nostrils
  h.add(blob(flat(0xffffff), [0.03, 0.385, 0.475], [0.03, 0.012, 0.005], [0, 0, 0.3], 8));                     // nose glint
  for (const x of [-1, 1]) h.add(part(G.torus(0.06, 0.012, Math.PI * 0.8), vinyl(0x15101a, 0.4), [x * 0.06, 0.27, 0.43], 1, [0.1, 0, Math.PI * 1.1]));
  const tongue = group([0.05, 0.215, 0.43]); h.add(tongue);
  tongue.add(blob(vinyl(TONGUE, 0.35), [0, -0.03, 0.02], [0.06, 0.08, 0.035], [0.5, 0, 0.15]));
  tongue.add(cyl(vinyl(0xd9607a, 0.4), [0, -0.03, 0.05], 0.004, 0.1, [0.5, 0, 0.15], 6));   // centre crease

  // ---- floppy black ears (peeking out under the headphones) ----
  for (const x of [-1, 1]) {
    const ear = group([x * 0.43, 0.6, 0.08]); ear.rotation.set(0.2, 0, x * 0.75);
    ear.add(blob(vinyl(MASK, 0.5), [0, -0.1, 0], [0.13, 0.17, 0.05]));
    h.add(ear); rig.ears.push(ear);
  }

  // ---- red baseball cap, worn backwards ----
  const cap = group([0, 0.64, -0.04]); cap.rotation.x = -0.2;
  cap.add(part(G.halfSphere(48), vinyl(CAP, 0.45), [0, 0, 0], [0.54, 0.34, 0.5]));
  for (let i = 0; i < 6; i++) {   // panel seams
    const a = (i / 6) * Math.PI * 2;
    cap.add(part(G.torus(1, 0.008, Math.PI / 2), vinyl(0xa82c2e, 0.5), [0, 0, 0], [0.345, 0.535, 0.535], [0, a, Math.PI / 2]));
  }
  cap.add(blob(vinyl(CAP, 0.45), [0, 0.03, -0.56], [0.32, 0.035, 0.25]));          // brim at the back
  cap.add(blob(vinyl(0xa82c2e, 0.5), [0, 0.0, -0.56], [0.31, 0.02, 0.24]));        // brim underside
  cap.add(blob(vinyl(CAP, 0.45), [0, 0.34, 0], [0.05, 0.03, 0.05]));                // button
  // back strap opening above the face
  cap.add(blob(vinyl(0x8f2426, 0.6), [0, 0.05, 0.48], [0.075, 0.045, 0.02]));
  cap.add(rbox_(0, 0.1, 0.495));
  h.add(cap);

  // ---- chunky headphones over the cap ----
  h.add(part(G.torus(0.56, 0.045, Math.PI), vinyl(MIDNIGHT, 0.4), [0, 0.42, 0.02], [1, 1.1, 1], [0, 0, 0]));
  h.add(part(G.torus(0.56, 0.05, Math.PI * 0.5), vinyl(0x3a3b55, 0.6), [0, 0.42, 0.02], [1, 1.1, 1.2], [0, 0, Math.PI * 0.25]));   // padded top
  for (const x of [-1, 1]) {
    h.add(cyl(vinyl(CAP, 0.3), [x * 0.52, 0.4, 0.02], 0.16, 0.13, [0, 0, Math.PI / 2], 28));
    h.add(cyl(vinyl(MIDNIGHT, 0.6), [x * 0.45, 0.4, 0.02], 0.14, 0.05, [0, 0, Math.PI / 2], 28));
    h.add(cyl(vinyl(CREAM, 0.4), [x * 0.59, 0.4, 0.02], 0.07, 0.012, [0, 0, Math.PI / 2], 20));
  }

  // ---- jacket details: cream zip, collar, taco badge, cuffs ----
  const t = rig.torso;
  const badge = decal('taco-badge', 0.12, 0.09, (g, W, H) => {
    g.fillStyle = '#e5a94b'; g.beginPath(); g.arc(W / 2, H * 0.95, W * 0.45, Math.PI, 0); g.fill();
    g.fillStyle = '#7fb069'; g.fillRect(W * 0.1, H * 0.48, W * 0.8, H * 0.12);
    g.fillStyle = '#d63c3d'; for (const x of [0.28, 0.5, 0.72]) { g.beginPath(); g.arc(W * x, H * 0.5, W * 0.07, 0, 7); g.fill(); }
  });
  badge.position.set(0.17, 0.34, 0.272); badge.rotation.y = 0.5; t.add(badge);
  for (const arm of [rig.armL, rig.armR]) arm.add(blob(vinyl(CREAM, 0.4), [0, -0.275, 0], [0.092, 0.035, 0.092]));

  // ---- curly tail ----
  const tail = group([0, 0.18, -0.29]);
  tail.add(paintedTube([[0, 0, 0], [0, 0.08, -0.12], [0.07, 0.18, -0.12], [0.07, 0.16, -0.02], [0.01, 0.11, -0.05]], 0.05, (u) => (u > 0.8 ? FAWN_DARK : FAWN), 0.9));
  rig.torso.add(tail); rig.tail = tail;

  rig.idle = (time, _dt, excited) => {
    tongue.rotation.z = Math.sin(time * 2.3) * 0.12;
    tongue.position.y = 0.215 + Math.sin(time * (4 + excited * 8)) * 0.008;
  };
  return rig;
}

function rbox_(x: number, y: number, z: number) {
  return blob(vinyl(0xf3e6cf, 0.4), [x, y, z], [0.06, 0.018, 0.012]);   // little adjuster strap
}
void cone;
