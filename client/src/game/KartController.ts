import RAPIER from '@dimforge/rapier3d-compat';
import type { CharacterDef } from '@shared/characters';
import type { ControlInput, KartSnapshot } from '@shared/types';

/** Physics numbers derived from a character's 1..5 stats. */
function tuning(ch: CharacterDef) {
  const { speed, acceleration, handling } = ch.stats;
  return {
    maxSpeed: 24 + speed * 1.6,          // m/s on asphalt (about 100 km/h)
    accel: 10 + acceleration * 2.2,      // m/s² at low speed
    turnRate: 1.6 + handling * 0.14,     // rad/s at full lock
    brake: 32,
    reverseMax: 9,
    boostSpeed: 44,
  };
}

/**
 * Arcade kart driving on top of Rapier.
 * Our own model decides how fast and which way the kart wants to go; Rapier moves
 * the body and handles collisions with walls, which we then read back.
 */
export class KartController {
  readonly body: RAPIER.RigidBody;
  yaw = 0;
  /** Velocity on the ground plane (x, z). */
  vx = 0; vz = 0;
  boostTime = 0;
  offroad = false;
  driftDir: -1 | 0 | 1 = 0;
  driftCharge = 0;
  steerVisual = 0;
  /** Set by Game when a mini-turbo or pad fires, for the HUD toast. */
  onBoost?: (kind: 'pad' | 'mini' | 'super' | 'item') => void;
  /** Seconds left of a spin-out (hit by a banana peel): no control while it lasts. */
  spinTime = 0;
  /** Mini Thunder: seconds left being tiny (slower). */
  shrinkTime = 0;
  /** Magnet: seconds left of being pulled, and who towards (set each step by the game). */
  magnetTime = 0;
  magnetTarget: { x: number; z: number } | null = null;
  private t: ReturnType<typeof tuning>;
  setCharacter(ch: CharacterDef) { this.t = tuning(ch); }
  private driftHeld = false;

