import * as THREE from 'three';
import type { CharacterDef } from '@shared/characters';
import { kartById, signatureKart, type KartDef } from '@shared/karts';
import { buildCharacter, type CharacterRig } from '../models/characters';
import { buildKart, type KartRig } from '../models/karts';
import { shadows } from '../models/karts/base';
import { CharacterAnimator, type Mood } from '../models/animator';
import { materialState, mergeStill, movedSince, snapshot } from '../models/optimize';

const SMOKE = 14;

/**
 * A racer as drawn on screen: the character's own model sitting in a kart model.
 * Visual only: physics never reads this.
 */
export class KartModel {
  readonly root = new THREE.Group();     // positioned at the kart's physics body
  readonly body = new THREE.Group();     // tilts and slides during drifts
  readonly kartDef: KartDef;
  readonly driver: CharacterRig;
  readonly kart: KartRig;
  private anim: CharacterAnimator;
  private sparks: THREE.Mesh[] = [];
  private flames: THREE.Mesh[] = [];
  private smoke: { m: THREE.Mesh; life: number; vx: number; vz: number }[] = [];
  private smokeTimer = 0;
  private steerSmooth = 0;
  private lastSpeed = 0;
  private pitch = 0;
  private bodyYaw = 0;
  private spinLeft = 0; private spinTotal = 1;
  private hopLeft = 0;
  private shrinkLeft = 0; private size = 1;
  /** Mini Thunder: shrink to about half size for a while (visual only). */
  shrink(seconds: number) { this.shrinkLeft = seconds; this.anim.react(); }
  /** A rival hit a Bounce Trap: hop the model up and down (their own game moves the real kart). */
  hop() { this.hopLeft = 0.8; this.anim.react(); }
  /** Hit by a banana peel: the kart spins round twice (visual only). */
  spin(seconds = 1.1) { this.spinLeft = this.spinTotal = seconds; this.anim.react(); }

