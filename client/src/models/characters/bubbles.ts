import * as THREE from 'three';
import { G, blob, cone, cyl, decal, group, part, vinyl, glass, flat, sculpted, smooth, mix } from '../toy';
import { toyBody, type CharacterRig } from './rig';

// Bubbles' colours (design board v3.0): black and yellow racing suit, green eyes
const GRAY = 0x9a9aa3, STRIPE = 0x4f4d58, WHITE = 0xfbf8f2, PINK = 0xf2a0ae, NOSE = 0xf08a9c;
const AMBER = 0xfcc945, GOGGLE = 0xf5bd1f, LENS = 0x2e3440, SUIT = 0x1c1f26, MIDNIGHT = 0x15171c, LINER = 0x2a2233;

/**
 * Bubbles, "The energetic speed demon" (design board v3.0): a gray and white tabby
 * cat in a black and yellow racing suit with a checkered chest panel, yellow goggles
 * with smoky lenses pushed up on the forehead, half-lidded green eyes and a confident
 * smirk. The quality benchmark for the whole roster.
 */
export function buildBubbles(): CharacterRig {
  const rig = toyBody({ outfit: SUIT, trim: AMBER, hands: WHITE, feet: MIDNIGHT });
  const h = rig.head;

  // ---- head: one sculpted, hand-painted shape (no seams) ----
  const head = sculpted(
    (p) => {
      const cheek = Math.exp(-((p.y + 0.3) ** 2) / 0.08) * smooth(-0.2, 0.4, p.z);   // fuller cheeks low on the face
      p.x *= 0.53 * (1 + cheek * 0.12);
      p.y *= 0.45;
      p.z *= 0.47 * (1 - Math.max(0, p.z) ** 4 * 0.1);                              // slightly flatter face
    },
    (p) => {
      const ax = Math.abs(p.x);
      const muzzle = smooth(0.1, 0.35, p.z) * smooth(-0.02, -0.28, p.y);             // white lower face and cheeks
      const blaze = smooth(0.6, 0.8, p.z) * smooth(0.2, 0.08, ax) * smooth(0.8, 0.45, p.y);   // white stripe between the eyes
      const chin = smooth(-0.55, -0.85, p.y);
      let c = mix(GRAY, WHITE, Math.max(muzzle, blaze, chin)).clone();
      // tabby stripes: three on the forehead, a few on the cheeks and round the back
      const forehead = smooth(0.35, 0.55, p.y) * smooth(-0.1, 0.25, p.z) * smooth(0.2, 0.95, Math.sin(p.x * 17)) * smooth(0.4, 0.2, ax) * (1 - blaze);
      const sides = smooth(0.7, 0.85, ax) * smooth(-0.05, 0.15, p.y) * smooth(0.55, 0.35, p.y) * smooth(0.1, 0.95, Math.sin(p.y * 18)) * (1 - muzzle);
      const back = smooth(0.0, -0.3, p.z) * smooth(-0.2, 0.1, p.y) * smooth(0.15, 0.95, Math.sin(p.y * 12 + 0.4));
      const s = Math.max(forehead, sides, back);
      if (s > 0) c = c.lerp(new THREE.Color(STRIPE), s * 0.75);
      // goggle strap: a band painted round the head, tilted up towards the front
      const bandY = 0.42 + p.z * 0.22;
      const band = smooth(0.1, 0.06, Math.abs(p.y - bandY)) * smooth(0.55, 0.35, p.z);
      if (band > 0) c = c.lerp(new THREE.Color(MIDNIGHT), band);
      return c;
    },
    { rough: 0.62, seg: 96 },
  );
  head.position.set(0, 0.4, 0);
  h.add(head);

  // ---- eyes: big, glossy, with a dark liner so they read clearly from the chase camera ----
  for (const x of [-1, 1]) {
    const e = catEye(0.15, false);
    e.position.set(x * 0.2, 0.43, 0.355); e.rotation.set(-0.05, x * 0.32, x * -0.08);
    h.add(e); rig.eyes.push(e);
    // half-closed upper lid in fur colour, tilted down towards the nose: the board's confident look
    const lid = group([x * 0.2, 0.43, 0.355]); lid.rotation.set(-0.05, x * 0.32, x * 0.22);
    // a dome cap over the top of the eye; its lower rim is the lid line
    const capAngle = Math.PI * 0.42, rimY = Math.cos(capAngle), rimR = Math.sin(capAngle);
    lid.add(part(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, capAngle), vinyl(GRAY, 0.6), [0, 0, 0.006], [0.162, 0.168, 0.118]));
    // dark lid line along that rim, front half only, with a flick at the outer corner
    const line = part(G.torus(1, 0.09, Math.PI), vinyl(LINER, 0.35), [0, rimY * 0.168, 0.006], [rimR * 0.162, rimR * 0.118, rimR * 0.162], [Math.PI / 2, 0, 0]);
    lid.add(line);
    lid.add(cone(vinyl(LINER, 0.35), [x * 0.15, rimY * 0.168 + 0.01, 0.03], 0.012, 0.05, [0, 0, -x * 1.9], 6));
    h.add(lid);
  }

  // ---- nose, mouth, fangs, tongue ----
  h.add(blob(vinyl(NOSE, 0.3), [0, 0.335, 0.47], [0.055, 0.035, 0.035], [0.3, 0, 0]));
  h.add(cyl(vinyl(LINER, 0.4), [0, 0.3, 0.47], 0.008, 0.05, [0.15, 0, 0], 6));
  for (const x of [-1, 1]) h.add(part(G.torus(0.04, 0.008, Math.PI), vinyl(LINER, 0.4), [x * 0.038, 0.285, 0.468], [1, 0.8, 1], [0.1, 0, Math.PI]));   // the cat "w"
  const mouth = group([0, 0.262, 0.462]); h.add(mouth);
  // a closed, one-sided smirk: the right corner lifts
  mouth.add(part(G.torus(0.05, 0.008, Math.PI * 0.7), vinyl(LINER, 0.4), [0.025, 0.02, 0], [1.1, 0.7, 1], [0.1, 0, Math.PI * 1.15 + 0.25]));

  // ---- whiskers and white cheek tufts ----
  for (const x of [-1, 1]) {
    for (let k = 0; k < 3; k++) h.add(cyl(vinyl(LINER, 0.5), [x * 0.4, 0.29 - k * 0.04, 0.3], 0.005, 0.2, [0, -x * 0.3, Math.PI / 2 + x * (0.18 - k * 0.18)], 5));
  }

  // ---- ears with pink insides and white fur tufts ----
  for (const x of [-1, 1]) {
    const ear = group([x * 0.3, 0.7, 0.02]); ear.rotation.set(0.15, 0, -x * 0.32); ear.scale.set(1, 0.95, 0.55);
    ear.add(cone(vinyl(GRAY, 0.6), [0, 0.12, 0], 0.17, 0.3, [0, 0, 0], 24));
    ear.add(cone(vinyl(PINK, 0.5), [0, 0.1, 0.1], 0.1, 0.2, [0.12, 0, 0], 20));
    for (const k of [-1, 1]) ear.add(cone(vinyl(WHITE, 0.6), [k * 0.03, 0.06, 0.15], 0.02, 0.12, [0.3, 0, k * 0.3], 6));
    h.add(ear); rig.ears.push(ear);
  }

  // ---- yellow racing goggles pushed up on the forehead ----
  for (const x of [-1, 1]) {
    const g = group([x * 0.155, 0.66, 0.35]); g.rotation.set(-0.6, x * 0.22, 0);
    g.add(cyl(vinyl(MIDNIGHT, 0.4), [0, 0, -0.03], 0.125, 0.06, [Math.PI / 2, 0, 0], 28));   // rubber cup
    g.add(part(G.torus(0.118, 0.042), vinyl(GOGGLE, 0.25)));                            // frame
    g.add(blob(glass(LENS, 0.55), [0, 0, 0.005], [0.105, 0.105, 0.03]));                 // tinted lens
    g.add(blob(flat(0xffffff), [0.035, 0.04, 0.03], [0.03, 0.014, 0.005], [0, 0, 0.6], 10));   // glint
    g.add(blob(flat(0xffffff), [-0.03, -0.03, 0.03], [0.012, 0.008, 0.004], [0, 0, 0.6], 8));
    h.add(g);
  }
  h.add(cyl(vinyl(GOGGLE, 0.25), [0, 0.67, 0.395], 0.028, 0.1, [0, 0, Math.PI / 2], 10));      // bridge
  for (const x of [-1, 1]) h.add(rbox_(x));

  // ---- black and yellow racing suit ----
  const t = rig.torso;
  t.add(blob(vinyl(WHITE, 0.6), [0, 0.47, 0.17], [0.12, 0.08, 0.07]));                 // white chest fluff under the collar
  for (const x of [-1, 0, 1]) t.add(cone(vinyl(WHITE, 0.6), [x * 0.05, 0.42, 0.22], 0.03, 0.08, [Math.PI + 0.3, 0, 0], 8));
  // yellow panels sweeping from the shoulders down the sides of the chest
  for (const x of [-1, 1]) {
    t.add(blob(vinyl(AMBER, 0.45), [x * 0.2, 0.38, 0.17], [0.075, 0.14, 0.09], [0.2, x * 0.4, x * 0.35]));
    t.add(blob(vinyl(AMBER, 0.45), [x * 0.27, 0.2, 0.12], [0.05, 0.12, 0.09], [0, x * 0.5, x * -0.2]));
  }
  t.add(blob(vinyl(AMBER, 0.4), [0, 0.3, 0.285], [0.014, 0.2, 0.02]));                 // zip
  // checkered panel on the chest (his left)
  const flag = decal('bubbles-check', 0.15, 0.17, (g, W, H) => {
    const n = 5, cw = W / n, ch = H / 6;
    for (let i = 0; i < n; i++) for (let j = 0; j < 6; j++) { g.fillStyle = (i + j) % 2 ? '#1c1f26' : '#f2f2f0'; g.fillRect(i * cw, j * ch, cw, ch); }
  });
  flag.position.set(0.12, 0.28, 0.275); flag.rotation.y = 0.38; t.add(flag);
  const badge = decal('bubbles-bolt-y', 0.09, 0.09, (g, W) => {
    g.fillStyle = '#fcc945'; g.beginPath();
    [[0.62, 0.05], [0.28, 0.55], [0.5, 0.55], [0.36, 0.95], [0.75, 0.42], [0.53, 0.42], [0.7, 0.05]].forEach(([px, py], i) => (i ? g.lineTo(px * W, py * W) : g.moveTo(px * W, py * W)));
    g.closePath(); g.fill();
  });
  badge.position.set(-0.16, 0.33, 0.255); badge.rotation.y = -0.45; t.add(badge);
  for (const arm of [rig.armL, rig.armR]) {
    arm.add(blob(vinyl(AMBER, 0.4), [0, -0.27, 0], [0.09, 0.035, 0.09]));               // yellow cuffs
    arm.add(blob(vinyl(AMBER, 0.4), [0, -0.05, 0], [0.087, 0.06, 0.087]));              // yellow shoulder caps
  }

  // ---- curly tabby tail with a white tip ----
  const tail = group([0, 0.12, -0.24]);
  tail.add(tabbyTail());
  rig.torso.add(tail); rig.tail = tail;

  rig.idle = (time, _dt, excited) => {
    for (const [i, e] of rig.ears.entries()) e.rotation.x = 0.15 + Math.sin(time * (5 + excited * 7) + i * 1.3) * 0.06;
    mouth.scale.y = 1 + Math.sin(time * 3) * 0.06 + excited * 0.25;
  };
  return rig;

  /** Small buckle where the strap meets the frame. */
  function rbox_(x: number) {
    return blob(vinyl(MIDNIGHT, 0.4), [x * 0.33, 0.64, 0.25], [0.035, 0.05, 0.03], [0, x * 0.6, 0]);
  }
}

