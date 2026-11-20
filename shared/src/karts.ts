import type { CharacterDef } from './characters';

/** One paint job for a kart. Paint is cosmetic only: it never changes how the kart drives. */
export interface PaintDef { name: string; body: number; trim: number }

export type KartId = 'zoomie' | 'snack-mobile' | 'calculatron' | 'little-disaster';

/**
 * The four signature karts. Any racer may drive any kart.
 * `mods` nudge the driver's stats; every kart's mods add up to zero, so no kart is simply better.
 */
export interface KartDef {
  id: KartId;
  name: string;
  owner: CharacterDef['id'];
  description: string;
  mods: { speed: number; acceleration: number; handling: number };
  paints: PaintDef[];
}

export const KARTS: KartDef[] = [
  {
    id: 'zoomie', name: 'Zoomie', owner: 'bubbles',
    description: 'A compact yellow rocket that jumps off the line before anyone else has blinked.',
    mods: { speed: -1, acceleration: 1, handling: 0 },
    paints: [
      { name: 'Racing Yellow', body: 0xf2bf2e, trim: 0x252638 },
      { name: 'Coral Rush', body: 0xf05b65, trim: 0x252638 },
      { name: 'Sage Sprint', body: 0x6e9b91, trim: 0x252638 },
      { name: 'Midnight', body: 0x30324a, trim: 0xe5a94b },
    ],
  },
  {
    id: 'snack-mobile', name: 'Snack Mobile', owner: 'taco',
    description: 'A tiny food truck with a big engine. Slow to get going, hard to catch once it is rolling.',
    mods: { speed: 1, acceleration: -1, handling: 0 },
    paints: [
      { name: 'Hot Sauce', body: 0xd9403f, trim: 0x252638 },
      { name: 'Mustard', body: 0xe5a94b, trim: 0x252638 },
      { name: 'Sage Salad', body: 0x6e9b91, trim: 0x252638 },
      { name: 'Midnight Diner', body: 0x30324a, trim: 0xd9403f },
    ],
  },
  {
    id: 'calculatron', name: 'Calculatron', owner: 'nimbus',
    description: 'Clean lines, glowing blue circuits and perfectly calculated cornering.',
    mods: { speed: -1, acceleration: 0, handling: 1 },
    paints: [
      { name: 'Lab White', body: 0xeef1f7, trim: 0x2f7de1 },
      { name: 'Slate', body: 0x8790b8, trim: 0x63d2ff },
      { name: 'Graphite', body: 0x30324a, trim: 0x63d2ff },
      { name: 'Sage Circuit', body: 0x6e9b91, trim: 0xeef1f7 },
    ],
  },
  {
    id: 'little-disaster', name: 'Little Disaster', owner: 'peanut',
    description: 'Huge wing, huge exhausts, held together with tape. Very fast, a little wild.',
    mods: { speed: 1, acceleration: 0, handling: -1 },
    paints: [
      { name: 'Wildfire', body: 0xee7a2a, trim: 0x252638 },
      { name: 'Coral Chaos', body: 0xf05b65, trim: 0x252638 },
      { name: 'Midnight Menace', body: 0x30324a, trim: 0xee7a2a },
      { name: 'Amber Alert', body: 0xe5a94b, trim: 0x252638 },
    ],
  },
];

export const kartById = (id: string): KartDef => KARTS.find((k) => k.id === id) ?? KARTS[0];
export const isKartId = (id: unknown): id is KartId => typeof id === 'string' && KARTS.some((k) => k.id === id);
export const signatureKart = (character: string): KartDef => KARTS.find((k) => k.owner === character) ?? KARTS[0];
export const isPaintIndex = (kart: string, i: unknown): i is number =>
  typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < kartById(kart).paints.length;

/** What a player drives: character + kart + paint. Sent to the server and shown to everyone. */
export interface Loadout { character: CharacterDef['id']; kart: KartId; paint: number }

/** Effective 1..5-ish stats for a character in a kart. Each kart mod point is worth half a stat point. */
export function combinedStats(ch: CharacterDef, kart: KartDef) {
  return {
    speed: ch.stats.speed + kart.mods.speed * 0.5,
    acceleration: ch.stats.acceleration + kart.mods.acceleration * 0.5,
    handling: ch.stats.handling + kart.mods.handling * 0.5,
  };
}
