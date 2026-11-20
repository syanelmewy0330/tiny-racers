import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PHYSICS_HZ } from '@shared/constants';
import { characterById } from '@shared/characters';
import { MEADOW_LOOP } from '@shared/tracks/meadowLoop';
import { yawAt } from '@shared/trackMath';
import { Input } from './Input';
import { Track } from './Track';
import { Environment } from './Environment';
import { KartController } from './KartController';
import { KartModel } from './KartModel';
import { CameraRig } from './CameraRig';
import { RaceTracker } from './RaceTracker';
import { Hud } from '../ui/Hud';
import { OfflineSession, type RaceSession } from '../net/Network';

const STEP = 1 / PHYSICS_HZ;
const KART_RADIUS = 0.75;

/** Owns the renderer, the physics world and the main loop. */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(70, 1, 0.1, 900);
  private world = new RAPIER.World({ x: 0, y: -25, z: 0 });
  private input = new Input();
  private track: Track;
  private env: Environment;
  private kart: KartController;
  private model: KartModel;
  private rig: CameraRig;
  private race: RaceTracker;
  private session: RaceSession = new OfflineSession();
  private clock = new THREE.Clock();
  private acc = 0;
  private time = 0;
  private mode: 'title' | 'race' = 'title';
  private wentGo = false;
  private sendTimer = 0;
  readonly hud: Hud;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.track = new Track(MEADOW_LOOP, this.world);
    this.scene.add(this.track.group);
    this.env = new Environment(this.scene, this.world, this.track);

    const ch = characterById('bubbles');
    this.kart = new KartController(this.world, ch);
    this.model = new KartModel(ch);
    this.scene.add(this.model.root);
    this.rig = new CameraRig(this.camera);
    this.race = new RaceTracker(this.track.path);

    this.hud = new Hud(uiRoot);
    this.hud.onRestart = () => this.startRace();
    this.kart.onBoost = (k) => this.hud.say(k === 'pad' ? 'Boost!' : k === 'mini' ? 'Mini turbo!' : 'Super turbo!');
    this.race.onLap = (lap) => this.hud.say(lap === 3 ? 'Final lap!' : `Lap ${lap}`, 1.6);
    this.race.onFinish = () => this.hud.showResults(this.race.raceTime, this.race.lapTimes);

    this.placeOnGrid();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Called by the title screen's Play button, and by "Race again". */
  startRace() {
    this.mode = 'race';
    this.hud.show(true); this.hud.hideResults();
    this.placeOnGrid();
    this.wentGo = false;
    this.rig.snap();
  }

  private placeOnGrid() {
    const N = this.track.path.pts.length, back = 12, i = (N - back) % N, p = this.track.path.pts[i];
    this.kart.placeAt(p.x, p.z, yawAt(this.track.path, i));
    this.race.reset(i, -back);
  }

  /** R key, or falling off the world: put the kart back on the road where it is. */
  private respawn() {
    const i = this.race.index, p = this.track.path.pts[i];
    this.kart.placeAt(p.x, p.z, yawAt(this.track.path, i));
    this.rig.snap();
    this.hud.say('Reset!', 0.8);
  }

  private resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  private physicsStep() {
    const input = this.input.read();
    if (this.mode === 'race' && this.input.takeRespawn() && this.race.phase !== 'finished') this.respawn();

    const p = this.kart.body.translation();
    const { distFromCentre } = this.race.update(STEP, p.x, p.z);
    this.kart.offroad = distFromCentre > this.track.def.roadHalfWidth + 0.6;

    for (const pad of this.track.pads) {
      const dx = p.x - pad.x, dz = p.z - pad.z;
      const along = dx * Math.sin(pad.yaw) + dz * Math.cos(pad.yaw), side = dx * Math.cos(pad.yaw) - dz * Math.sin(pad.yaw);
      if (Math.abs(along) < 4 && Math.abs(side) < 3.2 && this.kart.boostTime < 0.5) this.kart.boost(1.1, 'pad');
    }

    const locked = this.mode !== 'race' || this.race.phase !== 'racing';
    this.kart.applyInput(input, STEP, locked);
    this.world.step();
    this.kart.syncFromPhysics();
    if (this.kart.body.translation().y < -5) this.respawn();
  }

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.time += dt;
    this.acc += dt;
    while (this.acc >= STEP) { this.physicsStep(); this.acc -= STEP; }

    // visuals follow physics
    const p = this.kart.body.translation();
    this.model.root.position.set(p.x, p.y - KART_RADIUS, p.z);
    this.model.root.rotation.y = this.kart.yaw;
    const speed = this.kart.forwardSpeed;
    this.model.animate(dt, speed, this.kart.steerVisual, this.kart.driftDir, this.kart.driftLevel, this.kart.boosting, this.time);
    this.track.update(this.time);
    const target = new THREE.Vector3(p.x, p.y - KART_RADIUS, p.z);
    this.env.follow(target, this.time);

    if (this.mode === 'title') {
      const a = this.time * 0.25;
      this.camera.position.set(p.x + Math.sin(a) * 11, 4.5, p.z + Math.cos(a) * 11);
      this.camera.lookAt(p.x, 1.2, p.z);
    } else {
      this.rig.update(dt, target, this.kart.yaw, speed);
      const counting = this.race.phase === 'countdown';
      if (!counting && !this.wentGo) { this.wentGo = true; this.hud.flashGo(); }
      this.hud.update(dt, {
        lap: this.race.lap, time: this.race.raceTime, kmh: speed * 3.6,
        drift: this.kart.driftCharge, driftLevel: this.kart.driftLevel,
        countdown: counting ? this.race.countdown : null,
      });
      this.sendTimer += dt;
      if (this.sendTimer > 0.05) { this.sendTimer = 0; this.session.sendSnapshot(this.kart.snapshot()); }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
