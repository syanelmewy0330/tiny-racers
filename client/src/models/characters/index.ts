import type { CharacterRig } from './rig';
import { buildBubbles } from './bubbles';
import { buildTaco } from './taco';
import { buildNimbus } from './nimbus';
import { buildPeanut } from './peanut';

const builders: Record<string, () => CharacterRig> = {
  bubbles: buildBubbles,
  taco: buildTaco,
  nimbus: buildNimbus,
  peanut: buildPeanut,
};

/** Build a fresh character model by id (falls back to Bubbles). */
export function buildCharacter(id: string): CharacterRig {
  return (builders[id] ?? buildBubbles)();
}
export type { CharacterRig } from './rig';
