import type { PaintDef } from '@shared/karts';
import { G, blob, cone, cyl, decal, gloss, group, matte, part, rbox, vinyl, css } from '../toy';
import { kartFrame, exhaust, type KartRig } from './base';

/** Little Disaster (Peanut): orange hot-rod with an angry face, a giant wing, huge exhausts and patch tape. */
export function buildLittleDisaster(paint: PaintDef): KartRig {
  const rig = kartFrame({ paint, front: [0.9, 0.32], rear: [-0.82, 0.46], track: 0.84, rim: 0x252638 });
  const r = rig.root, body = gloss(paint.body), trim = gloss(paint.trim);

  r.add(rbox(body, [0, 0.47, -0.15], [1.12, 0.42, 1.5], 0.18));               // tub
  r.add(blob(body, [0, 0.47, 0.66], [0.55, 0.27, 0.6]));                         // fat nose
  r.add(rbox(trim, [0, 0.3, 1.16], [1.4, 0.18, 0.22], 0.08));                   // bumper
  // angry face on the nose
  const face = decal(`disaster-face-${paint.body}`, 0.75, 0.4, (g, W, H) => {
    g.fillStyle = '#fff';
    for (const s of [-1, 1]) {
      g.beginPath(); g.ellipse(W / 2 + s * W * 0.22, H * 0.45, W * 0.15, H * 0.26, 0, 0, 7); g.fill();
      g.fillStyle = '#252638'; g.beginPath(); g.arc(W / 2 + s * W * 0.18, H * 0.52, W * 0.07, 0, 7); g.fill(); g.fillStyle = '#fff';
      g.save(); g.fillStyle = '#252638'; g.translate(W / 2 + s * W * 0.22, H * 0.16); g.rotate(s * 0.35); g.fillRect(-W * 0.17, -H * 0.06, W * 0.34, H * 0.13); g.restore();
    }
  });
  face.position.set(0, 0.75, 0.8); face.rotation.x = -Math.PI / 2 + 0.3; r.add(face);
  const teeth = decal('disaster-teeth', 0.9, 0.14, (g, W, H) => {
    g.fillStyle = '#252638'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff';
    for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(i * W / 9 + 2, 2); g.lineTo((i + 0.5) * W / 9, H - 2); g.lineTo((i + 1) * W / 9 - 2, 2); g.fill(); }
  });
  teeth.position.set(0, 0.3, 1.275); r.add(teeth);
  for (const x of [-1, 1]) {
    r.add(blob(body, [x * 0.6, 0.45, -0.25], [0.2, 0.22, 0.6]));               // muscly side pods
    // flame decals
    const flames = decal(`disaster-flames-${paint.trim}`, 0.9, 0.3, (g, W, H) => {
      g.fillStyle = css(paint.trim);
      g.beginPath(); g.moveTo(W, H * 0.5);
      for (let i = 0; i <= 5; i++) { g.quadraticCurveTo(W * (0.85 - i * 0.16), H * (i % 2 ? 0.05 : 0.95), W * (0.78 - i * 0.16), H * 0.5); }
      g.lineTo(W, H * 0.5); g.fill();
      g.fillStyle = '#e5a94b'; g.beginPath(); g.moveTo(W, H * 0.5);
      for (let i = 0; i <= 3; i++) g.quadraticCurveTo(W * (0.9 - i * 0.15), H * (i % 2 ? 0.25 : 0.75), W * (0.82 - i * 0.15), H * 0.5);
      g.fill();
    });
    flames.position.set(x * 0.81, 0.45, -0.1); flames.rotation.y = x * Math.PI / 2; if (x < 0) flames.scale.x *= -1; r.add(flames);
    // patch tape
    const tape = decal('tape-x', 0.22, 0.22, (g, W) => {
      g.fillStyle = '#c9cbd3'; g.save(); g.translate(W / 2, W / 2);
      for (const a of [0.78, -0.78]) { g.save(); g.rotate(a); g.fillRect(-W * 0.45, -W * 0.09, W * 0.9, W * 0.18); g.restore(); }
      g.restore();
    });
    tape.position.set(x * 0.81, 0.58, -0.62); tape.rotation.y = x * Math.PI / 2; r.add(tape);
  }
  // giant rear wing on tall struts
  for (const x of [-0.35, 0.35]) r.add(rbox(trim, [x, 0.95, -1.05], [0.07, 0.65, 0.12], 0.03, [0.15, 0, 0]));
  r.add(rbox(body, [0, 1.3, -1.12], [1.65, 0.1, 0.46], 0.04, [0.15, 0, 0]));
  for (const x of [-1, 1]) r.add(rbox(trim, [x * 0.84, 1.26, -1.12], [0.06, 0.34, 0.54], 0.03));
  // hazard stripes on the wing
  const hazard = decal('hazard', 1.5, 0.16, (g, W, H) => {
    g.fillStyle = '#e5a94b'; g.fillRect(0, 0, W, H); g.fillStyle = '#252638';
    for (let x = -H; x < W; x += H * 1.2) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H * 0.6, 0); g.lineTo(x + H * 1.2, 0); g.lineTo(x + H * 0.6, H); g.fill(); }
  });
  hazard.position.set(0, 1.36, -1.13); hazard.rotation.x = -Math.PI / 2 + 0.15; r.add(hazard);
  // exposed engine with a chunky air scoop
  r.add(rbox(matte(0x3a3448), [0, 0.7, -0.9], [0.55, 0.28, 0.4], 0.06));
  r.add(rbox(trim, [0, 0.9, -0.85], [0.32, 0.16, 0.3], 0.05));
  r.add(rbox(vinyl(0x1b1726), [0, 0.92, -0.69], [0.24, 0.1, 0.02], 0.02));
  // big cartoon bomb strapped to the back (Peanut's calling card)
  const bomb = group([0, 0.55, -1.42]); r.add(bomb);
  bomb.add(blob(gloss(0x252638), [0, 0.12, 0], 0.17));
  bomb.add(cyl(gloss(0x8790b8), [0, 0.3, 0], 0.06, 0.06, [0, 0, 0], 10));
  bomb.add(part(G.torus(0.06, 0.012, Math.PI), vinyl(0xd8c6a5), [0.05, 0.35, 0], 1, [0, 0, 0]));
  const spark = group([0.11, 0.37, 0]); spark.add(cone(gloss(0xe5a94b), [0, 0, 0], 0.03, 0.07, [0, 0, -0.6], 6)); bomb.add(spark);
  // huge exhausts
  exhaust(rig, 0.32, 0.5, -1.1, 0.12, 0.45, 0.35);
  exhaust(rig, -0.32, 0.5, -1.1, 0.12, 0.45, 0.35);

  rig.idle = (t) => { spark.scale.setScalar(0.8 + Math.abs(Math.sin(t * 14)) * 0.6); bomb.rotation.z = Math.sin(t * 3) * 0.08; };
  return rig;
}
