import * as THREE from 'three';
import type { PaintDef } from '@shared/karts';
import { G, blob, cyl, group, part, rbox, matte, metal, vinyl, INK } from '../toy';

export interface Wheel { pivot: THREE.Group; spin: THREE.Group; front: boolean; radius: number }

/**
 * A kart model, separate from its driver. Origin on the ground under the kart's
 * centre, nose towards +z. Every kart has a body, four wheels, a seat, a steering
 * wheel and exhausts; the rest is decoration.
 */
export interface KartRig {
  root: THREE.Group;
  wheels: Wheel[];
  steering: THREE.Group;          // rotates around its local z when steering
  seat: THREE.Vector3;            // where the driver sits
  hands: [THREE.Vector3, THREE.Vector3]; // left/right grip points on the wheel (kart space)
  exhausts: THREE.Vector3[];      // boost flames start here, pointing -z
  idle?: (t: number, dt: number, speed: number) => void;
}

export interface KartFrame {
  paint: PaintDef;
  track?: number;                 // half distance between left and right wheels
  front?: [number, number];       // z, radius
  rear?: [number, number];
  rim?: number;
  seat?: [number, number, number];
  steer?: [number, number, number];
}

/** Toy tyre: a fat rubber donut with a coloured rim and a shiny hub cap. */
function wheel(r: number, rim: number, front: boolean): Wheel {
  const pivot = new THREE.Group(), spin = new THREE.Group();
  pivot.add(spin);
  spin.add(part(G.torus(r * 0.62, r * 0.38), matte(0x2b2738), [0, 0, 0], [1, 1, 1.25], [0, Math.PI / 2, 0]));
  spin.add(cyl(vinyl(rim, 0.35), [0, 0, 0], r * 0.6, r * 0.62, [0, 0, Math.PI / 2]));
  spin.add(blob(metal(), [0, 0, 0], [r * 0.4, r * 0.22, r * 0.22]));
  for (let i = 0; i < 5; i++) {   // little bolts so you can see the wheel turn
    const a = (i / 5) * Math.PI * 2;
    spin.add(blob(vinyl(INK), [0, Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42], [r * 0.34, r * 0.06, r * 0.06], [0, 0, 0], 8));
  }
  return { pivot, spin, front, radius: r };
}

/** Builds the parts every kart shares. The kart file adds the body on top. */
export function kartFrame(f: KartFrame): KartRig {
  const root = new THREE.Group();
  const track = f.track ?? 0.8;
  const [fz, fr] = f.front ?? [0.95, 0.32];
  const [rz, rr] = f.rear ?? [-0.85, 0.38];
  const wheels: Wheel[] = [];
  for (const [z, r, front] of [[fz, fr, true], [rz, rr, false]] as const) {
    for (const side of [1, -1]) {
      const w = wheel(r, f.rim ?? f.paint.trim, front);
      w.pivot.position.set(side * track, r, z);
      root.add(w.pivot); wheels.push(w);
    }
  }
  // axles and under-tray
  root.add(rbox(matte(0x3a3448), [0, 0.22, 0.05], [1.0, 0.12, 2.0], 0.05));
  for (const [z, r] of [[fz, fr], [rz, rr]]) root.add(cyl(metal(0x8d90a3), [0, r, z], 0.05, track * 2 - 0.2, [0, 0, Math.PI / 2], 8));

  // seat
  const [sx, sy, sz] = f.seat ?? [0, 0.48, -0.32];
  const seatMat = vinyl(f.paint.trim, 0.6);
  root.add(rbox(seatMat, [sx, sy - 0.04, sz], [0.6, 0.12, 0.52], 0.06));
  root.add(rbox(seatMat, [sx, sy + 0.24, sz - 0.29], [0.58, 0.5, 0.12], 0.06, [-0.22, 0, 0]));
  root.add(blob(vinyl(0xffffff, 0.5), [sx, sy + 0.4, sz - 0.33], [0.2, 0.09, 0.05], [-0.22, 0, 0]));   // head rest

  // steering column and wheel
  const [wx, wy, wz] = f.steer ?? [0, 0.92, 0.22];
  root.add(cyl(metal(0x8d90a3), [wx, wy - 0.22, wz + 0.16], 0.03, 0.5, [0.75, 0, 0], 8));
  const steering = group([wx, wy, wz]);
  steering.rotation.x = -0.65;
  const ring = new THREE.Group();
  ring.add(part(G.torus(0.17, 0.035), vinyl(INK, 0.4)));
  ring.add(blob(vinyl(f.paint.body, 0.3), [0, 0, 0], [0.06, 0.06, 0.03]));
  for (const a of [0, Math.PI * 0.75, Math.PI * 1.25]) ring.add(part(G.cyl(8), vinyl(INK), [Math.sin(a) * 0.085, Math.cos(a) * 0.085, 0], [0.015, 0.17, 0.015], [0, 0, -a]));
  steering.add(ring);
  root.add(steering);
  const grip = (x: number) => new THREE.Vector3(wx + x, wy - 0.02, wz - 0.03);

  return { root, wheels, steering: ring, seat: new THREE.Vector3(sx, sy + 0.02, sz), hands: [grip(0.16), grip(-0.16)], exhausts: [] };
}

/** A chrome exhaust pipe pointing backwards. Records where the boost flame comes out. */
export function exhaust(rig: KartRig, x: number, y: number, z: number, r = 0.09, len = 0.4, tilt = 0.15) {
  const g = group([x, y, z]); g.rotation.x = -tilt;
  g.add(cyl(metal(), [0, 0, -len / 2], r, len, [Math.PI / 2, 0, 0], 14));
  g.add(cyl(metal(0xb7bccb), [0, 0, -len], r * 1.25, 0.08, [Math.PI / 2, 0, 0], 14));
  g.add(cyl(vinyl(0x1b1726), [0, 0, -len - 0.03], r * 0.85, 0.04, [Math.PI / 2, 0, 0], 14));
  rig.root.add(g);
  rig.exhausts.push(new THREE.Vector3(x, y + Math.sin(tilt) * len, z - len - 0.05));
}

export function shadows(o: THREE.Object3D) {
  o.traverse((m) => { if (m instanceof THREE.Mesh && !(m.material as THREE.Material).transparent) { m.castShadow = true; m.receiveShadow = true; } });
}
