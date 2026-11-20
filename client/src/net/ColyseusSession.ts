import { Client, type Room } from '@colyseus/sdk';
import type { KartSnapshot } from '@shared/types';
import type { WorldMessage, ResultRow } from '@shared/protocol';
import type { RaceSession } from './Network';

export interface SessionEvents {
  world?: (w: WorldMessage) => void;
  raceStart?: (d: { raceId: number; countdown: number; grid: Record<string, number> }) => void;
  go?: () => void;
  finish?: (d: { id: string; time: number; place: number }) => void;
  results?: (rows: ResultRow[]) => void;
  correct?: (d: { x: number; z: number; yaw: number }) => void;
  closed?: (reason: string) => void;
}

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
    room.onLeave((code: number) => { if (!this.leaving) this.events.closed?.(`Lost connection to the race server (code ${code}).`); });
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

  /** Pick a different racer while in the lobby. */
  setCharacter(id: string) { this.room.send('character', id); }

  sendSnapshot(s: KartSnapshot) {
    this.room.send('snap', {
      x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2),
      yaw: +s.yaw.toFixed(3), speed: +s.speed.toFixed(1), drift: s.drift,
    });
  }

  leave() { this.leaving = true; this.room.leave(true).catch(() => {}); }
}
