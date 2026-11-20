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
      { name: 'Hot Sauce', body: 0xe8473f, trim: 0xfff1d6 },
      { name: 'Mustard', body: 0xf2b632, trim: 0x8a3b26 },
      { name: 'Avocado', body: 0x8cc84b, trim: 0x4a3426 },
      { name: 'Blueberry', body: 0x5b7fe0, trim: 0xfff1d6 },
    ],
  },
  {
    id: 'calculatron', name: 'Calculatron', owner: 'nimbus',
    description: 'Clean lines, glowing blue circuits and perfectly calculated cornering.',
    mods: { speed: -1, acceleration: 0, handling: 1 },
    paints: [
      { name: 'Lab Coat', body: 0xf3f5fb, trim: 0x3d8bff },
      { name: 'Lavender', body: 0xb7a3f5, trim: 0x3d8bff },
      { name: 'Graphite', body: 0x4a4f63, trim: 0x55e0ff },
      { name: 'Sky Grid', body: 0x9fd8ff, trim: 0x2f4bd6 },
    ],
  },
  {
    id: 'little-disaster', name: 'Little Disaster', owner: 'peanut',
    description: 'Huge wing, huge exhausts, held together with tape. Very fast, a little wild.',
    mods: { speed: 1, acceleration: 0, handling: -1 },
    paints: [
      { name: 'Wildfire', body: 0xf07a2a, trim: 0x2c2a35 },
      { name: 'Toxic Lime', body: 0xb8e03c, trim: 0x2c2a35 },
      { name: 'Chaos Teal', body: 0x2fb5a3, trim: 0xf07a2a },
      { name: 'Grape Soda', body: 0x8b4fd8, trim: 0xffd23f },
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