/** A big glossy cartoon eye: white, green iris, large pupil, two glints, dark upper liner. */
function catEye(size: number, liner = true) {
  const e = new THREE.Group();
  e.add(blob(vinyl(0xffffff, 0.2), [0, 0, 0], [size, size * 1.08, size * 0.55]));
  const iris = group([0.0, -0.01 * size, size * 0.4]);
  iris.add(blob(vinyl(0x3f8a45, 0.2), [0, 0, 0], [size * 0.74, size * 0.82, size * 0.22]));
  iris.add(blob(vinyl(0x9bd36a, 0.2), [0, -size * 0.18, size * 0.04], [size * 0.55, size * 0.45, size * 0.2]));   // lighter lower iris
  iris.add(blob(vinyl(0x15101a, 0.12), [0, size * 0.0, size * 0.08], [size * 0.3, size * 0.5, size * 0.17]));   // slit-ish pupil
  iris.add(blob(flat(0xffffff), [size * 0.24, size * (liner ? 0.3 : 0.08), size * 0.2], [size * 0.2, size * 0.17, size * 0.05], [0, 0, 0], 12));
  iris.add(blob(flat(0xffffff), [-size * 0.2, -size * 0.24, size * 0.2], size * 0.08, [0, 0, 0], 8));
  e.add(iris);
  // upper liner arc and a little flick at the outer corner
  if (liner) e.add(part(G.torus(size * 1.0, size * 0.09, Math.PI * 0.9), vinyl(0x2a2233, 0.35), [0, 0, size * 0.12], [1, 1.08, 1], [0, 0, Math.PI * 0.05]));
  return e;
}

