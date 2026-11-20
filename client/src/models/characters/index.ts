import type { CharacterRig } from './rig';
import { buildBubbles } from './bubbles';

const builders: Record<string, () => CharacterRig> = {
  bubbles: buildBubbles,
};

/** Build a fresh character model by id (falls back to Bubbles). */
export function buildCharacter(id: string): CharacterRig {
  return (builders[id] ?? buildBubbles)();
}
export type { CharacterRig } from './rig';
