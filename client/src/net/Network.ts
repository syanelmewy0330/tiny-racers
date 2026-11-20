import type { KartSnapshot } from '@shared/types';

/**
 * The game talks to "a session" instead of directly to a server.
 * Milestone 1 uses OfflineSession. Milestone 2 adds a ColyseusSession with the
 * same shape, so the game code does not need rebuilding for multiplayer.
 */
export interface RaceSession {
  readonly online: boolean;
  /** Send my kart's latest state (called about 20 times a second). */
  sendSnapshot(s: KartSnapshot): void;
  /** Other racers' latest states, keyed by player id. */
  remoteKarts(): ReadonlyMap<string, KartSnapshot>;
  leave(): void;
}

export class OfflineSession implements RaceSession {
  readonly online = false;
  private empty = new Map<string, KartSnapshot>();
  sendSnapshot(_s: KartSnapshot) { /* nobody to send to */ }
  remoteKarts() { return this.empty; }
  leave() {}
}
