import { characterById, isCharacterId, type CharacterDef } from '@shared/characters';
import { cleanLoadout, type Loadout } from '@shared/karts';

const KEY = 'tr-character', LOADOUT_KEY = 'tr-loadout';

/** The racer, kart and paint this player picked last time (remembered in the browser). */
export function savedLoadout(): Loadout {
  let raw: unknown = null, legacy: string | null = null;
  try { raw = JSON.parse(localStorage.getItem(LOADOUT_KEY) ?? 'null'); legacy = localStorage.getItem(KEY); } catch { /* private mode or bad data */ }
  return cleanLoadout(raw as Partial<Loadout> | null, isCharacterId(legacy) ? legacy : 'bubbles');
}

export function saveLoadout(l: Loadout) {
  try { localStorage.setItem(LOADOUT_KEY, JSON.stringify(l)); localStorage.setItem(KEY, l.character); } catch { /* private mode */ }
}

/** The racer this player picked last time. */
export const savedCharacter = (): CharacterDef['id'] => savedLoadout().character;

/** Remember a new racer, keeping the kart and paint. */
export function saveCharacter(id: string) {
  if (isCharacterId(id)) saveLoadout({ ...savedLoadout(), character: id });
}

/** Portrait image path. Relative, because the game can be served from any folder. */
export const portraitUrl = (id: string) => `characters/${characterById(id).id}.jpg`;

export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

/** Five-segment stat bar (values may be halves, e.g. 3.5). */
export function statBar(v: number) {
  let cells = '';
  for (let i = 1; i <= 5; i++) cells += `<i class="${v >= i ? 'on' : v >= i - 0.5 ? 'half' : ''}"></i>`;
  return `<div class="bar" role="img" aria-label="${v} out of 5">${cells}</div>`;
}