/** Tail as one tube, painted with tabby rings and a white tip. */
function tabbyTail() {
  const pts = [[0, 0, 0], [0.08, 0.0, -0.22], [0.25, 0.12, -0.32], [0.38, 0.32, -0.22], [0.36, 0.47, -0.05]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(pts);
  const seg = 40, rad = 12;
  const g = new THREE.TubeGeometry(curve, seg, 0.07, rad, false);
  const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), centre = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, taper = 1 - t * 0.2;
    curve.getPointAt(t, centre);
    const c = t > 0.86 ? new THREE.Color(WHITE) : Math.sin(t * Math.PI * 9) > 0.35 ? new THREE.Color(STRIPE) : new THREE.Color(GRAY);
    for (let j = 0; j <= rad; j++) {
      const k = i * (rad + 1) + j;
      v.fromBufferAttribute(pos, k).sub(centre).multiplyScalar(taper).add(centre);
      pos.setXYZ(k, v.x, v.y, v.z);
      c.toArray(cols, k * 3);
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const o = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.6, clearcoat: 0.4 });
  const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; o.add(mesh);
  o.add(blob(vinyl(GRAY, 0.6), [0, 0, 0], 0.07));
  const end = curve.getPointAt(1);
  o.add(blob(vinyl(WHITE, 0.6), [end.x, end.y, end.z], 0.056));
  return o;
}
