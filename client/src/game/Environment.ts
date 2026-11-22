import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { nearest, yawAt } from '@shared/trackMath';
import type { Track } from './Track';
import { SUN_DIR, HAZE } from './Look';
import { THEME, IS_FROST } from './theme';
import { frostScenery, type Snowfall } from './frostScenery';

/** Sky, lights, ground and scenery around the track. */
export class Environment {
  readonly sun: THREE.DirectionalLight;
  private clouds = new THREE.Group();
  private snow: Snowfall | null = null;

  constructor(scene: THREE.Scene, world: RAPIER.World, track: Track) {
    scene.background = HAZE.clone();
    scene.fog = new THREE.Fog(HAZE, THEME.fogNear, THEME.fogFar);

    // golden-hour light: warm low sun, cool sky fill, warm bounce from the ground
    scene.add(new THREE.HemisphereLight(THEME.hemiSky, THEME.hemiGround, THEME.hemiPower));
    this.sun = new THREE.DirectionalLight(THEME.sunColor, THEME.sunPower);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0005;
    scene.add(this.sun, this.sun.target);

    // Ground: big grassy (or snowy) field, plus a physics floor under everything.
    const ground = new THREE.Mesh(new THREE.CircleGeometry(600, 64), new THREE.MeshStandardMaterial({ color: THEME.ground, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(90, 0, 45); ground.receiveShadow = true;
    scene.add(ground);
    world.createCollider(RAPIER.ColliderDesc.cuboid(800, 1, 800).setTranslation(90, -1, 45).setFriction(0));

    const rnd = mulberry(42);
    const clear = (x: number, z: number, margin: number) => nearest(track.path, x, z).dist > track.wallOffset + margin;
    scene.add(startArch(track));
    if (IS_FROST) { this.snow = frostScenery(scene, track, rnd, clear); return; }

    // Trees (instanced: cheap to draw hundreds)
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 2.4, 8);
    const crownGeo = new THREE.IcosahedronGeometry(2.2, 1);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x8a5a3c }), 260);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }), 260);
    const greens = [0x4caf50, 0x66bb6a, 0x2e9e5b, 0xf28fb5, 0xffb3c7];
    const o = new THREE.Object3D(); let n = 0;
    for (let tries = 0; tries < 3000 && n < 260; tries++) {
      const x = -60 + rnd() * 300, z = -70 + rnd() * 230;
      if (!clear(x, z, 4)) continue;
      const s = 0.8 + rnd() * 0.9;
      o.position.set(x, 1.2 * s, z); o.scale.setScalar(s); o.rotation.set(0, rnd() * 6, 0); o.updateMatrix(); trunks.setMatrixAt(n, o.matrix);
      o.position.set(x, 3.4 * s, z); o.scale.set(s, s * (0.9 + rnd() * 0.4), s); o.updateMatrix(); crowns.setMatrixAt(n, o.matrix);
      crowns.setColorAt(n, new THREE.Color(greens[Math.floor(rnd() * (rnd() < 0.8 ? 3 : 5))]));
      n++;
    }
    trunks.count = crowns.count = n;
    for (const m of [trunks, crowns]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }

    // Flowers and mushrooms near the walls
    const flowerGeo = new THREE.SphereGeometry(0.28, 8, 6);
    const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ color: 0xffffff }), 500);
    const fcols = [0xffffff, 0xffd166, 0xff8fab, 0xb18cff];
    n = 0;
    for (let tries = 0; tries < 4000 && n < 500; tries++) {
      const x = -50 + rnd() * 280, z = -60 + rnd() * 210;
      if (!clear(x, z, 0.8)) continue;
      o.position.set(x, 0.25, z); o.scale.setScalar(0.7 + rnd() * 0.8); o.updateMatrix(); flowers.setMatrixAt(n, o.matrix);
      flowers.setColorAt(n, new THREE.Color(fcols[Math.floor(rnd() * 4)])); n++;
    }
    flowers.count = n; scene.add(flowers);

    for (let k = 0; k < 18; k++) {
      let x = 0, z = 0;
      for (let t = 0; t < 50; t++) { x = -40 + rnd() * 260; z = -50 + rnd() * 190; if (clear(x, z, 3)) break; }
      scene.add(mushroom(x, z, 0.8 + rnd()));
    }

    // Distant rolling hills
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x5f9f58, roughness: 1 });
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2, r = 230 + rnd() * 60;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(40 + rnd() * 30, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
      hill.position.set(90 + Math.cos(a) * r, -5, 45 + Math.sin(a) * r); hill.scale.y = 0.5 + rnd() * 0.4;
      scene.add(hill);
    }

    // Fluffy clouds
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.25 });
    for (let k = 0; k < 16; k++) {
      const c = new THREE.Group();
      for (let b = 0; b < 5; b++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(4 + rnd() * 4, 12, 10), cloudMat);
        puff.position.set(b * 5 - 10, rnd() * 2, rnd() * 4); c.add(puff);
      }
      c.position.set(-80 + rnd() * 340, 45 + rnd() * 25, -90 + rnd() * 270);
      this.clouds.add(c);
    }
    scene.add(this.clouds);
  }

  /** Keep the sun's shadow box centred on the kart. */
  follow(target: THREE.Vector3, time: number) {
    this.sun.position.copy(target).addScaledVector(SUN_DIR, 80);
    this.sun.target.position.copy(target);
    this.clouds.position.x = Math.sin(time * 0.02) * 20;
    this.snow?.update(target, time);
  }
}

