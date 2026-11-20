import * as THREE from 'three';
import type { CharacterRig } from './characters/rig';

export type Mood = 'race' | 'win' | 'lose';
export interface DriveState { speed: number; steer: number; drift: number; boosting: boolean }

const DOWN = new THREE.Vector3(0, -1, 0);
const tmp = new THREE.Vector3(), dir = new THREE.Vector3();

/**
 * Brings a character to life: breathing, blinking, looking around, steering with
 * both hands, leaning into drifts, cheering and sulking. Purely visual.
 */
export class CharacterAnimator {
  mood: Mood = 'race';
  private moodTime = 0;
  private blinkIn = 1 + Math.random() * 3;
  private blink = 0;
  private cheer = 0;
  private lookAt = 0; private lookTimer = 0;
  private baseY: number;

  /** In a kart, `grips` are the two hand points on the steering wheel. */
  constructor(readonly rig: CharacterRig, private grips: [THREE.Object3D, THREE.Object3D] | null = null) {
    this.baseY = rig.root.position.y;
  }

  setMood(m: Mood) { if (m !== this.mood) { this.mood = m; this.moodTime = 0; } }
  /** A quick happy reaction (boosts, mini turbos). */
  react() { this.cheer = 0.7; }

  update(dt: number, t: number, s: DriveState) {
    const r = this.rig;
    this.moodTime += dt;
    this.cheer = Math.max(0, this.cheer - dt);
    const fast = Math.min(1, Math.abs(s.speed) / 25);

    // blink every few seconds
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) { this.blink = 0.14; this.blinkIn = 2 + Math.random() * 3.5; }
    this.blink = Math.max(0, this.blink - dt);
    const lidOpen = this.mood === 'lose' ? 0.55 : 1;
    for (const e of r.eyes) e.scale.y = this.blink > 0 ? 0.12 : lidOpen;

    // look around when standing still
    this.lookTimer -= dt;
    if (this.lookTimer <= 0) { this.lookAt = (Math.random() - 0.5) * 1.1; this.lookTimer = 1.5 + Math.random() * 2; }
    const idle = 1 - fast;

    // breathing
    const breathe = Math.sin(t * 2.4) * 0.02;
    r.torso.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5);
    if (r.tail) { r.tail.rotation.y = Math.sin(t * 3) * 0.35; r.tail.rotation.x = Math.sin(t * 1.7) * 0.1; }
    r.idle?.(t, dt, this.cheer > 0 || this.mood === 'win' ? 1 : 0);

    const head = r.head;
    if (this.mood === 'win') {
      // hop out of the seat, turn round to the camera and cheer with both arms
      const hop = Math.abs(Math.sin(this.moodTime * 5)) * 0.35;
      r.root.position.y = this.baseY + hop;
      r.root.rotation.y += (Math.PI - r.root.rotation.y) * Math.min(1, dt * 3);
      head.rotation.set(-0.15, 0, Math.sin(this.moodTime * 5) * 0.15);
      this.armsUp(Math.sin(this.moodTime * 10) * 0.3);
      for (const e of r.ears) e.rotation.z = Math.sin(this.moodTime * 12) * 0.2;
      return;
    }
    r.root.position.y = this.baseY;
    r.root.rotation.y += (0 - r.root.rotation.y) * Math.min(1, dt * 5);
    if (this.mood === 'lose') {
      head.rotation.x += (0.45 - head.rotation.x) * Math.min(1, dt * 3);
      head.rotation.y = Math.sin(this.moodTime * 0.8) * 0.15;
      head.rotation.z = 0.12;
      r.torso.rotation.x = 0.2;
      this.armsHang(0.2);
      for (const e of r.ears) e.rotation.z = 0.25;
      return;
    }

    // racing
    r.torso.rotation.x = s.boosting ? -0.15 : 0;
    r.torso.rotation.z = -s.drift * 0.18 - s.steer * 0.08 * fast;
    head.rotation.x = s.boosting ? -0.25 : 0;
    head.rotation.y = this.lookAt * idle + s.steer * 0.25 * fast;
    head.rotation.z = -s.steer * 0.12 - s.drift * 0.15;
    for (const e of r.ears) e.rotation.z = s.boosting ? 0.35 : 0;
    if (this.grips) this.armsToWheel(this.cheer > 0);
    else if (this.cheer > 0) this.armsUp(0);
    else this.armsHang(Math.sin(t * 2) * 0.08);
  }

  private armsToWheel(waveLeft: boolean) {
    const r = this.rig;
    r.root.updateMatrixWorld(true);
    for (const [i, arm] of [r.armL, r.armR].entries()) {
      if (i === 0 && waveLeft) { arm.rotation.set(0, 0, 2.6 + Math.sin(this.cheer * 30) * 0.3); continue; }
      this.grips![i].getWorldPosition(tmp);
      r.torso.worldToLocal(tmp);
      dir.copy(tmp).sub(arm.position).normalize();
      arm.quaternion.setFromUnitVectors(DOWN, dir);
    }
  }
  private armsUp(wave: number) {
    this.rig.armL.rotation.set(0, 0, 2.7 + wave);
    this.rig.armR.rotation.set(0, 0, -2.7 - wave);
  }
  private armsHang(sway: number) {
    this.rig.armL.rotation.set(sway, 0, 0.25);
    this.rig.armR.rotation.set(-sway, 0, -0.25);
  }
}
