import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PHYSICS_HZ } from '@shared/constants';
import { characterById } from '@shared/characters';
import type { PlayerView } from '@shared/protocol';
import { MEADOW_LOOP } from '@shared/tracks/meadowLoop';
import { yawAt } from '@shared/trackMath';
import { Input } from './Input';
import { Track } from './Track';
import { Environment } from './Environment';
import { KartController } from './KartController';
import { createRacerModel, type RacerModel } from './racerModel';
import { toyEnvironment } from '../models/toy';
import { CameraRig } from './CameraRig';
import { RaceTracker } from './RaceTracker';
import { Hud } from '../ui/Hud';
import { OfflineSession, type RaceSession } from '../net/Network';
import type { ColyseusSession } from '../net/ColyseusSession';
import { RemoteKarts } from './RemoteKarts';
import { Look } from './Look';
import { Powerups, ITEM_ICONS } from './Powerups';
import { ITEMS } from '@shared/items';

const STEP = 1 / PHYSICS_HZ;
const KART_RADIUS = 0.75;

/** Owns the renderer, the physics world and the main loop. */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1600);
  private world = new RAPIER.World({ x: 0, y: -25, z: 0 });
  private input = new Input();
  private track: Track;
  private env: Environment;
  private kart: KartController;
  private model: RacerModel;
  private rig: CameraRig;
  private race: RaceTracker;
  private session: RaceSession = new OfflineSession();
  private clock = new THREE.Clock();
  private acc = 0;
  private time = 0;
  private mode: 'title' | 'race' = 'title';
  private remotes: RemoteKarts;
  private online: ColyseusSession | null = null;
  private meView: PlayerView | null = null;
  private characterId = 'bubbles';
  /** The racer picked on the title screen, used for practice and "Race again". */
  private practiceCharacter = 'bubbles';
  /** Called when an online room closes unexpectedly, or the player leaves it. */
  onLeftRoom?: (reason: string | null) => void;
  /** Called when the player quits a practice race to the main menu. */
  onMenu?: () => void;
  private peekUntil = -1;
  private wentGo = false;
  /** Bumped every time a race starts, so delayed results never show over a newer race. */
  private raceSerial = 0;
  private sendTimer = 0;
  readonly hud: Hud;
  private look!: Look;
  private items: Powerups;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;

    toyEnvironment(this.renderer, this.scene, 0.35);
    this.track = new Track(MEADOW_LOOP, this.world);
    this.scene.add(this.track.group);
    this.env = new Environment(this.scene, this.world, this.track);
    this.look = new Look(this.renderer, this.scene, this.camera);

    const ch = characterById('bubbles');
    this.kart = new KartController(this.world, ch);
    this.model = createRacerModel(ch);
    this.scene.add(this.model.root);
    this.rig = new CameraRig(this.camera);
    this.remotes = new RemoteKarts(this.scene, this.world);
    this.race = new RaceTracker(this.track.path);
    this.items = new Powerups(this.scene, this.track.path, this.track.def.roadHalfWidth);
    this.items.onSlot = (item, uses, rolling) => {
      if (rolling) this.hud.setItemRolling(ITEM_ICONS[rolling]);
      else this.hud.setItem(item ? ITEMS[item].name : null, item ? ITEM_ICONS[item] : '', uses);
    };
    this.items.onSay = (t) => this.hud.say(t, 1.2);
    this.items.onBoost = () => this.kart.boost(1.0, 'item');
    this.items.onSpin = () => { this.kart.spinOut(1.1); this.model.spin(1.1); };
    this.items.racerRoot = (id) => id === 'me' ? this.model.root : this.remotes.model(id)?.root ?? null;
    this.items.spinRacer = (id) => this.remotes.model(id)?.spin(1.1);

    this.hud = new Hud(uiRoot);
    this.hud.onRestart = () => this.startRace();
    this.hud.onMenu = () => this.toMenu();
    this.look.onAutoStep = (what) => {
      this.hud.setPauseGraphics(this.look.quality); this.resize();
      this.hud.say(what === 'low' ? 'Graphics: Low (smoother)' : 'Shadows off (smoother)', 2);
    };
    this.input.onPad = (on) => this.hud.say(on ? 'Controller connected' : 'Controller unplugged', 1.6);
    // switching to another tab pauses a practice race
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'race' && !this.online && !this.hud.paused) this.openPause(); });
    this.hud.setTrack(this.track.path.pts);
    this.kart.onBoost = (k) => { this.model.react(); if (k !== 'item') this.hud.say(k === 'pad' ? 'Boost!' : k === 'mini' ? 'Mini turbo!' : 'Super turbo!'); };
    // new laps are announced by the HUD's lap banner
    this.race.onFinish = () => {
      if (this.online) return;
      this.model.setMood('win');   // racing alone, finishing is a win
      this.hud.celebrate(null);
      const raceAt = this.raceSerial;
      setTimeout(() => { if (raceAt === this.raceSerial && !this.online) this.hud.showResults(this.race.raceTime, this.race.lapTimes); }, 2400);
    };

    this.placeOnGrid(0);
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyG' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const q = this.look.toggle(); this.resize(); this.hud.setPauseGraphics(q);
      if (this.mode === 'race' && !this.hud.paused) this.hud.say(q === 'high' ? 'Graphics: High' : 'Graphics: Low', 1.2);
    });
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Practice on your own: the title screen's Practice button, and "Race again". */
  startRace(character = this.practiceCharacter) {
    if (this.online) this.leaveRoom();
    this.practiceCharacter = character;
    this.setCharacter(character);
    this.model.setMood('race');
    this.mode = 'race'; this.raceSerial++;
    this.hud.show(true); this.hud.hideResults(); this.hud.closePause();
    this.placeOnGrid(0);
    this.wentGo = false;
    this.rig.snap();
    this.items.start(null);
    this.firstRaceHelp();
  }

  /** New players see the controls guide during their first two races, until a few seconds after GO. */
  private firstRaceHelp() {
    let n = 0; try { n = Number(localStorage.getItem('tr-races') ?? 0) || 0; localStorage.setItem('tr-races', String(n + 1)); } catch { /* private mode */ }
    this.peekUntil = n < 2 ? Infinity : -1;
    this.hud.peekHelp(n < 2);
  }

  // ---------- pause menu ----------
  private openPause() {
    if (this.mode !== 'race' || this.hud.paused) return;
    this.hud.openPause({ online: !!this.online, graphics: this.look.quality, finished: this.race.phase === 'finished' }, {
      resume: () => this.hud.closePause(),
      restart: () => this.startRace(),
      graphics: () => { const q = this.look.toggle(); this.resize(); this.hud.setPauseGraphics(q); },
      leave: () => this.toMenu(),
    });
  }

  /** Quit the race (or leave the room) and go back to the main menu. */
  toMenu() {
    this.hud.closePause(); this.hud.hideResults();
    this.raceSerial++;
    if (this.online) { this.leaveRoom(); return; }
    this.mode = 'title'; this.hud.show(false); this.items.stop();
    this.onMenu?.();
  }

  /** Online: hook the game up to a race room. The server decides when races start. */
  attachRoom(s: ColyseusSession) {
    this.online = s; this.session = s;
    s.events = {
      world: (w) => {
        this.meView = w.players.find((p) => p.id === s.me) ?? null;
        this.items.onWorld(w, s.me);
        // missed "GO" while reconnecting: catch up with the server
        if (this.mode === 'race' && w.phase === 'racing' && this.race.phase === 'countdown') { this.race.phase = 'racing'; this.race.countdown = 0; }
        if (this.meView && this.meView.character !== this.characterId) this.setCharacter(this.meView.character);
        if (this.mode === 'race') this.remotes.sync(w.players, s.me, this.time);
      },
      raceStart: (d) => {
        this.mode = 'race'; this.raceSerial++;
        this.hud.show(true); this.hud.hideResults();
        this.placeOnGrid(d.grid[s.me] ?? 0);
        this.model.setMood('race'); this.remotes.setMoods(null);
        this.race.countdown = d.countdown + 30;   // the server says GO, not our own timer
        this.countdownEndsAt = this.time + d.countdown;
        this.wentGo = false; this.rig.snap();
        this.hud.closePause();
        this.items.start(s);
        this.firstRaceHelp();
        this.onRaceStarted?.();
      },
      itemGot: (d) => this.items.onGot(d),
      itemUsed: (d) => this.items.onUsed(d, s.me),
      itemHit: (d) => this.items.onHit(d, s.me),
      go: () => { this.race.phase = 'racing'; this.race.countdown = 0; },
      correct: (d) => this.kart.placeAt(d.x, d.z, d.yaw),
      finish: (d) => {
        if (d.id !== s.me) return;
        this.race.phase = 'finished';
        this.model.setMood(d.place === 1 ? 'win' : 'lose');
        this.hud.celebrate(d.place);
      },
      results: (rows) => {
        const mine = rows.find((r) => r.id === s.me);
        if (mine) this.model.setMood(mine.place === 1 ? 'win' : 'lose');
        this.remotes.setMoods(rows);
        this.hud.showOnlineResults(rows, s.me, s.isHost, () => s.start(), () => this.leaveRoom());
      },
      closed: (reason) => this.leaveRoom(reason),
      notice: (text) => { if (this.mode === 'race') this.hud.say(text, 3); },
      reconnecting: (on) => { if (this.mode === 'race') this.hud.say(on ? 'Connection lost. Reconnecting…' : 'Reconnected!', on ? 3 : 1.5); },
    };
  }

  /** Called by the lobby when the race begins, so it can hide itself. */
  onRaceStarted?: () => void;
  private countdownEndsAt = 0;

  leaveRoom(reason: string | null = null) {
    if (!this.online) return;
    this.online.leave();
    this.online = null; this.session = new OfflineSession(); this.meView = null;
    this.remotes.clear(); this.items.stop();
    this.mode = 'title'; this.hud.show(false); this.hud.closePause();
    this.onLeftRoom?.(reason);
  }

  private setCharacter(id: string) {
    if (id === this.characterId) return;
    this.characterId = id;
    const ch = characterById(id);
    this.scene.remove(this.model.root); this.model.dispose();
    this.model = createRacerModel(ch);
    this.scene.add(this.model.root);
    this.kart.setCharacter(ch);
  }

  /** Start grid: two columns behind the start line, by slot number (same formula as the server). */
  private placeOnGrid(slot: number) {
    const N = this.track.path.pts.length, back = 12 + Math.floor(slot / 2) * 6, i = (N - back) % N, p = this.track.path.pts[i];
    const side = this.track.side(i), off = (slot % 2 ? -1 : 1) * 2.8;
    this.kart.placeAt(p.x + side.x * off, p.z + side.z * off, yawAt(this.track.path, i));
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
    this.look?.resize();
  }

  private physicsStep() {
    const paused = this.hud.paused;
    const input = paused ? { throttle: false, brake: false, steer: 0, drift: false } : this.input.read();
    if (this.mode === 'race' && this.input.takeRespawn() && !paused && this.race.phase !== 'finished') this.respawn();

    const p = this.kart.body.translation();
    const { distFromCentre } = this.race.update(STEP, p.x, p.z);
    this.kart.offroad = distFromCentre > this.track.def.roadHalfWidth + 0.6;

    for (const pad of this.track.pads) {
      const dx = p.x - pad.x, dz = p.z - pad.z;
      const along = dx * Math.sin(pad.yaw) + dz * Math.cos(pad.yaw), side = dx * Math.cos(pad.yaw) - dz * Math.sin(pad.yaw);
      if (Math.abs(along) < 4 && Math.abs(side) < 3.2 && this.kart.boostTime < 0.5) this.kart.boost(1.1, 'pad');
    }

    const locked = this.mode !== 'race' || this.race.phase !== 'racing';
    // power-ups: drive through boxes, slip on peels, E / LB to use
    const useItem = this.input.takeItem();
    if (!locked && !paused) {
      const me = this.online?.me ?? 'me';
      const players = this.online?.latest?.players;
      const place = this.meView?.place ?? 1, of = players?.length ?? 1;
      this.items.step(me, p.x, p.z, place, of);
      if (useItem) this.items.use(me, p.x, p.z, this.kart.yaw);
    }
    this.kart.applyInput(input, STEP, locked);
    this.remotes.update(STEP, this.time);
    this.world.step();
    this.kart.syncFromPhysics();
    if (this.kart.body.translation().y < -5) this.respawn();
  }

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.time += dt;
    // pause menu: Esc / P / Start; gamepad moves through menus
    this.input.poll();
    if (this.input.takePause() && this.mode === 'race') { if (this.hud.paused) this.hud.closePause(); else this.openPause(); }
    for (const k of this.input.takeMenu()) if (!this.hud.menuKey(k) && k === 'back' && this.hud.paused) this.hud.closePause();
    // practice freezes while paused; online races carry on
    const frozen = this.hud.paused && !this.online;
    if (frozen) this.acc = 0; else this.acc += dt;
    while (this.acc >= STEP) { this.physicsStep(); this.acc -= STEP; }
    if (this.peekUntil === Infinity && this.wentGo) this.peekUntil = this.time + 5;
    if (this.peekUntil > 0 && this.time > this.peekUntil) { this.peekUntil = -1; this.hud.peekHelp(false); }

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
      const players = this.online?.latest?.players ?? null;
      const me = this.online?.me;
      this.hud.update(dt, {
        lap: this.online && this.meView ? this.meView.lap : this.race.lap,
        time: this.race.raceTime, kmh: speed * 3.6,
        drift: this.kart.driftCharge, driftLevel: this.kart.driftLevel, boosting: this.kart.boosting,
        countdown: counting ? (this.online ? Math.max(0.01, this.countdownEndsAt - this.time) : this.race.countdown) : null,
        place: this.online && this.meView && players ? { n: this.meView.place, of: players.length } : null,
        standings: players ? players.map((pl) => ({ id: pl.id, name: pl.name, character: pl.character, me: pl.id === me })) : null,
        dots: [...this.remotes.positions().map((r) => ({ ...r, me: false })), { x: p.x, z: p.z, character: this.model.ch.id, me: true }],
        net: this.online ? { state: this.online.connection, ping: this.online.pingMs } : null,
      });
      this.sendTimer += dt;
      // 20 position updates a second; none while reconnecting (they would only pile up)
      if (this.sendTimer > 0.05) {
        this.sendTimer = 0;
        if (!this.online || this.online.connection === 'online') this.session.sendSnapshot(this.kart.snapshot());
      }
    }
    this.items.frame(dt, this.time);
    this.look.render(dt, this.mode === 'race' && this.kart.boosting ? 1 : 0);
  }
}

export const ordinal = (n: number) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] ?? 'th');
