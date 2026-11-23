import { Room, type Client } from '@colyseus/core';
import { MAX_PLAYERS, LAPS, COUNTDOWN_SECONDS } from '../../shared/src/constants.ts';
import { CHARACTERS, isCharacterId } from '../../shared/src/characters.ts';
import { buildRoute, locate, indexDelta, type Route } from '../../shared/src/trackMath.ts';
import { MEADOW_LOOP, type TrackDef } from '../../shared/src/tracks/meadowLoop.ts';
import { FROSTBITE_PASS } from '../../shared/src/tracks/frostbitePass.ts';
import { LANTERN_GROVE } from '../../shared/src/tracks/lanternGrove.ts';
import { NEON_HARBOR } from '../../shared/src/tracks/neonHarbor.ts';
import { DRAGON_RIDGE } from '../../shared/src/tracks/dragonRidge.ts';
import type { KartSnapshot } from '../../shared/src/types.ts';
import type { RoomPhase, WorldMessage, PlayerView, ResultRow, ItemGotMessage, ItemUsedMessage, ItemHitMessage } from '../../shared/src/protocol.ts';
import { ItemWorld } from '../../shared/src/items.ts';

/** Tracks a room can race on. */
const TRACKS: TrackDef[] = [MEADOW_LOOP, FROSTBITE_PASS, LANTERN_GROVE, NEON_HARBOR, DRAGON_RIDGE];
const ROUTES = new Map(TRACKS.map((t) => [t.id, buildRoute(t)]));

/**
 * Quick race track order. Plain random could repeat a track and leave another out for many races
 * in a row, so we deal from a shuffled deck: every track is played once before the deck is reshuffled.
 * The deck is shared by all Quick race rooms on this server, and never hands a room the track it just had.
 */
let quickDeck: TrackDef[] = [];
let lastDealt: string | undefined;
/** `currentId`: the room's current track (left out for a new room, which then avoids the last track dealt). */
export function nextQuickTrack(currentId = lastDealt): TrackDef {
  const shuffled = () => {
    const d = [...TRACKS];
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  };
  if (quickDeck.length === 0) quickDeck = shuffled();
  // only the room's current track left: slide a fresh deck underneath so there is another card to take
  if (quickDeck.length === 1 && quickDeck[0].id === currentId) quickDeck = [...shuffled(), ...quickDeck];
  let i = quickDeck.length - 1;
  if (quickDeck[i].id === currentId) i--;
  const t = quickDeck.splice(i, 1)[0];
  lastDealt = t.id;
  return t;
}
const MAX_SPEED = 62;            // m/s; faster than any legal boost, so only cheats or glitches exceed it
const FINISH_GRACE_MS = 30_000;  // after the winner finishes, others get this long
const RECONNECT_SECONDS = 20;    // how long a dropped player's place is kept
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Which race server this is: 'us' (default) or 'eu'. Set by TR_REGION on the hosting service. */
const REGION = process.env.TR_REGION === 'eu' ? 'eu' : 'us';

interface Player {
  id: string;
  name: string;
  character: string;
  slot: number;
  snap: KartSnapshot;
  lastSnapAt: number;
  index: number;
  progress: number;
  finishedAt: number | null;   // race ms, decided by the server
  ready: boolean;
  connected: boolean;
}

/**
 * One race lobby. The server is the referee: it runs the countdown, counts laps
 * from the positions players report (rejecting impossible jumps), and decides
 * finishing order and results. Players only send where their kart is.
 */
export class RaceRoom extends Room {
  maxClients = MAX_PLAYERS;
  private players = new Map<string, Player>();
  private phase: RoomPhase = 'lobby';
  private hostId = '';
  private raceStartedAt = 0;
  private raceId = 0;
  private firstFinishAt = 0;
  private isPublic = false;
  private autoStartAt = 0;
  private lastResults: ResultRow[] | null = null;
  /** Power-ups: boxes, held items, shields and jellies. The server decides all of it. */
  private track: TrackDef = MEADOW_LOOP;
  private route: Route = ROUTES.get(MEADOW_LOOP.id)!;
  private get N() { return this.route.path.pts.length; }
  private items = new ItemWorld(this.route.path, MEADOW_LOOP.roadHalfWidth);

  /** Change track between races: new centre line for lap counting and new item boxes. */
  private setTrack(def: TrackDef) {
    if (def.id === this.track.id) return;
    this.track = def; this.route = ROUTES.get(def.id)!;
    this.items = new ItemWorld(this.route.path, def.roadHalfWidth);
  }
  /** Quick races: the next track from the shuffled deck (every track comes up before any repeats). */
  private randomTrack(fresh = false) { this.setTrack(nextQuickTrack(fresh ? undefined : this.track.id)); }

