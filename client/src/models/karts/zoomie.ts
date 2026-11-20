import type { PaintDef } from '@shared/karts';
import { blob, decal, gloss, group, rbox, vinyl, css, glow, INK } from '../toy';
import { kartFrame, exhaust, type KartRig } from './base';

/** Zoomie (Bubbles): compact yellow open-wheel racer with lightning bolts and a big rear wing. */
export function buildZoomie(paint: PaintDef): KartRig {
  const rig = kartFrame({ paint, front: [0.85, 0.34], rear: [-0.8, 0.41], track: 0.8, rim: paint.body });
  const r = rig.root, body = gloss(paint.body), trim = gloss(paint.trim);

  r.add(rbox(body, [0, 0.45, -0.15], [1.12, 0.42, 1.45], 0.2));                 // chunky tub
  r.add(blob(body, [0, 0.47, 0.62], [0.52, 0.27, 0.62]));                        // rounded nose
  for (const x of [-0.09, 0.09]) {                                             // twin racing stripes
    r.add(blob(trim, [x, 0.64, 0.62], [0.055, 0.105, 0.6]));
    r.add(rbox(trim, [x, 0.665, -0.2], [0.09, 0.02, 1.3], 0.01));
  }
  r.add(rbox(trim, [0, 0.3, 1.17], [1.35, 0.16, 0.24], 0.08));                  // bumper
  for (const x of [-1, 1]) {
    r.add(blob(body, [x * 0.58, 0.42, -0.2], [0.22, 0.2, 0.55]));             // side pods
    r.add(blob(vinyl(INK, 0.4), [x * 0.6, 0.42, 0.18], [0.12, 0.09, 0.05]));  // air intakes
  }
  r.add(blob(body, [0, 0.62, -0.88], [0.38, 0.24, 0.3]));                     // engine cover
  // rear wing on two struts
  for (const x of [-0.3, 0.3]) r.add(rbox(trim, [x, 0.85, -1.0], [0.06, 0.4, 0.1], 0.02, [0.2, 0, 0]));
  r.add(rbox(trim, [0, 1.05, -1.07], [1.3, 0.08, 0.38], 0.035, [0.12, 0, 0]));
  r.add(rbox(body, [0, 1.095, -1.07], [1.1, 0.012, 0.1], 0.005, [0.12, 0, 0]));   // wing pin stripe
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
  // "Z" badges on the wing end plates
  for (const x of [-1, 1]) {
    const z = decal(`zoomie-z-${paint.body}`, 0.3, 0.2, (g, W, H) => {
      g.fillStyle = css(paint.body); g.font = `italic 700 ${H * 0.95}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Z', W / 2, H * 0.55);
    });
    z.position.set(x * 0.695, 1.03, -1.07); z.rotation.y = x * Math.PI / 2; r.add(z);
  }
  // headlights
  for (const x of [-1, 1]) r.add(blob(glow(0xfff4d6, 0.8), [x * 0.3, 0.48, 1.12], [0.09, 0.06, 0.04]));

  exhaust(rig, 0.2, 0.55, -1.12, 0.08, 0.32, 0.2);
  exhaust(rig, -0.2, 0.55, -1.12, 0.08, 0.32, 0.2);
  const hood = group([0, 0, 0]); r.add(hood);
  return rig;
}
