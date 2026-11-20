import * as THREE from 'three';
import type { PaintDef } from '@shared/karts';
import { blob, decal, gloss, rbox, vinyl, css, glow, part, G, metal, INK } from '../toy';
import { kartFrame, exhaust, type KartRig } from './base';

const GOLD = 0xd9a521;

/** A side profile (z forward, y up) pushed out sideways into a rounded solid. */
function profile(m: THREE.Material, pts: [number, number][], width: number, x = 0, bevel = 0.07) {
  const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 4, curveSegments: 12 });
  g.rotateY(-Math.PI / 2);
  g.translate(x + width / 2 - bevel, 0, 0);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

/**
 * Zoomie (Bubbles), design board v3.0: a low, wedge-nosed yellow sports racer with a
 * black bonnet, slim angular headlights, side pods with black intakes, gold rims and a
 * big black rear wing.
 */
export function buildZoomie(paint: PaintDef): KartRig {
  const rig = kartFrame({ paint, front: [0.85, 0.34], rear: [-0.8, 0.41], track: 0.8, rim: GOLD });
  const r = rig.root, body = gloss(paint.body), trim = gloss(paint.trim);

  // main body: low wedge nose rising to the cockpit, short engine deck, chopped tail
  r.add(profile(body, [[1.26, 0.2], [1.36, 0.29], [0.95, 0.44], [0.32, 0.6], [0.16, 0.63], [-0.5, 0.64], [-0.86, 0.72], [-1.12, 0.62], [-1.2, 0.36], [-1.02, 0.2]], 0.98));
  // black bonnet panel down the middle of the nose
  r.add(profile(trim, [[1.3, 0.3], [0.95, 0.456], [0.32, 0.615], [0.2, 0.64], [0.2, 0.58], [1.2, 0.27]], 0.4, 0, 0.03));
  for (const x of [-1, 1]) r.add(rbox(gloss(GOLD), [x * 0.21, 0.55, 0.62], [0.02, 0.012, 0.62], 0.005, [-0.27, 0, 0]));   // gold pin stripes
  // side pods with black intakes
  for (const x of [-1, 1]) {
    r.add(profile(body, [[0.5, 0.22], [0.32, 0.5], [-0.6, 0.56], [-0.92, 0.46], [-0.9, 0.22]], 0.26, x * 0.6, 0.06));
    r.add(rbox(vinyl(INK, 0.4), [x * 0.62, 0.38, 0.4], [0.2, 0.2, 0.06], 0.03, [0.55, 0, 0]));
    r.add(rbox(trim, [x * 0.74, 0.27, -0.2], [0.03, 0.08, 1.1], 0.02));            // black sill line
  }
  // cockpit rim and roll hoop
  r.add(part(G.torus(0.34, 0.035), vinyl(INK, 0.4), [0, 0.645, -0.28], [1, 1.35, 1], [Math.PI / 2, 0, 0]));
  r.add(part(G.torus(0.28, 0.045, Math.PI), trim, [0, 0.66, -0.72], 1, [0, 0, 0]));
  // front splitter and slim angular headlights
  r.add(rbox(trim, [0, 0.2, 1.24], [1.42, 0.035, 0.26], 0.015));
  for (const x of [-1, 1]) {
    r.add(rbox(trim, [x * 0.33, 0.37, 1.13], [0.3, 0.07, 0.1], 0.02, [0.3, x * 0.45, x * 0.12]));
    r.add(rbox(glow(0xfff4d6, 1.2), [x * 0.33, 0.375, 1.17], [0.24, 0.03, 0.04], 0.01, [0.3, x * 0.45, x * 0.12]));
  }
  // big black rear wing with yellow pin stripe and end plates
  for (const x of [-0.32, 0.32]) r.add(rbox(trim, [x, 0.9, -1.0], [0.06, 0.4, 0.1], 0.02, [0.25, 0, 0]));
  r.add(rbox(trim, [0, 1.1, -1.08], [1.4, 0.08, 0.4], 0.035, [0.12, 0, 0]));
  r.add(rbox(body, [0, 1.145, -1.08], [1.2, 0.012, 0.08], 0.005, [0.12, 0, 0]));
  for (const x of [-1, 1]) r.add(rbox(trim, [x * 0.71, 1.06, -1.08], [0.05, 0.3, 0.46], 0.03));
  for (const x of [-1, 1]) r.add(rbox(glow(0xff4d4d, 1.4), [x * 0.36, 0.5, -1.2], [0.2, 0.05, 0.03], 0.01));   // tail lights
  for (const x of [-1, 1]) {
    r.add(blob(trim, [x * 0.46, 0.7, 0.12], [0.03, 0.06, 0.03]));                     // mirror stalk
    r.add(rbox(trim, [x * 0.5, 0.76, 0.1], [0.14, 0.07, 0.04], 0.02, [0, x * 0.3, 0]));
  }

  // decals: lightning bolts on the pods, Z on the wing end plates
  const bolt = (g: CanvasRenderingContext2D, W: number, H: number) => {
    g.fillStyle = css(paint.trim); g.strokeStyle = '#fff'; g.lineWidth = W * 0.04; g.lineJoin = 'round';
    g.beginPath();
    [[0.62, 0.05], [0.3, 0.55], [0.5, 0.55], [0.36, 0.95], [0.75, 0.4], [0.54, 0.4], [0.7, 0.05]].forEach(([x, y], i) => (i ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H)));
    g.closePath(); g.stroke(); g.fill();
  };
  for (const x of [-1, 1]) {
    const d = decal(`zoomie-bolt-${paint.trim}`, 0.42, 0.26, bolt); d.position.set(x * 0.735, 0.42, -0.3); d.rotation.set(0, x * Math.PI / 2, x * 0.2);
    r.add(d);
  }
  for (const x of [-1, 1]) {
    const z = decal(`zoomie-z-${paint.body}`, 0.3, 0.2, (g, W, H) => {
      g.fillStyle = css(paint.body); g.font = `italic 700 ${H * 0.95}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Z', W / 2, H * 0.55);
    });
    z.position.set(x * 0.74, 1.06, -1.08); z.rotation.y = x * Math.PI / 2; r.add(z);
  }

  exhaust(rig, 0.18, 0.5, -1.15, 0.07, 0.25, 0.15);
  exhaust(rig, -0.18, 0.5, -1.15, 0.07, 0.25, 0.15);
  void metal;
  return rig;
}
