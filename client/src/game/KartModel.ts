import * as THREE from 'three';
import type { CharacterDef } from '@shared/characters';

type Mat = (color: number, rough?: number) => THREE.MeshStandardMaterial;
const mat: Mat = (color, rough = 0.6) => new THREE.MeshStandardMaterial({ color, roughness: rough });
const shadowy = <T extends THREE.Object3D>(o: T): T => { o.traverse((m) => { if (m instanceof THREE.Mesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };

/**
 * A character's kart and driver, built from simple shapes.
 * Each racer has their own driver model and kart style. Visual only: physics never reads this.
 */
export class KartModel {
  readonly root = new THREE.Group();     // positioned at the kart's physics body
  readonly body = new THREE.Group();     // tilts and slides during drifts
  private driver = new THREE.Group();
  private head = new THREE.Group();
  private wheels: THREE.Mesh[] = [];
  private sparks: THREE.Mesh[] = [];
  private flame: THREE.Mesh;
  private mood: 'race' | 'win' | 'lose' = 'race';
  private moodTime = 0;

  constructor(readonly ch: CharacterDef) {
    this.root.add(this.body);
    this.buildKart();
    this.driver.position.set(0, 1.05, -0.2);
    this.body.add(this.driver);
    this.buildDriver();

    for (const x of [-0.9, 0.9]) {
      const s = mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: 0.9 }), x, 0.2, -1.2);
      s.visible = false; this.body.add(s); this.sparks.push(s);
    }
    this.flame = mesh(new THREE.ConeGeometry(0.35, 1.2, 12), new THREE.MeshBasicMaterial({ color: 0xffa62b, transparent: true, opacity: 0.85 }), 0, 0.5, -1.8);
    this.flame.rotation.x = -Math.PI / 2; this.flame.visible = false; this.body.add(this.flame);
    shadowy(this.body);
  }

  // ---------------- karts ----------------
  private buildKart() {
    const { color, accent } = this.ch, b = this.body, id = this.ch.id;
    const wide = id === 'taco' ? 1.15 : 1;            // Taco's kart is a chunky snack truck
    const chassis = mesh(new THREE.BoxGeometry(1.5 * wide, 0.45, 2.3), mat(color), 0, 0.45, 0); b.add(chassis);
    const nose = mesh(new THREE.BoxGeometry(1.2 * wide, 0.3, 0.7), mat(color), 0, 0.4, 1.35); b.add(nose);
    b.add(mesh(new THREE.BoxGeometry(1.7 * wide, 0.22, 0.25), mat(accent), 0, 0.32, 1.72));
    b.add(mesh(new THREE.BoxGeometry(0.9, 0.5, 0.25), mat(0x2a1e3f), 0, 0.85, -0.45));      // seat
    const wheelSteer = mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 16), mat(0x2a1e3f), 0, 0.95, 0.45);
    wheelSteer.rotation.x = -0.9; b.add(wheelSteer);

    if (id === 'bubbles') {
      // Rookie racer: racing stripe, number 1 roundel and a tall spoiler
      b.add(mesh(new THREE.BoxGeometry(0.3, 0.02, 2.95), mat(0x2a1e3f), 0, 0.69, 0.25));
      const disc = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 20), mat(0xffffff), 0, 0.57, 1.36); b.add(disc);
      this.spoiler(1.7, 1.15, accent);
    } else if (id === 'taco') {
      // Snack truck: a giant taco on the bonnet and a boombox on the back
      const shell = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 20, 1, false, 0, Math.PI), mat(0xf2c14e), 0, 0.82, 1.15);
      shell.rotation.z = Math.PI / 2; shell.rotation.y = Math.PI / 2; b.add(shell);
      b.add(mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(0x52c77a), 0.1, 0.92, 1.15));
      b.add(mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(0xe2534a), -0.12, 0.94, 1.15));
      const box = mesh(new THREE.BoxGeometry(1.2, 0.5, 0.4), mat(accent), 0, 0.9, -1.15); b.add(box);
      for (const x of [-0.32, 0.32]) b.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16).rotateX(Math.PI / 2), mat(0x999999), x, 0.9, -1.36));
    } else if (id === 'nimbus') {
      // Thinker's kart: smooth cloud bumpers and a tail fin with a checklist
      for (const [x, z] of [[-0.6, 1.3], [0, 1.45], [0.6, 1.3], [-0.75, -1.1], [0.75, -1.1]] as const) b.add(mesh(new THREE.SphereGeometry(0.32, 12, 10), mat(0xffffff, 0.9), x, 0.5, z));
      const fin = mesh(new THREE.BoxGeometry(0.08, 0.7, 0.8), mat(color), 0, 1.0, -1.05); b.add(fin);
      const pad = mesh(new THREE.BoxGeometry(0.1, 0.45, 0.5), mat(0x2a1e3f), 0.05, 1.05, -1.05); b.add(pad);
    } else {
      // Chaos machine: hazard stripes, twin exhausts and a spare bomb
      for (let i = 0; i < 4; i++) b.add(mesh(new THREE.BoxGeometry(0.25, 0.02, 0.5), mat(i % 2 ? 0x2a1e3f : 0xffd166), -0.45 + i * 0.3, 0.69, 0.6));
      for (const x of [-0.45, 0.45]) {
        const pipe = mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.6, 12), mat(0x888899, 0.3), x, 0.7, -1.3); pipe.rotation.x = Math.PI / 2.4; b.add(pipe);
      }
      b.add(mesh(new THREE.SphereGeometry(0.3, 14, 10), mat(0x2a2438, 0.4), 0, 0.95, -1.15));
      const fuse = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 6), mat(0xffd166), 0.1, 1.27, -1.15); fuse.rotation.z = -0.4; b.add(fuse);
    }

    const wgeo = new THREE.CylinderGeometry(0.38, 0.38, 0.36, 16).rotateZ(Math.PI / 2);
    const hubColor = id === 'peanut' ? 0xe0773a : id === 'nimbus' ? 0xa58cf0 : 0xffffff;
    for (const [x, z] of [[-0.9, 0.85], [0.9, 0.85], [-0.9, -0.85], [0.9, -0.85]] as const) {
      const w = mesh(wgeo, mat(0x2a1e3f, 0.9), x * wide, 0.38, z); b.add(w); this.wheels.push(w);
      w.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.38, 10).rotateZ(Math.PI / 2), mat(hubColor)));
    }
  }

  private spoiler(width: number, y: number, color: number) {
    this.body.add(mesh(new THREE.BoxGeometry(width, 0.12, 0.45), mat(color), 0, y, -1.05));
    for (const x of [-0.6, 0.6]) this.body.add(mesh(new THREE.BoxGeometry(0.1, y - 0.65, 0.1), mat(color), x, (y + 0.65) / 2, -1.05));
  }

  // ---------------- drivers ----------------
  private buildDriver() {
    const d = this.driver, h = this.head, id = this.ch.id, fur = this.ch.fur;
    h.position.set(0, 0.65, 0.05); d.add(h);
    const furMat = mat(fur, 0.8);
    const torsoColor = id === 'bubbles' ? 0xf2b632 : id === 'taco' ? 0x55506a : id === 'peanut' ? 0x2f2b3d : fur;
    const torso = mesh(new THREE.SphereGeometry(0.42, 16, 12), mat(torsoColor, 0.8)); torso.scale.set(1, 0.9, 0.9); d.add(torso);
    const eye = (x: number, y: number, z: number, r = 0.065) => h.add(mesh(new THREE.SphereGeometry(r, 10, 8), mat(0x1a1424, 0.3), x, y, z));

    if (id === 'bubbles') {
      // gray-and-white cat with yellow goggles pushed up on her head
      h.add(mesh(new THREE.SphereGeometry(0.48, 20, 16), furMat));
      h.add(mesh(new THREE.SphereGeometry(0.3, 14, 10), mat(0xffffff, 0.8), 0, -0.12, 0.28));
      for (const x of [-0.28, 0.28]) {
        const ear = mesh(new THREE.ConeGeometry(0.16, 0.34, 4), furMat, x, 0.42, -0.02); ear.rotation.z = -x * 0.7; h.add(ear);
        const inner = mesh(new THREE.ConeGeometry(0.08, 0.18, 4), mat(0xffa8c0), x * 0.95, 0.41, 0.05); inner.rotation.z = -x * 0.7; h.add(inner);
        eye(x * 0.55, 0.04, 0.44);
        const goggle = mesh(new THREE.TorusGeometry(0.13, 0.05, 8, 16), mat(0xf2b632, 0.3), x * 0.55, 0.3, 0.33); goggle.rotation.x = -0.6; h.add(goggle);
        h.add(mesh(new THREE.CircleGeometry(0.1, 16), mat(0x3a3550, 0.1), x * 0.55, 0.3, 0.36).rotateX(-0.6));
      }
      const strap = mesh(new THREE.TorusGeometry(0.47, 0.035, 6, 24), mat(0x2a1e3f), 0, 0.26, 0); strap.rotation.x = Math.PI / 2 + 0.25; h.add(strap);
      h.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0xff8fab), 0, -0.05, 0.56));
      d.add(mesh(new THREE.SphereGeometry(0.16, 10, 8), furMat, -0.42, 0.55, 0.15));   // paw waving up
    } else if (id === 'taco') {
      // sleepy pug with a backwards red cap and headphones round his neck
      h.add(mesh(new THREE.SphereGeometry(0.5, 20, 16), furMat));
      const muzzle = mesh(new THREE.SphereGeometry(0.26, 14, 10), mat(0x3b2f2f, 0.9), 0, -0.1, 0.38); muzzle.scale.set(1.2, 0.85, 0.7); h.add(muzzle);
      for (const x of [-0.36, 0.36]) {
        const ear = mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(0x3b2f2f, 0.9), x, 0.25, 0.02); ear.scale.set(0.6, 1, 0.5); h.add(ear);
        const lid = mesh(new THREE.SphereGeometry(0.09, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), furMat, x * 0.5, 0.1, 0.42); lid.rotation.x = 0.3; h.add(lid);
        eye(x * 0.5, 0.08, 0.44, 0.07);
      }
      const tongue = mesh(new THREE.SphereGeometry(0.08, 10, 8), mat(0xff7a8a), 0.04, -0.24, 0.52); tongue.scale.set(1, 1.4, 0.5); h.add(tongue);
      const cap = mesh(new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), mat(0xe2534a), 0, 0.12, 0); h.add(cap);
      const brim = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 20, 1, false, 0, Math.PI), mat(0xc93c35), 0, 0.2, -0.45); brim.rotation.y = Math.PI; h.add(brim);
      const phones = mesh(new THREE.TorusGeometry(0.36, 0.06, 8, 20, Math.PI), mat(0x888899, 0.3), 0, 0.38, 0); phones.rotation.x = Math.PI / 2; phones.rotation.z = Math.PI; d.add(phones);
      for (const x of [-0.36, 0.36]) d.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 14).rotateZ(Math.PI / 2), mat(0x555566, 0.3), x, 0.38, 0));
    } else if (id === 'nimbus') {
      // fluffy white sheep with big round glasses and a pencil behind the ear
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        h.add(mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(0xffffff, 1), Math.cos(a) * 0.36, 0.22 + Math.sin(i * 1.7) * 0.06, Math.sin(a) * 0.3 - 0.05));
      }
      h.add(mesh(new THREE.SphereGeometry(0.4, 16, 12), mat(0xffe7d6, 0.8), 0, -0.02, 0.1));
      for (const x of [-0.4, 0.4]) {
        const ear = mesh(new THREE.SphereGeometry(0.15, 10, 8), mat(0xffd2c2), x * 1.1, 0.05, 0); ear.scale.set(1.6, 0.6, 0.8); h.add(ear);
        eye(x * 0.42, 0.04, 0.47, 0.055);
        const ring = mesh(new THREE.TorusGeometry(0.15, 0.025, 8, 20), mat(0x1a1424, 0.2), x * 0.42, 0.04, 0.5); h.add(ring);
      }
      h.add(mesh(new THREE.BoxGeometry(0.12, 0.025, 0.025), mat(0x1a1424), 0, 0.05, 0.5));
      const pencil = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), mat(0xffd166), 0.42, 0.35, 0); pencil.rotation.z = 0.9; h.add(pencil);
      for (let i = 0; i < 6; i++) d.add(mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(0xffffff, 1), Math.cos(i) * 0.3, Math.sin(i * 2) * 0.1, Math.sin(i) * 0.25));
    } else {
      // mischievous red panda with white face marks and a striped tail
      h.add(mesh(new THREE.SphereGeometry(0.48, 20, 16), furMat));
      h.add(mesh(new THREE.SphereGeometry(0.24, 14, 10), mat(0xfff3e6), 0, -0.12, 0.32));
      h.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0x2a1e3f), 0, -0.05, 0.55));
      for (const x of [-0.3, 0.3]) {
        const ear = mesh(new THREE.ConeGeometry(0.18, 0.3, 12), furMat, x, 0.42, 0); ear.rotation.z = -x; h.add(ear);
        h.add(mesh(new THREE.ConeGeometry(0.1, 0.16, 12), mat(0xfff3e6), x * 1.02, 0.42, 0.06).rotateZ(-x));
        const brow = mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(0xfff3e6), x * 0.55, 0.18, 0.4); brow.scale.set(1.3, 0.6, 0.5); h.add(brow);
        eye(x * 0.55, 0.04, 0.45);
      }
      const tail = new THREE.Group(); tail.position.set(0, -0.1, -0.5); tail.rotation.x = -0.9; d.add(tail);
      for (let i = 0; i < 6; i++) tail.add(mesh(new THREE.SphereGeometry(0.2 - i * 0.012, 12, 10), mat(i % 2 ? 0x7a3a1c : fur, 0.8), 0, i * 0.2, 0));
    }
  }

  /** After a race: winners cheer, everyone else slumps. */
  setMood(m: 'race' | 'win' | 'lose') { this.mood = m; this.moodTime = 0; }

  /** Visual-only animation. Nothing here affects physics. */
  animate(dt: number, speed: number, steer: number, driftDir: number, driftLevel: number, boosting: boolean, time: number) {
    for (const w of this.wheels) w.rotation.x += (speed / 0.38) * dt;
    this.wheels[0].rotation.y = this.wheels[1].rotation.y = steer * 0.35;
    const targetYaw = driftDir * 0.38, targetRoll = -driftDir * 0.08 - steer * 0.04 * Math.min(1, Math.abs(speed) / 20);
    this.body.rotation.y += (targetYaw - this.body.rotation.y) * Math.min(1, dt * 8);
    this.body.rotation.z += (targetRoll - this.body.rotation.z) * Math.min(1, dt * 8);
    this.body.position.y = Math.abs(speed) > 1 ? Math.sin(time * 30) * 0.015 : 0;

    this.moodTime += dt;
    if (this.mood === 'win') {
      // hop out of the seat and spin
      this.driver.position.y = 1.05 + Math.abs(Math.sin(this.moodTime * 6)) * 0.6;
      this.driver.rotation.y = this.moodTime * 5;
      this.head.rotation.x = 0;
    } else if (this.mood === 'lose') {
      this.driver.position.y = 1.0; this.driver.rotation.y = 0;
      this.head.rotation.x = Math.min(0.6, this.moodTime * 1.5);     // head droops
      this.head.rotation.z = Math.sin(this.moodTime * 1.5) * 0.08;
    } else {
      this.driver.position.y = 1.05; this.driver.rotation.y = 0;
      this.head.rotation.x = 0; this.head.rotation.z = -steer * 0.15;   // lean into turns
    }

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
