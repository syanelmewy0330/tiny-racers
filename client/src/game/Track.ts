import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { buildPath, buildRoute, nearest, nearShortcut, yawAt, type Route, type ShortcutPath, type TrackPath } from '@shared/trackMath';
import type { TrackDef } from '@shared/tracks/meadowLoop';
import { THEME, isHarbor, isWall } from './theme';
import { stoneTexture, pavingTexture, plankBridge, trailSurface, tunnelPassage } from './wallPieces';

/** The muddy middle of a trail shortcut, as fractions along it. */
export const TRAIL_MUD: [number, number] = [0.32, 0.68];

export interface BoostPad { index: number; x: number; y: number; z: number; yaw: number; mesh: THREE.Mesh }

/** Builds the track's 3D meshes and its invisible physics walls from a shared TrackDef. */
export class Track {
  readonly path: TrackPath;
  /** Centre line plus shortcuts, for lap counting. */
  readonly route: Route;
  private bodies: RAPIER.RigidBody[] = [];
  readonly group = new THREE.Group();
  readonly pads: BoostPad[] = [];
  readonly wallOffset: number;
  private padTexture: THREE.CanvasTexture;
  /** Ice patches as [first sample, last sample, side] (side 0 = full width). */
  private ice: { a: number; b: number; side: number }[] = [];
  private mud: { a: number; b: number; side: number }[] = [];