function mushroom(x: number, z: number, s: number): THREE.Group {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.2, 10), new THREE.MeshStandardMaterial({ color: 0xfff3e0 }));
  stem.position.y = 0.6; g.add(stem);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xff4f79 }));
  cap.position.y = 1.1; cap.scale.set(1, 0.7, 1); g.add(cap);
  for (let i = 0; i < 5; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    const a = i * 1.3; dot.position.set(Math.cos(a) * 0.6, 1.55, Math.sin(a) * 0.6); g.add(dot);
  }
  g.traverse((m) => { if (m instanceof THREE.Mesh) { m.castShadow = true; } });
  g.position.set(x, 0, z); g.scale.setScalar(s);
  return g;
}

function startArch(track: Track): THREE.Group {
  const g = new THREE.Group();
  const p = track.path.pts[0], yaw = yawAt(track.path, 0), w = track.wallOffset + 1;
  const postMat = new THREE.MeshStandardMaterial({ color: IS_FROST ? 0x3a3f47 : 0xf05b65 });
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 9, 12), postMat);
    post.position.set(sx * w, 4.5, 0); post.castShadow = true; g.add(post);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial(IS_FROST ? { color: 0xff8a00, emissive: 0xff8a00, emissiveIntensity: 1.6 } : { color: 0xe5a94b }));
    ball.position.set(sx * w, 9.4, 0); g.add(ball);
  }
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160;
  const ctx = c.getContext('2d')!;
  const FONT = 'italic 700 104px "Fredoka", "Trebuchet MS", sans-serif';
  const paint = () => {
    ctx.fillStyle = '#252638'; ctx.fillRect(0, 0, 1024, 160);
    for (let x = 0; x < 1024; x += 32) for (let y = 0; y < 2; y++) { ctx.fillStyle = (x / 32 + y) % 2 ? '#ffffff' : '#252638'; ctx.fillRect(x, y * 12, 32, 12); ctx.fillRect(x, 136 + y * 12, 32, 12); }
    ctx.fillStyle = '#ffffff'; ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TINY RACERS', 512, 84);
  };
  paint();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  document.fonts?.load(FONT).then(() => { paint(); tex.needsUpdate = true; }).catch(() => {});
  const banner = new THREE.Mesh(new THREE.BoxGeometry(w * 2, 2.6, 0.4), [postMat, postMat, postMat, postMat, new THREE.MeshStandardMaterial({ map: tex }), new THREE.MeshStandardMaterial({ map: tex })]);
  banner.position.set(0, 8, 0); banner.castShadow = true; g.add(banner);
  g.position.set(p.x, 0, p.z);
  // banner faces along the road; the box's wide side runs across the track
  g.rotation.y = yaw;
  return g;
}

/** Small seeded random number generator so the scenery is the same every time. */
function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
