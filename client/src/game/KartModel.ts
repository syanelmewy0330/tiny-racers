import * as THREE from 'three';
import type { CharacterDef } from '@shared/characters';

/**
 * Placeholder kart + driver built from simple shapes, coloured per character.
 * Swap this class for a loaded glTF model later without touching the physics.
 */
export class KartModel {
  readonly root = new THREE.Group();     // positioned at the kart's physics body
  readonly body = new THREE.Group();     // tilts and slides during drifts
  private wheels: THREE.Mesh[] = [];
  private sparks: THREE.Mesh[] = [];
  private flame: THREE.Mesh;

  constructor(ch: CharacterDef) {
    const mat = (color: number, rough = 0.6) => new THREE.MeshStandardMaterial({ color, roughness: rough });
    const shadowy = (m: THREE.Mesh) => { m.castShadow = true; m.receiveShadow = true; return m; };
    this.root.add(this.body);

    // chassis
    const chassis = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 2.3), mat(ch.color)));
    chassis.position.y = 0.45; this.body.add(chassis);
    const nose = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.7), mat(ch.color)));
    nose.position.set(0, 0.4, 1.35); this.body.add(nose);
    const bumper = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 0.25), mat(ch.accent)));
    bumper.position.set(0, 0.32, 1.72); this.body.add(bumper);
    const spoiler = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.45), mat(ch.accent)));
    spoiler.position.set(0, 1.05, -1.05); this.body.add(spoiler);
    for (const x of [-0.6, 0.6]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), mat(ch.accent)); post.position.set(x, 0.82, -1.05); this.body.add(post); }
    const seat = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.25), mat(0x2a1e3f)));
    seat.position.set(0, 0.85, -0.45); this.body.add(seat);
    const wheelSteer = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 16), mat(0x2a1e3f));
    wheelSteer.position.set(0, 0.95, 0.45); wheelSteer.rotation.x = -0.9; this.body.add(wheelSteer);

    // driver (placeholder animal: round head, ears, snout)
    const driver = new THREE.Group(); driver.position.set(0, 1.05, -0.2); this.body.add(driver);
    const torso = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mat(ch.fur)));
    torso.scale.set(1, 0.9, 0.9); driver.add(torso);
    const head = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.48, 20, 16), mat(ch.fur)));
    head.position.set(0, 0.65, 0.05); driver.add(head);
    for (const x of [-0.28, 0.28]) {
      const ear = shadowy(new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 10), mat(ch.fur)));
      ear.position.set(x, 1.08, 0); ear.rotation.z = -x * 0.8; driver.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat(0x1a1424, 0.3));
      eye.position.set(x * 0.6, 0.72, 0.47); driver.add(eye);
    }
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat(0xfff3e6));
    snout.position.set(0, 0.56, 0.47); snout.scale.set(1.2, 0.8, 0.8); driver.add(snout);
    // a little hat band in the accent colour so each racer reads differently
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 8, 20), mat(ch.color));
    band.position.set(0, 0.92, 0.02); band.rotation.x = Math.PI / 2; driver.add(band);

    // wheels
    const wgeo = new THREE.CylinderGeometry(0.38, 0.38, 0.36, 16); wgeo.rotateZ(Math.PI / 2);
    for (const [x, z] of [[-0.9, 0.85], [0.9, 0.85], [-0.9, -0.85], [0.9, -0.85]] as const) {
      const w = shadowy(new THREE.Mesh(wgeo, mat(0x2a1e3f, 0.9)));
      w.position.set(x, 0.38, z); this.body.add(w); this.wheels.push(w);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.38, 10).rotateZ(Math.PI / 2), mat(0xffffff));
      w.add(hub);
    }

    // drift sparks behind the rear wheels, and a boost flame
    for (const x of [-0.9, 0.9]) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: 0.9 }));
      s.position.set(x, 0.2, -1.2); s.visible = false; this.body.add(s); this.sparks.push(s);
    }
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 12), new THREE.MeshBasicMaterial({ color: 0xffa62b, transparent: true, opacity: 0.85 }));
    this.flame.rotation.x = -Math.PI / 2; this.flame.position.set(0, 0.5, -1.8); this.flame.visible = false; this.body.add(this.flame);
  }

  /** Visual-only animation. Nothing here affects physics. */
  animate(dt: number, speed: number, steer: number, driftDir: number, driftLevel: number, boosting: boolean, time: number) {
    for (const w of this.wheels) w.rotation.x += (speed / 0.38) * dt;
    this.wheels[0].rotation.y = this.wheels[1].rotation.y = steer * 0.35;
    const targetYaw = driftDir * 0.38, targetRoll = -driftDir * 0.08 - steer * 0.04 * Math.min(1, Math.abs(speed) / 20);
    this.body.rotation.y += (targetYaw - this.body.rotation.y) * Math.min(1, dt * 8);
    this.body.rotation.z += (targetRoll - this.body.rotation.z) * Math.min(1, dt * 8);
    this.body.position.y = Math.abs(speed) > 1 ? Math.sin(time * 30) * 0.015 : 0;
    const sparkColor = driftLevel >= 2 ? 0xff7b29 : 0x4cc9f0;
    for (const s of this.sparks) {
      s.visible = driftDir !== 0 && driftLevel >= 1;
      (s.material as THREE.MeshBasicMaterial).color.setHex(sparkColor);
      s.scale.setScalar(0.7 + Math.random() * 0.6);
    }
    this.flame.visible = boosting;
    if (boosting) this.flame.scale.set(1, 0.8 + Math.random() * 0.5, 1);
  }
}