  constructor(readonly def: TrackDef, world: RAPIER.World) {
    this.path = buildPath(def, 1);
    this.route = buildRoute(def, this.path);
    this.wallOffset = def.roadHalfWidth + def.shoulder;
    const N = this.path.pts.length;

    // Ribbons: shoulder (grass-dirt), curbs, asphalt, all generated along the centre line.
    // on the old wall the walkway is worn stone paving
    const paving = isWall() ? pavingTexture() : undefined;
    this.group.add(this.ribbon(this.wallOffset, 0.02, () => new THREE.Color(THEME.shoulder), paving));
    this.group.add(this.ribbon(def.roadHalfWidth + 0.9, 0.04, (i) => new THREE.Color(Math.floor(i / 3) % 2 ? THEME.curb[0] : THEME.curb[1])));
    this.group.add(this.ribbon(def.roadHalfWidth, 0.06, (i) => new THREE.Color(i % 2 ? THEME.road[0] : THEME.road[1]), paving));
    this.group.add(this.dashes());
    this.group.add(this.startLine());
    this.group.add(this.walls(world));
    this.icePatches();
    this.mudPatches();
    if (this.path.pts.some((p) => p.y > 0.02)) this.group.add(this.raised(world));
    for (const sc of this.route.shortcuts) {
      if (sc.kind === 'ice') this.group.add(this.shortcutSurface(sc));
      else this.group.add(sc.kind === 'planks' ? plankBridge(this, sc) : sc.kind === 'trail' ? trailSurface(this, sc) : tunnelPassage(this, sc));
      if (sc.pts.some((p) => p.y > 0.02)) this.shortcutFloor(sc, world);
    }

    // Boost pads (design board v3.0): charcoal steel frame, glowing racing-orange chevrons.
    this.padTexture = this.makePadTexture();
    const padMat = new THREE.MeshStandardMaterial({ map: this.padTexture, emissive: 0xffffff, emissiveIntensity: 1.1, emissiveMap: this.padTexture, roughness: 0.35, metalness: 0.2 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c1f26, metalness: 0.6, roughness: 0.4 });
    const stripMat = new THREE.MeshStandardMaterial({ color: 0xff8a00, emissive: 0xff8a00, emissiveIntensity: 2.4 });
    for (const t of def.boostPads) {
      const index = Math.floor(t * N) % N, p = this.path.pts[index], yaw = yawAt(this.path, index);
      const pad = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 7.6), padMat);
      mesh.rotation.set(-Math.PI / 2, 0, Math.PI); mesh.position.y = 0.09;   // texture's up = forward
      mesh.receiveShadow = true; pad.add(mesh);
      for (const sx of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 8), frameMat);
        rail.position.set(sx * 3, 0.1, 0); rail.receiveShadow = true; pad.add(rail);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 7.4), stripMat);
        strip.position.set(sx * 2.86, 0.17, 0); pad.add(strip);
      }
      for (const sz of [-1, 1]) {
        const end = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.1, 0.3), frameMat);
        end.position.set(0, 0.1, sz * 3.95); pad.add(end);
      }
      pad.position.set(p.x, p.y, p.z); pad.rotation.order = 'YXZ'; pad.rotation.y = yaw; pad.rotation.x = -this.pitch(index);
      this.group.add(pad);
      this.pads.push({ index, x: p.x, y: p.y, z: p.z, yaw, mesh });
    }
  }

  update(time: number) { this.padTexture.offset.y = -(time * 1.6) % 1; }

  /** Remove the road's physics walls (when switching tracks). Meshes go with the group. */
  dispose(world: RAPIER.World) {
    for (const b of this.bodies) world.removeRigidBody(b);
    this.bodies = [];
    this.group.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); });
  }

  /** Is the point (x, z), near centre-line sample i, in a mud patch? A trail shortcut is muddy in its middle. */
  onMud(i: number, x: number, z: number): boolean {
    const sc = this.onShortcut(x, z);
    if (sc?.kind === 'trail') { const f = nearShortcut(sc, x, z).f; return f > TRAIL_MUD[0] && f < TRAIL_MUD[1]; }
    return this.inPatch(this.mud, i, x, z);
  }

  private inPatch(list: { a: number; b: number; side: number }[], i: number, x: number, z: number): boolean {
    const N = this.path.pts.length;
    for (const p of list) {
      const k = ((i - p.a) % N + N) % N;
      if (k > p.b - p.a) continue;
      const c = this.path.pts[i], s = this.side(i), off = (x - c.x) * s.x + (z - c.z) * s.z;
      if (Math.abs(off) > this.def.roadHalfWidth + 0.5) continue;
      if (p.side === 0 || off * p.side > -0.5) return true;
    }
    return false;
  }

  /** The shortcut whose surface (x, z) is on, off the main road, if any. */
  onShortcut(x: number, z: number): ShortcutPath | null {
    for (const sc of this.route.shortcuts) {
      if (nearShortcut(sc, x, z).dist < sc.halfWidth + 0.4 && nearest(this.path, x, z).dist > this.def.roadHalfWidth) return sc;
    }
    return null;
  }

  /** Is the point (x, z), near centre-line sample i, on an ice patch? The frozen-pond shortcut is all ice. */
  onIce(i: number, x: number, z: number): boolean {
    if (this.onShortcut(x, z)?.kind === 'ice') return true;
    for (const p of this.ice) {
      if (i < p.a || i > p.b) continue;
      const c = this.path.pts[i], s = this.side(i), off = (x - c.x) * s.x + (z - c.z) * s.z;
      if (Math.abs(off) > this.def.roadHalfWidth + 0.5) continue;
      if (p.side === 0 || off * p.side > -0.5) return true;
    }
    return false;
  }

  /**
   * Height of the road surface under (x, z), near centre-line sample i: the shortcut's surface
   * when on one, otherwise the main road's. `slope` is how much it rises per metre along `dir`.
   */
  groundAt(i: number, x: number, z: number): { y: number; ax: number; az: number; bx: number; bz: number; ay: number; by: number; cy: number } {
    const sc = this.onShortcut(x, z);
    if (sc) {
      const k = nearShortcut(sc, x, z).k, P = sc.pts, n = P.length;
      const a = P[k], b = P[Math.min(n - 1, k + 1)], c = P[Math.max(0, k - 1)];
      return { y: a.y, ax: a.x, az: a.z, bx: b.x, bz: b.z, ay: a.y, by: b.y, cy: c.y };
    }
    const P = this.path.pts, N = P.length, a = P[i], b = P[(i + 1) % N], c = P[(i - 1 + N) % N];
    return { y: a.y, ax: a.x, az: a.z, bx: b.x, bz: b.z, ay: a.y, by: b.y, cy: c.y };
  }

  /** Dark glossy mud puddles with tyre ruts. */
  private mudPatches() {
    if (!this.def.mudPatches?.length) return;
    const tex = mudTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.35, metalness: 0.1 });
    for (const p of this.def.mudPatches) this.mud.push(this.patch(p, mat));
  }

  /** Lay one patch (ice or mud) on the road as a soft-edged strip; returns its sample range. */
  private patch(p: { t: number; len: number; side: number }, mat: THREE.Material): { a: number; b: number; side: number } {
    const N = this.path.pts.length, half = this.def.roadHalfWidth;
    const a = Math.floor(p.t * N) % N, n = Math.round(p.len / this.path.spacing);
    const lo = p.side === 0 ? -half + 0.3 : p.side > 0 ? -0.4 : -half + 0.3;
    const hi = p.side === 0 ? half - 0.3 : p.side > 0 ? half - 0.3 : 0.4;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let k = 0; k <= n; k++) {
      const i = (a + k) % N, c = this.path.pts[i], s = this.side(i);
      const e = Math.min(k, n - k) / n, shrink = e < 0.18 ? (0.18 - e) * 2.6 * (hi - lo) * 0.5 : 0;
      const wob = Math.sin(k * 0.9) * 0.35;
      const l = lo + shrink + wob, h = hi - shrink + wob * 0.6;
      pos.push(c.x + s.x * h, 0.075 + c.y, c.z + s.z * h, c.x + s.x * l, 0.075 + c.y, c.z + s.z * l);
      uv.push(0, k / 6, (h - l) / 6, k / 6);
      if (k < n) { const q = k * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true;
    this.group.add(m);
    return { a, b: a + n, side: p.side };
  }

  /** Glassy pale-blue ice sheets with frosty cracks, laid on the road. */
  private icePatches() {
    const N = this.path.pts.length, half = this.def.roadHalfWidth;
    if (!this.def.icePatches?.length) return;
    const tex = isHarbor() ? puddleTexture() : iceTexture();
    // Neon Harbor: the same slide, but it is a rain puddle shining with the city's neon
    const mat = isHarbor()
      ? new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.03, metalness: 0.6, transparent: true, opacity: 0.92, emissive: 0xffffff, emissiveIntensity: 0.7, emissiveMap: tex })
      : new THREE.MeshStandardMaterial({ map: tex, color: 0xbfe2ff, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.95, emissive: 0x8ccfff, emissiveIntensity: 0.55, emissiveMap: tex });
    for (const p of this.def.icePatches) {
      const a = Math.floor(p.t * N) % N, n = Math.round(p.len / this.path.spacing);
      this.ice.push({ a, b: a + n, side: p.side });
      // outer and inner edge offsets (side +1 = the +side half of the road)
      const lo = p.side === 0 ? -half + 0.3 : p.side > 0 ? -0.4 : -half + 0.3;
      const hi = p.side === 0 ? half - 0.3 : p.side > 0 ? half - 0.3 : 0.4;
      const pos: number[] = [], uv: number[] = [], idx: number[] = [];
      for (let k = 0; k <= n; k++) {
        const i = (a + k) % N, c = this.path.pts[i], s = this.side(i);
        // soft, wobbly ends so it looks like a frozen puddle, not a rectangle
        const e = Math.min(k, n - k) / n, shrink = e < 0.18 ? (0.18 - e) * 2.6 * (hi - lo) * 0.5 : 0;
        const wob = Math.sin(k * 0.9) * 0.35;
        const l = lo + shrink + wob, h = hi - shrink + wob * 0.6;
        pos.push(c.x + s.x * h, 0.075 + c.y, c.z + s.z * h, c.x + s.x * l, 0.075 + c.y, c.z + s.z * l);
        uv.push(0, k / 6, (h - l) / 6, k / 6);
        if (k < n) { const q = k * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true;
      this.group.add(m);
    }
  }

  /** Left/right offset vector (perpendicular to travel) at sample i. */
  side(i: number): { x: number; z: number } {
    const yaw = yawAt(this.path, i);
    return { x: Math.cos(yaw), z: -Math.sin(yaw) };
  }

  /** Uphill angle of the road at sample i (radians, positive = climbing in the driving direction). */
  pitch(i: number): number {
    const pts = this.path.pts, N = pts.length;
    return Math.atan((pts[(i + 1) % N].y - pts[(i - 1 + N) % N].y) / (2 * this.path.spacing));
  }

  /** Road height at sample i (0 on flat tracks). */
  heightAt(i: number): number { return this.path.pts[i].y; }

  private ribbon(half: number, y: number, color: (i: number) => THREE.Color, map?: THREE.Texture): THREE.Mesh {
    const pts = this.path.pts, N = pts.length;
    const pos: number[] = [], col: number[] = [], idx: number[] = [], uv: number[] = [];
    for (let i = 0; i <= N; i++) {
      const k = i % N, p = pts[k], s = this.side(k), c = color(i);
      pos.push(p.x + s.x * half, y + p.y, p.z + s.z * half, p.x - s.x * half, y + p.y, p.z - s.z * half);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      uv.push(0, (i * this.path.spacing) / 5, (2 * half) / 5, (i * this.path.spacing) / 5);
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: map ?? null, vertexColors: true, roughness: y > 0.05 ? THEME.roadRough ?? 0.9 : 0.9, metalness: y > 0.05 ? THEME.roadMetal ?? 0 : 0 }));
    m.receiveShadow = true;
    return m;
  }

  private dashes(): THREE.InstancedMesh {
    const N = this.path.pts.length, count = Math.floor(N / 6);
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.35, 2.4), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }), count);
    const o = new THREE.Object3D();
    for (let k = 0; k < count; k++) {
      const i = k * 6, p = this.path.pts[i];
      o.position.set(p.x, 0.07 + p.y, p.z); o.rotation.order = 'YXZ'; o.rotation.set(-Math.PI / 2 - this.pitch(i), yawAt(this.path, i), 0);
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
    m.position.set(p.x, 0.09 + p.y, p.z);
    return m;
  }

  /**
   * Low striped walls on both sides, each backed by a physics box. Where a shortcut leaves the
   * road the wall has a gap, and the shortcut gets walls of its own. On stone wall tracks they
   * are battlements: stone parapets with blocks along the top.
   */
  private walls(world: RAPIER.World): THREE.Group {
    const group = new THREE.Group(), pts = this.path.pts, N = pts.length, step = 3, H = 1.1;
    const scs = this.route.shortcuts, stone = isWall();
    const geo = new THREE.BoxGeometry(1, H, 0.6);
    const mats = stone
      ? [0, 1].map((k) => new THREE.MeshStandardMaterial({ color: THEME.walls[k], map: stoneTexture(), roughness: 0.95 }))
      : [new THREE.MeshStandardMaterial({ color: THEME.walls[0] }), new THREE.MeshStandardMaterial({ color: THEME.walls[1] })];
    const cap = Math.ceil(N / step) * 2 + scs.reduce((n, sc) => n + sc.pts.length * 2, 0);
    const meshes = [new THREE.InstancedMesh(geo, mats[0], cap), new THREE.InstancedMesh(geo, mats[1], cap)];
    // battlement blocks along the top of the parapet
    const merlons = stone ? new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.75, 0.7), mats[1], cap) : null;
    const counts = [0, 0];
    let nm = 0;
    const o = new THREE.Object3D(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ');
    o.rotation.order = 'YZX';
    const wall = (ax: number, az: number, bx: number, bz: number, k: number, ay = 0, by = 0, show = true) => {
      const flat = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az), rise = Math.atan2(by - ay, flat);
      const len = Math.hypot(flat, by - ay) + 0.3;
      const cx = (ax + bx) / 2, cy = (ay + by) / 2, cz = (az + bz) / 2;
      // physics: thin tall box (tilted along the slope on raised roads)
      q.setFromEuler(e.set(-rise, yaw, 0));
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy + H / 2, cz).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 1.5, len / 2).setFriction(0).setRestitution(0.2), body);
      this.bodies.push(body);
      if (!show) return;
      // visuals
      o.position.set(cx, cy + H / 2, cz); o.rotation.set(0, yaw + Math.PI / 2, -rise); o.scale.set(len, 1, 1); o.updateMatrix();
      const m = stone ? 0 : k % 2; meshes[m].setMatrixAt(counts[m]++, o.matrix);
      if (merlons && k % 2 === 0) {
        o.position.set(cx, cy + H + 0.37, cz); o.scale.set(1, 1, 1); o.updateMatrix(); merlons.setMatrixAt(nm++, o.matrix);
      }
    };
    const nearAnyShortcut = (x: number, z: number, y: number) => scs.some((sc) => {
      const n = nearShortcut(sc, x, z);
      return n.dist < sc.halfWidth + 1.2 && Math.abs(sc.pts[n.k].y - y) < 3;
    });
    for (const sign of [1, -1]) {
      for (let i = 0, k = 0; i < N; i += step, k++) {
        const j = (i + step) % N, si = this.side(i), sj = this.side(j);
        const ax = pts[i].x + si.x * this.wallOffset * sign, az = pts[i].z + si.z * this.wallOffset * sign;
        const bx = pts[j].x + sj.x * this.wallOffset * sign, bz = pts[j].z + sj.z * this.wallOffset * sign;
        // gap where a shortcut leaves or rejoins the road
        if (nearAnyShortcut((ax + bx) / 2, (az + bz) / 2, pts[i].y)) continue;
        wall(ax, az, bx, bz, k, pts[i].y, pts[j].y);
      }
    }
    for (const sc of scs) {
      const sp = sc.pts, off = sc.halfWidth + 0.3, s2 = 2;
      // the plank bridge has rope rails, the trail fences, the tunnel stone walls: only invisible walls there
      const show = sc.kind === 'ice';
      for (const sign of [1, -1]) {
        for (let i = 0, k = 0; i + s2 < sp.length; i += s2, k++) {
          const si = scSide(sp, i), sj = scSide(sp, i + s2);
          const ax = sp[i].x + si.x * off * sign, az = sp[i].z + si.z * off * sign;
          const bx = sp[i + s2].x + sj.x * off * sign, bz = sp[i + s2].z + sj.z * off * sign;
          // inside the main road's walls there is nothing to wall off
          if (nearest(this.path, (ax + bx) / 2, (az + bz) / 2).dist < this.wallOffset + 0.4) continue;
          wall(ax, az, bx, bz, k, sp[i].y, sp[i + s2].y, show);
        }
      }
    }
    meshes.forEach((m, i) => { m.count = counts[i]; m.castShadow = true; m.receiveShadow = true; group.add(m); });
    if (merlons) { merlons.count = nm; merlons.castShadow = merlons.receiveShadow = true; group.add(merlons); }
    return group;
  }

  /** A solid surface under a raised shortcut, so karts can drive across it. */
  private shortcutFloor(sc: ShortcutPath, world: RAPIER.World) {
    const v: number[] = [], ix: number[] = [], W = sc.halfWidth + 0.6;
    sc.pts.forEach((p, k) => {
      const s = scSide(sc.pts, k), vi = v.length / 3;
      v.push(p.x + s.x * W, p.y, p.z + s.z * W, p.x - s.x * W, p.y, p.z - s.z * W);
      if (k > 0) ix.push(vi - 2, vi - 1, vi, vi - 1, vi + 1, vi);
    });
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(v), new Uint32Array(ix)).setFriction(0), body);
    this.bodies.push(body);
  }

  /**
   * Raised road (a bridge): a solid surface karts drive up onto, plus the deck's underside,
   * side skirts with a neon trim, and pillars down to the ground (none on the road below).
   */
  private raised(world: RAPIER.World): THREE.Group {
    const g = new THREE.Group(), pts = this.path.pts, N = pts.length, W = this.wallOffset + 0.4, T = 0.8;
    const up = (i: number) => pts[i].y > 0.01;
    // the stretch of samples that is raised, padded a little so the foot is flush with the ground
    const on: number[] = [];
    // a stone wall track is raised all the way round
    for (let i = 0; i < N; i++) if (isWall() || up(i) || up((i + 2) % N) || up((i - 2 + N) % N)) on.push(i);
    if (isWall()) on.push(0);   // close the loop
    // physics: one triangle strip the width of the road between the walls
    const v: number[] = [], ix: number[] = [];
    let prev = -2, base = 0;
    for (const i of on) {
      const p = pts[i], s = this.side(i);
      const vi = v.length / 3;
      v.push(p.x + s.x * W, p.y, p.z + s.z * W, p.x - s.x * W, p.y, p.z - s.z * W);
      if (i === prev + 1 || (i === 0 && prev === N - 1)) ix.push(base, base + 1, vi, base + 1, vi + 1, vi);
      prev = i; base = vi;
    }
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(v), new Uint32Array(ix)).setFriction(0), body);
    this.bodies.push(body);
    if (isWall()) { g.add(this.wallSides(on, W)); return g; }

    // visuals: underside and skirts only where it is well off the ground
    const deck = new THREE.MeshStandardMaterial({ color: THEME.bridge?.deck ?? 0x3a3f47, roughness: 0.8, side: THREE.DoubleSide });
    const trim = new THREE.MeshStandardMaterial({ color: THEME.bridge?.trim ?? 0x8f84d9, emissive: THEME.bridge?.trim ?? 0x8f84d9, emissiveIntensity: 2.2 });
    const under: number[] = [], ui: number[] = [], skirt: number[] = [], si: number[] = [];
    prev = -2;
    for (const i of on) {
      const p = pts[i], s = this.side(i), y = Math.max(0, p.y - T);
      const u = under.length / 3;
      under.push(p.x + s.x * W, y, p.z + s.z * W, p.x - s.x * W, y, p.z - s.z * W);
      const k = skirt.length / 3;
      for (const sd of [1, -1]) skirt.push(p.x + s.x * W * sd, p.y + 0.06, p.z + s.z * W * sd, p.x + s.x * W * sd, y, p.z + s.z * W * sd);
      if (i === prev + 1) {
        ui.push(u - 2, u, u - 1, u - 1, u, u + 1);
        for (const o of [0, 2]) si.push(k - 4 + o, k - 3 + o, k + o, k - 3 + o, k + 1 + o, k + o);
      }
      prev = i;
    }
    const mesh = (pos: number[], idx: number[], m: THREE.Material) => {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const me = new THREE.Mesh(geo, m); me.castShadow = true; me.receiveShadow = true; g.add(me); return me;
    };
    mesh(under, ui, deck); mesh(skirt, si, deck);
    // a glowing trim line along both skirts
    for (const sd of [1, -1]) {
      const tp: number[] = [], ti: number[] = []; prev = -2;
      for (const i of on) {
        const p = pts[i], s = this.side(i), x = p.x + s.x * (W + 0.03) * sd, z = p.z + s.z * (W + 0.03) * sd;
        const t = tp.length / 3; tp.push(x, p.y - 0.12, z, x, p.y - 0.32, z);
        if (i === prev + 1) ti.push(t - 2, t - 1, t, t - 1, t + 1, t);
        prev = i;
      }
      const tm = mesh(tp, ti, trim); tm.castShadow = false;
      (tm.material as THREE.Material).side = THREE.DoubleSide;
    }
    // pillars: pairs every 12 m, never standing in a road below
    const low = pts.filter((p) => p.y < 0.3);
    const pillarMat = new THREE.MeshStandardMaterial({ color: THEME.bridge?.pillar ?? 0x4a505c, roughness: 0.7 });
    for (let n = 0; n < on.length; n += 12) {
      const i = on[n], p = pts[i]; if (p.y < 2.2) continue;
      const s = this.side(i);
      for (const sd of [1, -1]) {
        const x = p.x + s.x * (W - 1.2) * sd, z = p.z + s.z * (W - 1.2) * sd;
        if (low.some((q) => Math.hypot(q.x - x, q.z - z) < this.wallOffset + 1.2)) continue;
        const h = p.y - T;
        const col = new THREE.Mesh(new THREE.BoxGeometry(1.1, h, 1.1), pillarMat);
        col.position.set(x, h / 2, z); col.rotation.y = yawAt(this.path, i); col.castShadow = col.receiveShadow = true; g.add(col);
      }
    }
    return g;
  }

  /** The old wall's stone faces: from the walkway down into the ridge below (the terrain hides the foot). */
  private wallSides(on: number[], W: number): THREE.Group {
    const g = new THREE.Group(), pts = this.path.pts, N = pts.length, DEPTH = 9;
    const mat = new THREE.MeshStandardMaterial({ map: stoneTexture(true), color: 0xffffff, roughness: 0.95 });
    for (const sd of [1, -1]) {
      const pos: number[] = [], uv: number[] = [], ix: number[] = [];
      let dist = 0;
      on.forEach((i, n) => {
        const p = pts[i], s = this.side(i), x = p.x + s.x * W * sd, z = p.z + s.z * W * sd;
        if (n > 0) { const q = pts[on[n - 1]]; dist += Math.hypot(p.x - q.x, p.z - q.z); }
        const v = pos.length / 3;
        pos.push(x, p.y + 0.06, z, x, p.y - DEPTH, z);
        uv.push(dist / 4, (p.y + 0.06) / 4, dist / 4, (p.y - DEPTH) / 4);
        if (n > 0) ix.push(...(sd > 0 ? [v - 2, v - 1, v, v - 1, v + 1, v] : [v - 2, v, v - 1, v - 1, v, v + 1]));
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(ix); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true;
      (m.material as THREE.Material).side = THREE.DoubleSide;
      g.add(m);
    }
    void N;
    return g;
  }

  /** The shortcut: a frozen pond with an icy lane across it. */
  private shortcutSurface(sc: ShortcutPath): THREE.Group {
    const sp = sc.pts, g = new THREE.Group();
    // the pond, an ellipse along the shortcut, under everything else
    const a = sp[0], b = sp[sp.length - 1], mid = sp[Math.floor(sp.length / 2)];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x9fcbf2, roughness: 0.08, metalness: 0.35, emissive: 0x6ca9e6, emissiveIntensity: 0.15 }));
    pond.rotation.order = 'YXZ'; pond.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); pond.rotation.x = -Math.PI / 2;
    pond.scale.set(sc.halfWidth + 7, len * 0.36, 1);
    pond.position.set(mid.x, 0.025, mid.z); pond.receiveShadow = true; g.add(pond);
    // the icy lane itself
    const tex = iceTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xbfe2ff, roughness: 0.1, metalness: 0.3, emissive: 0x8ccfff, emissiveIntensity: 0.55, emissiveMap: tex });
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    sp.forEach((p, k) => {
      const s = scSide(sp, k), h = sc.halfWidth + 0.3;
      pos.push(p.x + s.x * h, 0.075, p.z + s.z * h, p.x - s.x * h, 0.075, p.z - s.z * h);
      uv.push(0, k / 6, (2 * h) / 6, k / 6);
      if (k < sp.length - 1) { const q = k * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const lane = new THREE.Mesh(geo, mat); lane.receiveShadow = true; g.add(lane);
    // a sky-blue arrow sign at the way in, so racers spot it
    const p0 = sp[Math.min(sp.length - 1, 14)], s0 = scSide(sp, 14), yaw0 = Math.atan2(sp[16].x - sp[12].x, sp[16].z - sp[12].z);
    for (const sign of [1, -1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0x1c1f26 }));
      const x = p0.x + s0.x * (sc.halfWidth + 1) * sign, z = p0.z + s0.z * (sc.halfWidth + 1) * sign;
      post.position.set(x, 1.2, z); g.add(post);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.9), new THREE.MeshStandardMaterial({ color: 0x6ca9e6, emissive: 0x6ca9e6, emissiveIntensity: 0.8 }));
      flag.position.set(x, 2.2, z); flag.rotation.y = yaw0; g.add(flag);
    }
    return g;
  }

  private makePadTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#1C1F26'; g.fillRect(0, 0, 128, 128);
    // two chevrons per tile, pointing along the road; orange with a yellow leading edge
    for (const y of [8, 72]) {
      const chev = (dy: number, col: string) => { g.fillStyle = col; g.beginPath(); g.moveTo(18, y + dy + 46); g.lineTo(64, y + dy); g.lineTo(110, y + dy + 46); g.lineTo(92, y + dy + 52); g.lineTo(64, y + dy + 26); g.lineTo(36, y + dy + 52); g.closePath(); g.fill(); };
      chev(0, '#FCC945'); chev(6, '#FF8A00');
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
}

function iceTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#cfe6ff'); grad.addColorStop(0.5, '#e9f4ff'); grad.addColorStop(1, '#b9d6f7');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  let seed = 11; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // frosty speckles
  for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.5})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
  // crack lines
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.4;
  for (let k = 0; k < 9; k++) {
    let x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 5; s++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; g.lineTo(x, y); }
    g.stroke();
  }
  // sky-blue glints
  g.strokeStyle = 'rgba(108,169,230,0.55)'; g.lineWidth = 2;
  for (let k = 0; k < 5; k++) { const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30, y + 12); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** A dark rain puddle with ripple rings and smeared neon colour. */
function puddleTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#121427'; g.fillRect(0, 0, 256, 256);
  let seed = 31; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // smeared neon reflections running along the road
  const cols = ['rgba(143,132,217,0.55)', 'rgba(229,75,75,0.45)', 'rgba(108,169,230,0.5)', 'rgba(255,138,0,0.35)'];
  for (let k = 0; k < 10; k++) { g.fillStyle = cols[k % 4]; g.fillRect(r() * 240, 0, 4 + r() * 14, 256); }
  // ripple rings from raindrops
  g.strokeStyle = 'rgba(220,226,255,0.55)'; g.lineWidth = 1.5;
  for (let k = 0; k < 26; k++) { const x = r() * 256, y = r() * 256, rad = 3 + r() * 12; g.beginPath(); g.ellipse(x, y, rad, rad * 0.7, 0, 0, Math.PI * 2); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** Sideways unit vector of a sampled line at k (same handedness as Track.side). */
export function scSide(sp: { x: number; z: number }[], k: number): { x: number; z: number } {
  const a = sp[Math.max(0, k - 2)], b = sp[Math.min(sp.length - 1, k + 2)];
  const yaw = Math.atan2(b.x - a.x, b.z - a.z);
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}

function mudTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#24160d'; g.fillRect(0, 0, 256, 256);
  let seed = 23; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < 60; k++) { g.fillStyle = ['#3a2518', '#1c110a', '#45301f'][k % 3]; g.beginPath(); g.ellipse(r() * 256, r() * 256, 8 + r() * 30, 5 + r() * 16, r() * 3, 0, Math.PI * 2); g.fill(); }
  // wet shine and tyre ruts running along the road
  g.strokeStyle = 'rgba(255,220,170,0.35)'; g.lineWidth = 3;
  for (let k = 0; k < 12; k++) { const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y + 20, x + 4, y + 40); g.stroke(); }
  g.fillStyle = 'rgba(20,12,8,0.45)'; g.fillRect(70, 0, 16, 256); g.fillRect(170, 0, 16, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
