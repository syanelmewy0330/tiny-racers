/** Messages between the game and the race server. Plain JSON, sent over Colyseus. */
import type { KartSnapshot } from './types';

export type RoomPhase = 'lobby' | 'countdown' | 'racing' | 'results';

export interface PlayerView extends KartSnapshot {
  id: string;
  name: string;
  character: string;
  kart: string;
  paint: number;
  slot: number;
  lap: number;
  place: number;
  finished: boolean;
  /** Waiting room: this player pressed Ready. */
  ready: boolean;
  /** False while the player's connection has dropped and the server is holding their place. */
  connected: boolean;
}

/** Sent by the server 20 times a second to everyone in the room. */
export interface WorldMessage {
  phase: RoomPhase;
  hostId: string;
  code: string;
  raceId: number;
  /** Quick race (public matchmaking) instead of a private code room. */
  isPublic: boolean;
  /** Seconds until a Quick race starts by itself, or null. */
  autoStartIn: number | null;
  players: PlayerView[];
}

export interface ResultRow { id: string; name: string; character: string; place: number; time: number | null }
