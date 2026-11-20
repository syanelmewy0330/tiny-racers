/** Messages between the game and the race server. Plain JSON, sent over Colyseus. */
import type { KartSnapshot } from './types';

export type RoomPhase = 'lobby' | 'countdown' | 'racing' | 'results';

export interface PlayerView extends KartSnapshot {
  id: string;
  name: string;
  character: string;
  slot: number;
  lap: number;
  place: number;
  finished: boolean;
}

/** Sent by the server 20 times a second to everyone in the room. */
export interface WorldMessage {
  phase: RoomPhase;
  hostId: string;
  code: string;
  raceId: number;
  players: PlayerView[];
}

export interface ResultRow { id: string; name: string; character: string; place: number; time: number | null }
