/** Messages between the game and the race server. Plain JSON, sent over Colyseus. */
import type { KartSnapshot } from './types';
import type { Hazard, ItemId, ThunderHit } from './items';

export type RoomPhase = 'lobby' | 'countdown' | 'racing' | 'results';

export interface PlayerView extends KartSnapshot {
  id: string;
  name: string;
  character: string;
  slot: number;
  lap: number;
  place: number;
  finished: boolean;
  /** Waiting room: this player pressed Ready. */
  ready: boolean;
  /** False while the player's connection has dropped and the server is holding their place. */
  connected: boolean;
  /** Bubble Shield is up. */
  shield: boolean;
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
  /** Item boxes currently broken (coming back soon) and banana peels on the track. */
  items: { hidden: number[]; hazards: Hazard[] };
}

/** Server to the racer who drove through a box. */
export interface ItemGotMessage { item: ItemId; uses: number }
/** Server to everyone when a racer uses an item. */
export interface ItemUsedMessage { id: string; item: ItemId; usesLeft: number; hazard?: Hazard; thunder?: ThunderHit[] }
/** Server to everyone when a racer hits a banana peel (blocked = their shield took it). */
export interface ItemHitMessage { victim: string; hazard: number; kind: 'banana' | 'bounce' | 'rocket' | 'star'; blocked: boolean }

export interface ResultRow { id: string; name: string; character: string; place: number; time: number | null }