  onCreate(options: { public?: boolean } = {}) {
    this.isPublic = !!options.public;
    if (this.isPublic) this.randomTrack(true);
    // Codes made on the Europe server start with E, so the game knows where to join them.
    const pick = (letters: string) => letters[Math.floor(Math.random() * letters.length)];
    const first = REGION === 'eu' ? 'E' : pick(CODE_LETTERS.replace('E', ''));
    this.roomId = first + Array.from({ length: 4 }, () => pick(CODE_LETTERS)).join('');
    this.autoDispose = true;

    this.onMessage('start', (client: Client) => { if (client.sessionId === this.hostId && this.everyoneReady()) this.startRace(); });
    // Host picks the track while waiting (not mid-race).
    this.onMessage('track', (client: Client, id: unknown) => {
      const def = TRACKS.find((t) => t.id === id);
      if (def && client.sessionId === this.hostId && !this.isPublic && (this.phase === 'lobby' || this.phase === 'results')) this.setTrack(def);
    });
    this.onMessage('ready', (client: Client, on: unknown) => {
      const p = this.players.get(client.sessionId);
      if (p && (this.phase === 'lobby' || this.phase === 'results')) p.ready = on === true;
    });
    this.onMessage('snap', (client: Client, msg: unknown) => this.onSnap(client, msg));
    this.onMessage('item:pick', (client: Client, box: unknown) => this.onPick(client, box));
    this.onMessage('item:use', (client: Client) => this.onUse(client));
    this.onMessage('item:hit', (client: Client, hazard: unknown) => this.onHit(client, hazard));
    // automated tests only (never set on the live server): hand a racer a chosen item
    if (process.env.TR_TEST_ITEMS === '1') this.onMessage('test:give', (client: Client, item: unknown) => { if (typeof item === 'string') this.items.give(client.sessionId, item); });
    // Change racer while waiting in the lobby (not mid-race). Several players may pick the same one.
    this.onMessage('character', (client: Client, id: unknown) => {
      const p = this.players.get(client.sessionId);
      if (p && isCharacterId(id) && (this.phase === 'lobby' || this.phase === 'results')) p.character = id;
    });
    this.clock.setInterval(() => this.tick(), 50);   // 20 updates a second
  }

