import type { PaintDef } from '@shared/karts';
import { G, blob, decal, gloss, glow, group, part, rbox, vinyl, css } from '../toy';
import { kartFrame, exhaust, type KartRig } from './base';

/** Calculatron (Nimbus): sleek futuristic kart with glowing circuits, a data screen and an antenna. */
export function buildCalculatron(paint: PaintDef): KartRig {
  const rig = kartFrame({ paint, front: [0.92, 0.32], rear: [-0.82, 0.38], track: 0.82, rim: paint.trim });
  const r = rig.root, body = gloss(paint.body), trim = gloss(paint.trim), neon = glow(paint.trim, 1.8), dark = gloss(0x252638);

  r.add(rbox(body, [0, 0.42, -0.15], [1.05, 0.32, 1.5], 0.16));                // low tub
  r.add(blob(body, [0, 0.42, 0.7], [0.46, 0.2, 0.78]));                          // long pointed nose
  r.add(blob(dark, [0, 0.5, 1.0], [0.2, 0.08, 0.36]));                           // nose intake
  r.add(rbox(trim, [0, 0.27, 1.38], [1.45, 0.06, 0.28], 0.03, [0.08, 0, 0]));    // front wing blade
  for (const x of [-1, 1]) {
    r.add(blob(body, [x * 0.56, 0.38, -0.2], [0.18, 0.16, 0.66]));              // sculpted side pods
    r.add(rbox(neon, [x * 0.71, 0.4, -0.2], [0.02, 0.04, 1.0], 0.01));          // glowing side line
    r.add(rbox(neon, [x * 0.71, 0.4, 1.0], [0.02, 0.03, 0.25], 0.01));
    r.add(rbox(body, [x * 0.73, 0.33, 1.38], [0.05, 0.16, 0.34], 0.02));         // wing end plates
    // circular "7" roundels on the sides
    const num = decal(`calc-7-${paint.trim}`, 0.3, 0.3, (g, W) => {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(W / 2, W / 2, W * 0.46, 0, 7); g.fill();
      g.lineWidth = W * 0.07; g.strokeStyle = css(paint.trim); g.stroke();
      g.fillStyle = '#252638'; g.font = `italic 700 ${W * 0.6}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('7', W / 2, W * 0.54);
    });
    num.position.set(x * 0.745, 0.42, 0.25); num.rotation.y = x * Math.PI / 2; r.add(num);
  }
  // dashboard data screen in front of the steering wheel
  r.add(rbox(dark, [0, 0.72, 0.5], [0.5, 0.06, 0.28], 0.03, [0.35, 0, 0]));
  const screen = decal(`calc-screen-${paint.trim}`, 0.42, 0.2, (g, W, H) => {
    g.fillStyle = '#10142a'; g.fillRect(0, 0, W, H);
    g.strokeStyle = css(paint.trim); g.lineWidth = 3; g.beginPath();
    for (let x = 0; x <= W; x += 4) { const y = H * 0.55 - Math.sin(x / 18) * H * 0.25 - x / W * H * 0.15; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.fillStyle = '#ffffff'; g.font = `700 ${H * 0.22}px Fredoka, sans-serif`; g.fillText('v = 31.4', 6, H * 0.25);
  });
  screen.position.set(0, 0.765, 0.5); screen.rotation.x = -Math.PI / 2 + 0.35; r.add(screen);
  // rear: twin-strut swan-neck wing with a glowing edge
  for (const x of [-0.25, 0.25]) r.add(rbox(dark, [x, 0.82, -1.0], [0.05, 0.42, 0.08], 0.02, [-0.25, 0, 0]));
  r.add(rbox(body, [0, 1.02, -1.08], [1.25, 0.07, 0.34], 0.03, [0.1, 0, 0]));
  r.add(rbox(neon, [0, 1.0, -1.25], [1.2, 0.025, 0.02], 0.01));
  r.add(blob(body, [0, 0.58, -0.88], [0.34, 0.2, 0.3]));                        // engine cover
  // calculator keypad on the engine cover
  const pad = decal('calc-keypad', 0.36, 0.26, (g, W, H) => {
    g.fillStyle = '#252638'; g.beginPath(); g.roundRect(0, 0, W, H, 10); g.fill();
    const cols = ['#e5a94b', '#ffffff', '#ffffff', '#f05b65'];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) { g.fillStyle = cols[x]; g.beginPath(); g.roundRect(8 + x * (W - 16) / 4, 8 + y * (H - 16) / 3, (W - 16) / 4 - 6, (H - 16) / 3 - 6, 4); g.fill(); }
  });
  pad.position.set(0, 0.785, -0.86); pad.rotation.x = -Math.PI / 2 + 0.25; r.add(pad);
  // antenna with a blinking tip
  const antenna = group([0.38, 0.6, -0.95]); r.add(antenna);
  antenna.add(part(G.cyl(6), vinyl(0x252638), [0, 0.3, 0], [0.015, 0.6, 0.015]));
  const tip = blob(neon, [0, 0.62, 0], 0.045); antenna.add(tip);
  // glowing thrusters instead of plain pipes
  exhaust(rig, 0.22, 0.5, -1.05, 0.085, 0.24, 0.05);
  exhaust(rig, -0.22, 0.5, -1.05, 0.085, 0.24, 0.05);
  for (const x of [-0.22, 0.22]) r.add(part(G.torus(0.09, 0.02), neon, [x, 0.51, -1.32]));
  // glow rings on the wheels
  for (const w of rig.wheels) w.spin.add(part(G.torus(w.radius * 0.62, 0.02), neon, [Math.sign(w.pivot.position.x) * w.radius * 0.33, 0, 0], 1, [0, Math.PI / 2, 0]));

  rig.idle = (t, _dt, speed) => {
    tip.visible = Math.sin(t * 6) > -0.3;
    antenna.rotation.x = -Math.min(0.5, Math.abs(speed) * 0.02) + Math.sin(t * 9) * 0.03 * Math.min(1, Math.abs(speed) / 5);
  };
  return rig;
}
