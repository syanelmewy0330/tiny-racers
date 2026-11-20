import type { PaintDef } from '@shared/karts';
import { blob, decal, gloss, group, rbox, vinyl, css, glow, INK } from '../toy';
import { kartFrame, exhaust, type KartRig } from './base';

/** Zoomie (Bubbles): compact yellow open-wheel racer with lightning bolts and a big rear wing. */
export function buildZoomie(paint: PaintDef): KartRig {
  const rig = kartFrame({ paint, front: [0.85, 0.34], rear: [-0.8, 0.41], track: 0.8 });
  const r = rig.root, body = gloss(paint.body), trim = gloss(paint.trim);

  r.add(rbox(body, [0, 0.45, -0.15], [1.12, 0.42, 1.45], 0.2));                 // chunky tub
  r.add(blob(body, [0, 0.47, 0.62], [0.52, 0.27, 0.62]));                        // rounded nose
  r.add(blob(trim, [0, 0.58, 0.82], [0.16, 0.1, 0.32]));                         // nose stripe
  r.add(rbox(trim, [0, 0.3, 1.17], [1.35, 0.16, 0.24], 0.08));                  // bumper
  for (const x of [-1, 1]) {
    r.add(blob(body, [x * 0.58, 0.42, -0.2], [0.22, 0.2, 0.55]));             // side pods
    r.add(blob(vinyl(INK, 0.4), [x * 0.6, 0.42, 0.18], [0.12, 0.09, 0.05]));  // air intakes
  }
  r.add(blob(body, [0, 0.62, -0.88], [0.38, 0.24, 0.3]));                     // engine cover
  // rear wing on two struts
  for (const x of [-0.3, 0.3]) r.add(rbox(trim, [x, 0.85, -1.0], [0.06, 0.4, 0.1], 0.02, [0.2, 0, 0]));
  r.add(rbox(body, [0, 1.05, -1.07], [1.3, 0.08, 0.36], 0.035, [0.12, 0, 0]));
  for (const x of [-1, 1]) r.add(rbox(trim, [x * 0.66, 1.03, -1.07], [0.06, 0.24, 0.42], 0.03));
  r.add(blob(glow(0xff5c8a, 1.2), [0, 0.5, -1.25], [0.14, 0.05, 0.03]));      // tail light

  // decals: lightning bolts on the pods, number roundel on the nose, paw on the wing
  const bolt = (g: CanvasRenderingContext2D, W: number, H: number) => {
    g.fillStyle = css(paint.trim); g.strokeStyle = '#fff'; g.lineWidth = W * 0.04; g.lineJoin = 'round';
    g.beginPath();
    [[0.62, 0.05], [0.3, 0.55], [0.5, 0.55], [0.36, 0.95], [0.75, 0.4], [0.54, 0.4], [0.7, 0.05]].forEach(([x, y], i) => (i ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H)));
    g.closePath(); g.stroke(); g.fill();
  };
  for (const x of [-1, 1]) {
    const d = decal(`zoomie-bolt-${paint.trim}`, 0.5, 0.32, bolt); d.position.set(x * 0.805, 0.43, -0.2); d.rotation.set(0, x * Math.PI / 2, x * 0.2);
    r.add(d);
  }
  const roundel = decal(`zoomie-1-${paint.trim}`, 0.34, 0.34, (g, W) => {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(W / 2, W / 2, W * 0.46, 0, 7); g.fill();
    g.lineWidth = W * 0.06; g.strokeStyle = css(paint.trim); g.stroke();
    g.fillStyle = css(paint.trim); g.font = `800 ${W * 0.62}px Baloo 2, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1', W / 2, W * 0.54);
  });
  roundel.position.set(0, 0.735, 0.55); roundel.rotation.x = -Math.PI / 2 + 0.3; r.add(roundel);
  const paw = decal('paw', 0.3, 0.3, (g, W) => {
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(W * 0.5, W * 0.64, W * 0.2, W * 0.16, 0, 0, 7); g.fill();
    for (const [x, y] of [[0.26, 0.38], [0.42, 0.26], [0.58, 0.26], [0.74, 0.38]]) { g.beginPath(); g.arc(x * W, y * W, W * 0.08, 0, 7); g.fill(); }
  });
  paw.position.set(0, 1.096, -1.07); paw.rotation.x = -Math.PI / 2 + 0.12; r.add(paw);

  exhaust(rig, 0.2, 0.55, -1.12, 0.08, 0.32, 0.2);
  exhaust(rig, -0.2, 0.55, -1.12, 0.08, 0.32, 0.2);
  const hood = group([0, 0, 0]); r.add(hood);
  return rig;
}