  constructor(readonly ch: CharacterDef, kart: KartDef | string = signatureKart(ch.id), readonly paint = 0) {
    this.kartDef = typeof kart === 'string' ? kartById(kart) : kart;
    const p = this.kartDef.paints[paint] ?? this.kartDef.paints[0];
    this.root.add(this.body);
    this.kart = buildKart(this.kartDef.id, p);
    this.body.add(this.kart.root);

    this.driver = buildCharacter(ch.id);
    this.driver.root.position.copy(this.kart.seat);
    this.body.add(this.driver.root);
    this.kart.root.updateMatrixWorld(true);
    const grips = this.kart.hands.map((v) => { const o = new THREE.Object3D(); this.kart.steering.add(o); o.position.copy(this.kart.steering.worldToLocal(this.kart.root.localToWorld(v.clone()))); return o; }) as [THREE.Object3D, THREE.Object3D];
    this.anim = new CharacterAnimator(this.driver, grips);

    // drift sparks at the rear wheels
    const rear = this.kart.wheels.filter((w) => !w.front);
    for (const w of rear) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0x6ccff6, transparent: true, opacity: 0.95 }));
      s.position.set(w.pivot.position.x, 0.12, w.pivot.position.z - w.radius * 0.8);
      s.visible = false; this.body.add(s); this.sparks.push(s);
    }
    // boost flames from each exhaust
    const flameGeo = new THREE.ConeGeometry(0.16, 0.9, 12); flameGeo.translate(0, -0.45, 0); flameGeo.rotateX(Math.PI / 2);
    for (const e of this.kart.exhausts) {
      const f = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: 0xffa62b, transparent: true, opacity: 0.9 }));
      f.position.copy(e); f.visible = false; this.body.add(f); this.flames.push(f);
      const core = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
      core.scale.set(0.5, 0.5, 0.6); f.add(core);
    }
    // drift smoke puffs (pooled), drawn in world space so they stay behind
    const puffGeo = new THREE.IcosahedronGeometry(0.25, 1);
    for (let i = 0; i < SMOKE; i++) {
      const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xf7f2ff, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; this.smoke.push({ m, life: 0, vx: 0, vz: 0 });
    }
    shadows(this.body);
    if (KartModel.combineParts) this.combineStillParts();
  }

  /** Off only for testing that combined models look the same. */
  static combineParts = true;

  /**
   * Plays the animations briefly off-screen to find the parts that move, then combines
   * all the other pieces so the racer draws in far fewer calls. Looks identical.
   */
  private combineStillParts() {
    const snap = snapshot(this.body), mats = materialState(this.body);
    const mood = this.anim.mood;
    let t = 0;
    for (const m of ['race', 'win', 'lose'] as Mood[]) {
      this.anim.setMood(m); this.anim.react();
      for (let i = 0; i < 150; i++) {
        t += 1 / 30;
        const k = i % 50;
        this.animate(1 / 30, k < 25 ? 18 : 0.5, Math.sin(t * 2), k < 12 ? 1 : k < 25 ? -1 : 0, k % 3, k > 30 && k < 40, t);
      }
    }
    const keep = movedSince(snap), liveMats = mats.changed();
    const r = this.driver;
    for (const o of [r.head, r.torso, r.armL, r.armR, r.tail, ...r.eyes, ...r.ears, this.kart.steering, ...this.sparks, ...this.flames]) if (o) keep.add(o);
    for (const w of this.kart.wheels) { keep.add(w.pivot); keep.add(w.spin); }
    this.anim.setMood(mood);
    this.steerSmooth = 0; this.lastSpeed = 0; this.pitch = 0; this.bodyYaw = 0;
    for (const s of this.smoke) { s.life = 0; s.m.visible = false; }
    mergeStill(this.body, keep, liveMats);
    // tiny pieces (eyes, buttons, bolts) don't cast a visible shadow: skip them in the shadow pass
    this.root.updateMatrixWorld(true);
    this.body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.castShadow) return;
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      if (m.geometry.boundingSphere!.radius * m.matrixWorld.getMaxScaleOnAxis() < 0.07) m.castShadow = false;
    });
  }

  /** Smoke puffs live in the scene, not on the kart. Call after adding root to a scene. */
  private smokeParent(): THREE.Object3D | null { return this.root.parent; }

  setMood(m: Mood) { this.anim.setMood(m); }
  get mood() { return this.anim.mood; }
  /** Little cheer for mini turbos and boost pads. */
  react() { this.anim.react(); }

  /** Visual-only animation. Nothing here affects physics. */
  animate(dt: number, speed: number, steer: number, driftDir: number, driftLevel: number, boosting: boolean, time: number) {
    this.steerSmooth += (steer - this.steerSmooth) * Math.min(1, dt * 10);
    const st = this.steerSmooth;
    for (const w of this.kart.wheels) {
      w.spin.rotation.x += (speed / w.radius) * dt;
      if (w.front) w.pivot.rotation.y = st * 0.4 + driftDir * -0.25;
    }
    this.kart.steering.rotation.z = -st * 1.4 - driftDir * 0.5;

    // body: drift slide, roll into turns, pitch on acceleration, rumble
    const accel = (speed - this.lastSpeed) / Math.max(dt, 1e-3); this.lastSpeed = speed;
    this.pitch += (THREE.MathUtils.clamp(-accel * 0.004, -0.06, 0.06) - this.pitch) * Math.min(1, dt * 4);
    const targetYaw = driftDir * 0.38, targetRoll = -driftDir * 0.09 - st * 0.05 * Math.min(1, Math.abs(speed) / 20);
    this.bodyYaw += (targetYaw - this.bodyYaw) * Math.min(1, dt * 8);
    // spin-out: two quick turns that slow down, then straighten up
    let spin = 0;
    if (this.spinLeft > 0) { this.spinLeft = Math.max(0, this.spinLeft - dt); const k = 1 - this.spinLeft / this.spinTotal; spin = (1 - (1 - k) * (1 - k)) * Math.PI * 4; }
    this.body.rotation.y = this.bodyYaw + spin;
    this.body.rotation.z += (targetRoll - this.body.rotation.z) * Math.min(1, dt * 8);
    this.body.rotation.x = this.pitch;
    this.body.position.y = Math.abs(speed) > 1 ? Math.sin(time * 30) * 0.015 * Math.min(1, Math.abs(speed) / 10) : 0;
    if (this.shrinkLeft > 0) this.shrinkLeft = Math.max(0, this.shrinkLeft - dt);
    const wantSize = this.shrinkLeft > 0 ? 0.55 : 1;
    if (Math.abs(this.size - wantSize) > 0.001) { this.size += (wantSize - this.size) * Math.min(1, dt * 8); this.root.scale.setScalar(this.size); }
    if (this.hopLeft > 0) { this.hopLeft = Math.max(0, this.hopLeft - dt); const k = 1 - this.hopLeft / 0.8; this.body.position.y += Math.sin(k * Math.PI) * 2.2; }

    this.anim.update(dt, time, { speed, steer: st, drift: driftDir, boosting });
    this.kart.idle?.(time, dt, speed);

    const sparkColor = driftLevel >= 2 ? 0xff7b29 : 0x6ccff6;
    for (const s of this.sparks) {
      s.visible = driftDir !== 0 && driftLevel >= 1;
      (s.material as THREE.MeshBasicMaterial).color.setHex(sparkColor);
      s.scale.setScalar(0.6 + Math.random() * 0.8);
      s.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    }
    for (const f of this.flames) {
      f.visible = boosting;
      if (boosting) f.scale.set(1, 1, 0.7 + Math.random() * 0.6);
    }
    this.updateSmoke(dt, driftDir !== 0 && Math.abs(speed) > 6);
  }

  private updateSmoke(dt: number, emitting: boolean) {
    const parent = this.smokeParent();
    if (!parent) return;
    this.smokeTimer -= dt;
    if (emitting && this.smokeTimer <= 0) {
      this.smokeTimer = 0.05;
      const p = this.smoke.find((s) => s.life <= 0);
      const w = this.kart.wheels.filter((x) => !x.front)[Math.random() < 0.5 ? 0 : 1];
      if (p && w) {
        if (p.m.parent !== parent) parent.add(p.m);
        w.pivot.getWorldPosition(p.m.position); p.m.position.y = 0.25;
        p.life = 0.7; p.vx = (Math.random() - 0.5) * 1.5; p.vz = (Math.random() - 0.5) * 1.5;
        p.m.visible = true;
      }
    }
    for (const s of this.smoke) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.m.position.x += s.vx * dt; s.m.position.z += s.vz * dt; s.m.position.y += dt * 0.8;
      s.m.scale.setScalar(0.6 + (0.7 - s.life) * 2);
      (s.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.life) * 0.9;
      if (s.life <= 0) s.m.visible = false;
    }
  }

  /** Remove leftover smoke from the scene (when this racer is removed). */
  dispose() { for (const s of this.smoke) s.m.removeFromParent(); }
}