  constructor(world: RAPIER.World, ch: CharacterDef) {
    this.t = tuning(ch);
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1, 0).lockRotations().setCcdEnabled(true).setLinearDamping(0),
    );
    world.createCollider(RAPIER.ColliderDesc.ball(0.75).setFriction(0).setRestitution(0.1).setDensity(2), this.body);
  }

  get forwardSpeed() { return this.vx * Math.sin(this.yaw) + this.vz * Math.cos(this.yaw); }
  get boosting() { return this.boostTime > 0; }
  /** 0 = none, 1 = blue sparks, 2 = orange sparks (bigger boost on release). */
  get driftLevel() { return this.driftCharge > 1.6 ? 2 : this.driftCharge > 0.7 ? 1 : 0; }

  boost(seconds: number, kind: 'pad' | 'mini' | 'super' | 'item') {
    this.boostTime = Math.max(this.boostTime, seconds);
    const f = this.forwardSpeed, need = this.t.maxSpeed + 6;
    if (f < need) { this.vx += Math.sin(this.yaw) * (need - f); this.vz += Math.cos(this.yaw) * (need - f); }
    this.onBoost?.(kind);
  }

  /** Hit by a banana peel: lose control and most of your speed for a moment. */
  spinOut(seconds = 1.1) {
    this.spinTime = seconds; this.boostTime = 0; this.driftDir = 0; this.driftCharge = 0;
  }

  /** Struck by Mini Thunder: small and slower for a few seconds. */
  shrink(seconds: number) { this.shrinkTime = seconds; this.boostTime = 0; }
  /** Magnet: a strong pull forward, steering itself towards the racer ahead if there is one. */
  magnet(seconds: number) { this.magnetTime = seconds; }

  /** Hit a Bounce Trap: thrown into the air, most speed gone, a moment without control. */
  bounce() {
    this.spinTime = 0.7; this.boostTime = 0; this.driftDir = 0; this.driftCharge = 0;
    this.vx *= 0.35; this.vz *= 0.35;
    this.body.setLinvel({ x: this.vx, y: 9, z: this.vz }, true);
  }

  /** Runs once per physics step, before world.step(). */
  applyInput(input: ControlInput, dt: number, locked: boolean) {
    const t = this.t;
    const spinning = this.spinTime > 0;
    if (spinning) this.spinTime = Math.max(0, this.spinTime - dt);
    if (locked || spinning) input = { throttle: false, brake: false, steer: 0, drift: false };
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);   // forward
    const sx = Math.cos(this.yaw), sz = -Math.sin(this.yaw);  // sideways
    let fwd = this.vx * fx + this.vz * fz;
    let lat = this.vx * sx + this.vz * sz;

    // --- drifting: press Space while turning at speed ---
    if (input.drift && !this.driftHeld && input.steer !== 0 && fwd > 10) { this.driftDir = input.steer > 0 ? 1 : -1; this.driftCharge = 0; }
    if (this.driftDir !== 0 && (!input.drift || fwd < 6)) {
      if (fwd >= 6) { if (this.driftLevel === 2) this.boost(1.4, 'super'); else if (this.driftLevel === 1) this.boost(0.7, 'mini'); }
      this.driftDir = 0; this.driftCharge = 0;
    }
    this.driftHeld = input.drift;

    // --- engine and brakes ---
    this.boostTime = Math.max(0, this.boostTime - dt);
    this.shrinkTime = Math.max(0, this.shrinkTime - dt);
    this.magnetTime = Math.max(0, this.magnetTime - dt);
    const magnet = this.magnetTime > 0 && !spinning;
    let top = this.boosting ? t.boostSpeed : this.offroad ? t.maxSpeed * 0.55 : t.maxSpeed;
    if (magnet) top = Math.max(top, t.maxSpeed + 7);
    if (this.shrinkTime > 0) top *= 0.68;
    if (input.throttle) fwd += t.accel * Math.max(0.15, 1 - fwd / top) * dt * (this.boosting ? 2.5 : 1);
    if (input.brake) fwd -= (fwd > 0.5 ? t.brake : 10) * dt;
    if (!input.throttle && !input.brake) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 6 * dt);
    if (this.offroad) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 4 * dt);
    if (fwd > top) fwd = Math.max(top, fwd - 18 * dt);
    if (fwd < -t.reverseMax) fwd = -t.reverseMax;
    if (this.boosting && fwd < t.maxSpeed) fwd = Math.min(t.boostSpeed, fwd + 30 * dt);
    if (spinning) fwd *= Math.exp(-2.2 * dt);
    if (magnet) fwd = Math.min(top, fwd + 26 * dt);

    // --- steering ---
    const speedFactor = Math.min(1, Math.abs(fwd) / 7) * (1 - 0.25 * Math.min(1, Math.abs(fwd) / 40));
    let turn: number;
    if (this.driftDir !== 0) {
      // in a drift you always turn toward the drift side; steering tightens or widens it
      turn = this.driftDir * t.turnRate * (0.75 + 0.55 * input.steer * this.driftDir);
      this.driftCharge += dt * (input.steer * this.driftDir > 0 ? 1.2 : 0.7);
    } else {
      turn = input.steer * t.turnRate * Math.sign(fwd || 1);
    }
    this.yaw += turn * speedFactor * dt;
    if (magnet && this.magnetTarget) {
      // gently turn towards the racer ahead
      const p = this.body.translation();
      let d = Math.atan2(this.magnetTarget.x - p.x, this.magnetTarget.z - p.z) - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += Math.max(-1.4 * dt, Math.min(1.4 * dt, d));
    }
    this.steerVisual = input.steer;

    // --- grip: sideways sliding fades quickly, slower while drifting ---
    const grip = this.driftDir !== 0 ? 2.2 : 9;
    lat *= Math.exp(-grip * dt);
    if (this.driftDir !== 0) lat += -this.driftDir * fwd * 0.012; // slide outward a little

    const nfx = Math.sin(this.yaw), nfz = Math.cos(this.yaw), nsx = Math.cos(this.yaw), nsz = -Math.sin(this.yaw);
    this.vx = nfx * fwd + nsx * lat;
    this.vz = nfz * fwd + nsz * lat;
    const v = this.body.linvel();
    this.body.setLinvel({ x: this.vx, y: v.y, z: this.vz }, true);
  }

  /** Runs after world.step(): take the real velocity back, so walls actually stop the kart. */
  syncFromPhysics() {
    const v = this.body.linvel();
    this.vx = v.x; this.vz = v.z;
  }

  placeAt(x: number, z: number, yaw: number) {
    this.body.setTranslation({ x, y: 0.9, z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.yaw = yaw; this.vx = this.vz = 0;
    this.boostTime = 0; this.driftDir = 0; this.driftCharge = 0; this.spinTime = 0;
    this.shrinkTime = 0; this.magnetTime = 0;
  }

  snapshot(): KartSnapshot {
    const p = this.body.translation();
    return { x: p.x, y: p.y, z: p.z, yaw: this.yaw, speed: this.forwardSpeed, drift: this.driftDir };
  }
}