  onJoin(client: Client, options: { name?: unknown; character?: unknown } = {}) {
    if (this.phase !== 'lobby' && this.phase !== 'results') throw new Error('race_in_progress');
    const name = String(options.name ?? 'Racer').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 14) || 'Racer';
    const used = new Set([...this.players.values()].map((p) => p.slot));
    let slot = 0; while (used.has(slot)) slot++;
    this.players.set(client.sessionId, {
      id: client.sessionId, name, slot,
      character: isCharacterId(options.character) ? options.character : CHARACTERS[slot % CHARACTERS.length].id,
      snap: { x: 0, y: 0, z: 0, yaw: 0, speed: 0, drift: 0 }, lastSnapAt: 0, index: 0, progress: 0, finishedAt: null,
      ready: false, connected: true,
    });
    if (!this.hostId) this.hostId = client.sessionId;
    client.send('welcome', { you: client.sessionId, code: this.roomId });
    console.log(`  ${name} joined room ${this.roomId} (${this.players.size}/${MAX_PLAYERS})`);
  }

  /** Connection lost without pressing Leave (Wi-Fi blip, laptop sleep): keep their place for a while. */
  onDrop(client: Client) {
    const p = this.players.get(client.sessionId);
    if (!p) return;
    p.connected = false;
    this.notice(`${p.name} lost connection. Waiting up to ${RECONNECT_SECONDS} s for them…`, client);
    console.log(`  ${p.name} dropped from room ${this.roomId}`);
    this.allowReconnection(client, RECONNECT_SECONDS);
  }

  onReconnect(client: Client) {
    const p = this.players.get(client.sessionId);
    if (!p) return;
    p.connected = true;
    p.lastSnapAt = 0;   // don't treat the gap as a teleport
    client.send('welcome', { you: client.sessionId, code: this.roomId });
    if (this.phase === 'results' && this.lastResults) client.send('race:results', { raceId: this.raceId, results: this.lastResults });
    this.notice(`${p.name} is back.`, client);
    console.log(`  ${p.name} reconnected to room ${this.roomId}`);
  }

  onLeave(client: Client) {
    const p = this.players.get(client.sessionId);
    this.players.delete(client.sessionId);
    this.items.remove(client.sessionId);
    if (this.hostId === client.sessionId) {
      this.hostId = [...this.players.keys()][0] ?? '';
      const next = this.players.get(this.hostId);
      if (p && next) this.notice(`${p.name} (the host) left. ${next.name} is now the host.`);
    } else if (p) this.notice(`${p.name} left the room.`);
    if (p) console.log(`  ${p.name} left room ${this.roomId}`);
    if (this.phase === 'racing') this.checkRaceOver();
    if (this.players.size > 0 && this.phase !== 'racing' && this.phase !== 'countdown') this.unlock();
  }

  /** A short message shown to everyone (or everyone except `except`). */
  private notice(text: string, except?: Client) {
    this.broadcast('notice', { text }, except ? { except } : undefined);
  }

  /**
   * The host may start once every other connected player pressed Ready.
   * Straight after a race (results screen) the Rematch button works without it.
   */
  private everyoneReady() {
    if (this.phase === 'results') return true;
    return [...this.players.values()].every((p) => p.id === this.hostId || p.ready || !p.connected);
  }

  private startRace() {
    if (this.phase !== 'lobby' && this.phase !== 'results') return;
    if (this.phase === 'lobby' && [...this.players.values()].some((p) => !p.connected)) return;   // wait for dropped players
    this.autoStartAt = 0;
    this.raceId++;
    this.phase = 'countdown';
    this.lock();   // nobody joins mid-race
    const back = 12, N = this.N;
    for (const p of this.players.values()) {
      p.index = (N - back - Math.floor(p.slot / 2) * 6 + N) % N;
      p.progress = -(back + Math.floor(p.slot / 2) * 6);
      p.finishedAt = null; p.lastSnapAt = 0; p.ready = false;
    }
    this.lastResults = null;
    this.items.reset();
    this.broadcast('race:start', { raceId: this.raceId, track: this.track.id, countdown: COUNTDOWN_SECONDS, grid: Object.fromEntries([...this.players.values()].map((p) => [p.id, p.slot])) });
    this.clock.setTimeout(() => {
      if (this.phase !== 'countdown') return;
      this.phase = 'racing'; this.raceStartedAt = this.clock.currentTime; this.firstFinishAt = 0;
      this.broadcast('race:go', { raceId: this.raceId });
    }, COUNTDOWN_SECONDS * 1000);
  }

  private onSnap(client: Client, msg: unknown) {
    const p = this.players.get(client.sessionId);
    if (!p || typeof msg !== 'object' || msg === null) return;
    const m = msg as Record<string, unknown>;
    const nums = ['x', 'y', 'z', 'yaw', 'speed'].map((k) => Number(m[k]));
    if (nums.some((v) => !Number.isFinite(v))) return;
    const [x, y, z, yaw, speed] = nums;
    const drift = (m.drift === 1 || m.drift === -1 ? m.drift : 0) as -1 | 0 | 1;
    const now = this.clock.currentTime;
    const t = Number(m.t);
    const sentAt = Number.isFinite(t) ? +t.toFixed(3) : undefined;

    if (this.phase === 'racing' && p.finishedAt === null && p.lastSnapAt > 0) {
      // Over long distances updates often arrive in bunches, so the time between arrivals
      // says little. Use the sender's own timestamps, but never more than the real time
      // since the last update plus half a second.
      const serverDt = (now - p.lastSnapAt) / 1000;
      const sentDt = sentAt !== undefined && p.snap.t !== undefined ? sentAt - p.snap.t : 0;
      const dt = Math.max(0.03, serverDt, Math.min(sentDt, serverDt + 0.5));
      const moved = Math.hypot(x - p.snap.x, z - p.snap.z);
      const near = locate(this.route, x, z, p.index);
      const isRespawn = near.dist < 1.5 && Math.abs(indexDelta(this.route.path, p.index, near.i)) < 40;
      if (moved / dt > MAX_SPEED && !isRespawn) {
        client.send('correct', { x: p.snap.x, z: p.snap.z, yaw: p.snap.yaw });  // impossible jump: put them back
        return;
      }
    }
    p.snap = { x, y, z, yaw, speed, drift, t: sentAt };
    p.lastSnapAt = now;

    if (this.phase === 'racing' && p.finishedAt === null) {
      const near = locate(this.route, x, z, p.index);
      p.progress += indexDelta(this.route.path, p.index, near.i);
      p.index = near.i;
      if (p.progress >= LAPS * this.N) {
        p.finishedAt = now - this.raceStartedAt;
        if (!this.firstFinishAt) this.firstFinishAt = now;
        this.broadcast('race:finish', { id: p.id, time: p.finishedAt, place: this.ranking().findIndex((r) => r.id === p.id) + 1 });
        this.checkRaceOver();
      }
    }
  }

  // ---------- power-ups ----------
  private racing(p: Player | undefined): p is Player { return !!p && this.phase === 'racing' && p.finishedAt === null; }

  private onPick(client: Client, box: unknown) {
    const p = this.players.get(client.sessionId);
    if (!this.racing(p) || typeof box !== 'number') return;
    const order = this.ranking();
    const item = this.items.pick(p.id, box, this.clock.currentTime, p.snap.x, p.snap.z, order.indexOf(p) + 1, order.length);
    if (item) client.send('item:got', { item, uses: this.items.held(p.id)?.uses ?? 1 } satisfies ItemGotMessage);
  }

  private onUse(client: Client) {
    const p = this.players.get(client.sessionId);
    if (!this.racing(p)) return;
    const order = this.ranking().filter((o) => o.finishedAt === null);
    const ahead = order.slice(0, order.indexOf(p)).map((o) => o.id);
    const r = this.items.use(p.id, this.clock.currentTime, p.snap.x, p.snap.z, p.snap.yaw, ahead, p.snap.y - 0.75);
    if (r) this.broadcast('item:used', { id: p.id, item: r.item, usesLeft: r.usesLeft, hazard: r.hazard, thunder: r.thunder } satisfies ItemUsedMessage);
  }

  private onHit(client: Client, hazard: unknown) {
    const p = this.players.get(client.sessionId);
    if (!this.racing(p) || typeof hazard !== 'number') return;
    const r = this.items.hit(p.id, hazard, this.clock.currentTime);
    if (r) this.broadcast('item:hit', r satisfies ItemHitMessage);
  }

  private ranking(): Player[] {
    return [...this.players.values()].sort((a, b) => {
      if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt;
      if (a.finishedAt !== null) return -1;
      if (b.finishedAt !== null) return 1;
      return b.progress - a.progress;
    });
  }

  private checkRaceOver() {
    const all = [...this.players.values()];
    const everyoneDone = all.length > 0 && all.every((p) => p.finishedAt !== null);
    const graceOver = this.firstFinishAt > 0 && this.clock.currentTime - this.firstFinishAt > FINISH_GRACE_MS;
    if (this.phase === 'racing' && (everyoneDone || graceOver)) {
      this.phase = 'results';
      const results: ResultRow[] = this.ranking().map((p, i) => ({ id: p.id, name: p.name, character: p.character, place: i + 1, time: p.finishedAt }));
      this.lastResults = results;
      this.broadcast('race:results', { raceId: this.raceId, results });
      this.unlock();
      if (this.isPublic) this.randomTrack();
    }
  }

  private tick() {
    if (this.phase === 'racing') this.checkRaceOver();
    // Quick race rooms start by themselves once at least two racers are waiting.
    if (this.isPublic && (this.phase === 'lobby' || this.phase === 'results')) {
      const now = this.clock.currentTime;   // eslint-disable-line no-shadow
      if (this.players.size < 2) this.autoStartAt = 0;
      else if (!this.autoStartAt) this.autoStartAt = now + (this.phase === 'results' ? 20_000 : 15_000);
      else if (now >= this.autoStartAt) this.startRace();
    }
    const now = this.clock.currentTime;
    this.items.tick(now);
    const order = this.ranking();
    const players: PlayerView[] = order.map((p, i) => ({
      id: p.id, name: p.name, character: p.character, slot: p.slot, ...p.snap,
      lap: Math.min(LAPS, Math.max(1, Math.floor(p.progress / this.N) + 1)), place: i + 1, finished: p.finishedAt !== null,
      ready: p.ready, connected: p.connected, shield: this.items.shielded(p.id, now),
    }));
    const autoStartIn = this.autoStartAt ? Math.max(0, Math.ceil((this.autoStartAt - this.clock.currentTime) / 1000)) : null;
    const world: WorldMessage = { phase: this.phase, hostId: this.hostId, code: this.roomId, raceId: this.raceId, isPublic: this.isPublic, track: this.track.id, autoStartIn, players,
      items: { hidden: this.items.hiddenBoxes(now), hazards: this.items.hazards } };
    this.broadcast('world', world);
  }
}
