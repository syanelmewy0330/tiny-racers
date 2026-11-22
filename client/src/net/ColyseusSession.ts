import { Client, type Room } from '@colyseus/sdk';
import type { KartSnapshot } from '@shared/types';
import type { WorldMessage, ResultRow, ItemGotMessage, ItemUsedMessage, ItemHitMessage } from '@shared/protocol';
import type { RaceSession } from './Network';

export interface SessionEvents {
  world?: (w: WorldMessage) => void;
  raceStart?: (d: { raceId: number; countdown: number; grid: Record<string, number>; track?: string }) => void;
  go?: () => void;
  finish?: (d: { id: string; time: number; place: number }) => void;
  results?: (rows: ResultRow[]) => void;
  correct?: (d: { x: number; z: number; yaw: number }) => void;
  closed?: (reason: string) => void;
  /** Short messages from the server, such as "Sam left the room". */
  notice?: (text: string) => void;
  /** The connection dropped (true) or came back (false). */
  reconnecting?: (on: boolean) => void;
  /** Power-ups: you got an item, someone used one, someone hit a banana peel. */
  itemGot?: (d: ItemGotMessage) => void;
  itemUsed?: (d: ItemUsedMessage) => void;
  itemHit?: (d: ItemHitMessage) => void;
}

export type ConnectionState = 'online' | 'reconnecting';

/**
 * Where the race server is. Online, the server also hands out the game, so it is
 * the same address. While developing (Vite on port 5173) it is port 2567 on the same computer.
 */
export function defaultServerUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  if (location.port === '5173' || !location.host) return `${proto}://${location.hostname || 'localhost'}:2567`;
  return `${proto}://${location.host}`;
}

export class ColyseusSession implements RaceSession {
  readonly online = true;
  me = '';
  code = '';
  latest: WorldMessage | null = null;
  events: SessionEvents = {};
  private leaving = false;
  /** Round-trip time to the server in ms, measured every 2 s. */
  pingMs: number | null = null;
  connection: ConnectionState = 'online';
  /** Most recent server notice, for the lobby to show. */
  lastNotice: { text: string; at: number } | null = null;
  private pingTimer = 0;

  private constructor(private room: Room) {
    this.code = room.roomId;
    this.me = room.sessionId;
    room.onMessage('welcome', (d: { you: string; code: string }) => { this.me = d.you; this.code = d.code; });
    room.onMessage('world', (w: WorldMessage) => { this.latest = w; this.events.world?.(w); });
    room.onMessage('race:start', (d) => this.events.raceStart?.(d));
    room.onMessage('race:go', () => this.events.go?.());
    room.onMessage('race:finish', (d) => this.events.finish?.(d));
    room.onMessage('race:results', (d: { results: ResultRow[] }) => this.events.results?.(d.results));
    room.onMessage('correct', (d) => this.events.correct?.(d));
    room.onMessage('item:got', (d: ItemGotMessage) => this.events.itemGot?.(d));
    room.onMessage('item:used', (d: ItemUsedMessage) => this.events.itemUsed?.(d));
    room.onMessage('item:hit', (d: ItemHitMessage) => this.events.itemHit?.(d));
    room.onMessage('notice', (d: { text: string }) => { this.lastNotice = { text: d.text, at: performance.now() }; this.events.notice?.(d.text); });
    // Colyseus retries by itself when the connection drops; the server keeps our place for 20 s.
    room.onDrop(() => { this.connection = 'reconnecting'; this.pingMs = null; this.events.reconnecting?.(true); });
    room.onReconnect(() => { this.connection = 'online'; this.events.reconnecting?.(false); });
    room.onLeave((code: number) => {
      window.clearInterval(this.pingTimer);
      if (!this.leaving) this.events.closed?.(`Lost connection to the race server (code ${code}). Check your internet and join again.`);
    });
    const ping = () => { if (this.connection === 'online') room.ping((ms) => { this.pingMs = Math.round(ms); }); };
    this.pingTimer = window.setInterval(ping, 2000); ping();
  }

  static async create(serverUrl: string, name: string, character: string): Promise<ColyseusSession> {
    const room = await new Client(serverUrl).create('race', { name, character });
    return new ColyseusSession(room);
  }

  /** Quick race: join any public room that is waiting, or open a new one. */
  static async quick(serverUrl: string, name: string, character: string): Promise<ColyseusSession> {
    const room = await new Client(serverUrl).joinOrCreate('public', { name, character });
    return new ColyseusSession(room);
  }

  static async join(serverUrl: string, code: string, name: string, character: string): Promise<ColyseusSession> {
    const room = await new Client(serverUrl).joinById(code.trim().toUpperCase(), { name, character });
    return new ColyseusSession(room);
  }

  get isHost() { return !!this.latest && this.latest.hostId === this.me; }

  start() { this.room.send('start'); }

  /** Waiting room: tell the host you are ready (or not). */
  setReady(on: boolean) { this.room.send('ready', on); }

  /** Pick a different racer while in the lobby. */
  setCharacter(id: string) { this.room.send('character', id); }
  /** Host only: the track for the next race. */
  setTrack(id: string) { this.room.send('track', id); }

  sendSnapshot(s: KartSnapshot) {
    this.room.send('snap', {
      x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2),
      yaw: +s.yaw.toFixed(3), speed: +s.speed.toFixed(1), drift: s.drift,
      t: +(performance.now() / 1000).toFixed(3),   // lets others replay our moves at the right pace
    });
  }

  /** Power-ups: the server decides what you get and whether hits count. */
  pickBox(box: number) { this.room.send('item:pick', box); }
  useItem() { this.room.send('item:use'); }
  hitHazard(id: number) { this.room.send('item:hit', id); }

  leave() { this.leaving = true; window.clearInterval(this.pingTimer); this.room.leave(true).catch(() => {}); }
}
