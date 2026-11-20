import type { CharacterDef } from '@shared/characters';
import { signatureKart } from '@shared/karts';
import { KartModel } from './KartModel';
import { LegacyKartModel } from './LegacyKartModel';

/** What the game needs from a racer's 3D model. */
export interface RacerModel {
  readonly ch: CharacterDef;
  readonly root: import('three').Group;
  animate(dt: number, speed: number, steer: number, driftDir: number, driftLevel: number, boosting: boolean, time: number): void;
  setMood(m: 'race' | 'win' | 'lose'): void;
  react(): void;
  dispose(): void;
}

/** Racers rebuilt in the design bible v2.0 style. The rest still use the placeholder model. */
const V2_READY = new Set(['bubbles']);

export function createRacerModel(ch: CharacterDef, kart = signatureKart(ch.id).id, paint = 0): RacerModel {
  return V2_READY.has(ch.id) ? new KartModel(ch, kart, paint) : new LegacyKartModel(ch);
}
