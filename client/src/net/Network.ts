import type { KartSnapshot } from '@shared/types';

/**
 * The game talks to "a session" instead of directly to a server.
 * OfflineSession is used for practice. ColyseusSession (net/ColyseusSession.ts)
 * has the same shape plus room events, so the race code is shared.
 */
export interface RaceSession {
  readonly online: boolean;
  /** Send my kart's latest state (called about 20 times a second). */
  sendSnapshot(s: KartSnapshot): void;
  leave(): void;
}

export class OfflineSession implements RaceSession {
  readonly online = false;
  sendSnapshot(_s: KartSnapshot) { /* nobody to send to */ }
  leave() {}
}
