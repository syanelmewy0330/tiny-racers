import type { CharacterDef } from '@shared/characters';
import { signatureKart } from '@shared/karts';
import { KartModel } from './KartModel';

/** What the game needs from a racer's 3D model. */
export type RacerModel = KartModel;

/** A character in a kart (their signature kart unless another is given). */
export function createRacerModel(ch: CharacterDef, kart: string = signatureKart(ch.id).id, paint = 0): RacerModel {
  return new KartModel(ch, kart, paint);
}
