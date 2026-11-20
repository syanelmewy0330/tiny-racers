import * as THREE from 'three';

/** Slightly elevated chase camera that trails the kart smoothly. */
export class CameraRig {
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private yaw = 0;
  private first = true;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  snap() { this.first = true; }

  update(dt: number, target: THREE.Vector3, kartYaw: number, speed: number) {
    // The camera turns a little slower than the kart, which makes drifts look great.
    let d = kartYaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw = this.first ? kartYaw : this.yaw + d * (1 - Math.exp(-5 * dt));

    const back = 8.5 + Math.min(Math.abs(speed), 40) * 0.05, up = 3.6;
    const want = new THREE.Vector3(target.x - Math.sin(this.yaw) * back, target.y + up, target.z - Math.cos(this.yaw) * back);
    const lookAt = new THREE.Vector3(target.x + Math.sin(this.yaw) * 5, target.y + 1.2, target.z + Math.cos(this.yaw) * 5);
    if (this.first) { this.pos.copy(want); this.look.copy(lookAt); this.first = false; }
    const k = 1 - Math.exp(-10 * dt);
    this.pos.lerp(want, k); this.look.lerp(lookAt, k);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    const fov = 68 + Math.min(Math.abs(speed), 45) * 0.32;
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();
  }
}
