import * as THREE from 'three';
import type { PaintDef } from '@shared/karts';
import { blob, cyl, decal, gloss, glow, group, matte, metal, rbox, vinyl } from '../toy';
import { kartFrame, exhaust, type KartRig } from './base';

/** Snack Mobile (Taco): a tiny food truck racer with a striped awning, a serving hatch and a burger sign. */
export function buildSnackMobile(paint: PaintDef): KartRig {
  const rig = kartFrame({ paint, front: [0.9, 0.34], rear: [-0.85, 0.4], track: 0.84, rim: 0xf3e6cf, seat: [0, 0.5, -0.12], steer: [0, 0.94, 0.42] });
  const r = rig.root, body = gloss(paint.body), trim = gloss(paint.trim), cream = gloss(0xf3e6cf);

  // front: rounded bonnet with a chrome grille and round headlights
  r.add(rbox(body, [0, 0.45, 0.62], [1.2, 0.42, 0.85], 0.18));
  r.add(rbox(trim, [0, 0.3, 1.08], [1.28, 0.16, 0.16], 0.07));                  // bumper
  r.add(rbox(metal(), [0, 0.47, 1.05], [0.62, 0.22, 0.05], 0.03));                 // grille
  for (let i = 0; i < 4; i++) r.add(rbox(vinyl(0x2b2738), [0, 0.39 + i * 0.05, 1.075], [0.56, 0.015, 0.02], 0.005));
  for (const x of [-1, 1]) {
    r.add(cyl(metal(), [x * 0.45, 0.5, 1.03], 0.1, 0.06, [Math.PI / 2, 0, 0], 16));
    r.add(cyl(glow(0xfff4d6, 0.9), [x * 0.45, 0.5, 1.065], 0.075, 0.02, [Math.PI / 2, 0, 0], 16));
  }
  // cockpit sides
  for (const x of [-1, 1]) r.add(rbox(body, [x * 0.55, 0.52, -0.1], [0.12, 0.42, 0.75], 0.05));

  // the truck box behind the driver
  const box = group([0, 0, -0.86]); r.add(box);
  box.add(rbox(cream, [0, 0.82, 0], [1.22, 0.86, 0.78], 0.1));
  box.add(rbox(trim, [0, 1.3, 0], [1.3, 0.12, 0.86], 0.05));                     // roof
  box.add(rbox(body, [0, 0.46, 0], [1.24, 0.18, 0.8], 0.05));                    // lower band in paint colour
  for (const x of [-1, 1]) {
    box.add(rbox(vinyl(0x3a3045), [x * 0.6, 0.86, 0.02], [0.04, 0.34, 0.5], 0.02));   // serving hatch
    box.add(rbox(cream, [x * 0.62, 0.68, 0.02], [0.08, 0.04, 0.56], 0.02));            // counter
    // striped awning over each hatch, sloping outwards
    for (let i = 0; i < 6; i++) {
      const z = -0.27 + i * 0.108;
      box.add(rbox(gloss(i % 2 ? 0xf3e6cf : 0xd9403f), [x * 0.74, 1.12, z], [0.32, 0.03, 0.108], 0.012, [0, 0, -x * 0.5]));
      box.add(blob(gloss(i % 2 ? 0xf3e6cf : 0xd9403f), [x * 0.88, 1.04, z], [0.02, 0.04, 0.054]));
    }
    // burger sign on the side
    const sign = decal('burger-sign', 0.5, 0.26, (g, W, H) => {
      g.fillStyle = '#252638'; g.beginPath(); g.roundRect(0, 0, W, H, H * 0.2); g.fill();
      g.fillStyle = '#e5a94b'; g.font = `700 ${H * 0.42}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SNACKS', W * 0.58, H * 0.52);
      g.fillStyle = '#e5a94b'; g.beginPath(); g.ellipse(W * 0.14, H * 0.4, W * 0.08, H * 0.16, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#d9403f'; g.fillRect(W * 0.06, H * 0.48, W * 0.16, H * 0.08);
      g.fillStyle = '#e5a94b'; g.fillRect(W * 0.06, H * 0.58, W * 0.16, H * 0.1);
    });
    sign.position.set(x * 0.615, 0.5, 0.02); sign.rotation.y = x * Math.PI / 2; box.add(sign);
  }
  // big taco on the roof
  const taco = group([0, 1.47, 0]); box.add(taco);
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.24, 24, 1, false, Math.PI / 2, Math.PI), vinyl(0xe5a94b, 0.45));
  shell.rotation.z = Math.PI / 2; shell.position.y = 0.3; shell.castShadow = true; taco.add(shell);
  taco.add(blob(vinyl(0x7fb069, 0.6), [0, 0.3, 0.0], [0.11, 0.07, 0.29]));
  for (const z of [-0.14, 0.0, 0.14]) taco.add(blob(vinyl(0xd9403f, 0.4), [0, 0.34, z], [0.07, 0.05, 0.06]));
  taco.add(blob(vinyl(0x8a5a3a, 0.6), [0, 0.27, 0], [0.1, 0.06, 0.27]));
  taco.add(cyl(metal(0x8d90a3), [0, -0.05, 0], 0.03, 0.2, [0, 0, 0], 8));
  // ketchup and mustard bottles by the exhausts
  for (const [x, c] of [[-0.42, 0xd9403f], [0.42, 0xe5a94b]] as const) {
    r.add(cyl(gloss(c), [x, 0.68, -1.32], 0.07, 0.24, [0, 0, 0], 12));
    r.add(cyl(matte(0xf3e6cf), [x, 0.84, -1.32], 0.03, 0.08, [0, 0, 0], 8));
  }
  exhaust(rig, 0.2, 0.42, -1.25, 0.08, 0.25, 0.1);
  exhaust(rig, -0.2, 0.42, -1.25, 0.08, 0.25, 0.1);
  // the taco gently bobs while waiting at the start
  rig.idle = (t, _dt, speed) => { taco.rotation.y = speed < 1 ? Math.sin(t * 0.8) * 0.4 : 0; taco.position.y = 1.47 + Math.sin(t * 2) * 0.02; };
  void blob;
  return rig;
}
