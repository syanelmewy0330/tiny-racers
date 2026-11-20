import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { buildPath, yawAt, type TrackPath } from '@shared/trackMath';
import type { TrackDef } from '@shared/tracks/meadowLoop';

export interface BoostPad { index: number; x: number; z: number; yaw: number; mesh: THREE.Mesh }

/** Builds the track's 3D meshes and its invisible physics walls from a shared TrackDef. */
export class Track {
  readonly path: TrackPath;
  readonly group = new THREE.Group();
  readonly pads: BoostPad[] = [];
  readonly wallOffset: number;
  private padTexture: THREE.CanvasTexture;

  constructor(readonly def: TrackDef, world: RAPIER.World) {
    this.path = buildPath(def, 1);
    this.wallOffset = def.roadHalfWidth + def.shoulder;
    const N = this.path.pts.length;

    // Ribbons: shoulder (grass-dirt), curbs, asphalt, all generated along the centre line.
    this.group.add(this.ribbon(this.wallOffset, 0.02, () => new THREE.Color(0x7cc25a)));
    this.group.add(this.ribbon(def.roadHalfWidth + 0.9, 0.04, (i) => new THREE.Color(Math.floor(i / 3) % 2 ? 0xffffff : 0xff4f79)));
    this.group.add(this.ribbon(def.roadHalfWidth, 0.06, (i) => new THREE.Color(i % 2 ? 0x5d5672 : 0x605977)));
    this.group.add(this.dashes());
    this.group.add(this.startLine());
    this.group.add(this.walls(world));

    // Boost pads with an animated chevron texture.
    this.padTexture = this.makePadTexture();
    for (const t of def.boostPads) {
      const index = Math.floor(t * N) % N, p = this.path.pts[index], yaw = yawAt(this.path, index);
      const mat = new THREE.MeshStandardMaterial({ map: this.padTexture, emissive: 0xffb703, emissiveIntensity: 0.6, emissiveMap: this.padTexture });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), mat);
      mesh.rotation.order = 'YXZ'; mesh.rotation.y = yaw + Math.PI; mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(p.x, 0.08, p.z);
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.pads.push({ index, x: p.x, z: p.z, yaw, mesh });
    }
  }

  update(time: number) { this.padTexture.offset.y = -(time * 1.6) % 1; }

  /** Left/right offset vector (perpendicular to travel) at sample i. */
  side(i: number): { x: number; z: number } {
    const yaw = yawAt(this.path, i);
    return { x: Math.cos(yaw), z: -Math.sin(yaw) };
  }

  private ribbon(half: number, y: number, color: (i: number) => THREE.Color): THREE.Mesh {
    const pts = this.path.pts, N = pts.length;
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const k = i % N, p = pts[k], s = this.side(k), c = color(i);
      pos.push(p.x + s.x * half, y, p.z + s.z * half, p.x - s.x * half, y, p.z - s.z * half);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    m.receiveShadow = true;
    return m;
  }

  private dashes(): THREE.InstancedMesh {
    const N = this.path.pts.length, count = Math.floor(N / 6);
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.35, 2.4), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }), count);
    const o = new THREE.Object3D();
    for (let k = 0; k < count; k++) {
      const i = k * 6, p = this.path.pts[i];
      o.position.set(p.x, 0.07, p.z); o.rotation.set(-Math.PI / 2, 0, 0); o.rotation.order = 'YXZ'; o.rotation.y = yawAt(this.path, i);
      o.updateMatrix(); mesh.setMatrixAt(k, o.matrix);
    }
    return mesh;
  }

  private startLine(): THREE.Mesh {
    const c = document.createElement('canvas'); c.width = 256; c.height = 32;
    const g = c.getContext('2d')!;
    for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#222' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(this.def.roadHalfWidth * 2, 2), new THREE.MeshStandardMaterial({ map: tex }));
    const p = this.path.pts[0];
    m.rotation.order = 'YXZ'; m.rotation.y = yawAt(this.path, 0); m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, 0.09, p.z);
    return m;
  }

  /** Low candy-striped walls on both sides, each backed by a physics box. */
  private walls(world: RAPIER.World): THREE.Group {
    const group = new THREE.Group(), pts = this.path.pts, N = pts.length, step = 3, H = 1.1;
    const geo = new THREE.BoxGeometry(1, H, 0.6);
    const mats = [new THREE.MeshStandardMaterial({ color: 0xffffff }), new THREE.MeshStandardMaterial({ color: 0x4cc9f0 })];
    const meshes = [new THREE.InstancedMesh(geo, mats[0], Math.ceil(N / step) * 2), new THREE.InstancedMesh(geo, mats[1], Math.ceil(N / step) * 2)];
    const counts = [0, 0];
    const o = new THREE.Object3D(), q = new THREE.Quaternion();
    for (const sign of [1, -1]) {
      for (let i = 0, k = 0; i < N; i += step, k++) {
        const j = (i + step) % N, si = this.side(i), sj = this.side(j);
        const ax = pts[i].x + si.x * this.wallOffset * sign, az = pts[i].z + si.z * this.wallOffset * sign;
        const bx = pts[j].x + sj.x * this.wallOffset * sign, bz = pts[j].z + sj.z * this.wallOffset * sign;
        const len = Math.hypot(bx - ax, bz - az) + 0.3, yaw = Math.atan2(bx - ax, bz - az);
        const cx = (ax + bx) / 2, cz = (az + bz) / 2;
        // physics: thin tall box
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, H / 2, cz).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
        world.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 1.5, len / 2).setFriction(0).setRestitution(0.2), body);
        // visuals
        o.position.set(cx, H / 2, cz); o.rotation.set(0, yaw + Math.PI / 2, 0); o.scale.set(len, 1, 1); o.updateMatrix();
        const m = k % 2; meshes[m].setMatrixAt(counts[m]++, o.matrix);
      }
    }
    meshes.forEach((m, i) => { m.count = counts[i]; m.castShadow = true; m.receiveShadow = true; group.add(m); });
    return group;
  }

  private makePadTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffd166'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#ff4f79';
    for (const y of [10, 74]) { g.beginPath(); g.moveTo(20, y + 44); g.lineTo(64, y); g.lineTo(108, y + 44); g.lineTo(90, y + 50); g.lineTo(64, y + 24); g.lineTo(38, y + 50); g.closePath(); g.fill(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
}
