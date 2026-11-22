import * as THREE from 'three';
import type { TrackDef } from '@shared/tracks/meadowLoop';
import { MEADOW_LOOP } from '@shared/tracks/meadowLoop';
import { FROSTBITE_PASS } from '@shared/tracks/frostbitePass';
import { LANTERN_GROVE } from '@shared/tracks/lanternGrove';

/** Every track you can pick, in picker order. */
export const TRACKS: TrackDef[] = [MEADOW_LOOP, FROSTBITE_PASS, LANTERN_GROVE];
export const trackById = (id: unknown): TrackDef => TRACKS.find((t) => t.id === id) ?? MEADOW_LOOP;

const KEY = 'tr-track';
/** The track picked last time for practice (remembered in the browser). ?track=frostbite still works for testing. */
export function savedTrack(): TrackDef {
  const q = new URLSearchParams(location.search).get('track');
  if (q === 'frostbite') return FROSTBITE_PASS;
  if (q === 'grove') return LANTERN_GROVE;
  let id: string | null = null;
  try { id = localStorage.getItem(KEY); } catch { /* private mode */ }
  return trackById(id);
}
export function saveTrack(id: string) { try { localStorage.setItem(KEY, id); } catch { /* private mode */ } }

export interface Theme {
  haze: number; sunDir: THREE.Vector3; sunColor: number; sunPower: number;
  hemiSky: number; hemiGround: number; hemiPower: number; fogNear: number; fogFar: number;
  skyTop: [number, number, number]; skyMid: [number, number, number]; sunGlow: [number, number, number];
  mountainRock: [number, number]; mountainSnow: [number, number]; snowLine: number;
  ground: number; shoulder: number; curb: [number, number]; road: [number, number]; walls: [number, number];
  /** little decorations on ramps and obstacles (petals, or snow) */
  decor: number[];
  exposure: number;
}

const MEADOW: Theme = {
  haze: 0xf6dcc4, sunDir: new THREE.Vector3(0.55, 0.42, 0.72).normalize(), sunColor: 0xffd9a6, sunPower: 2.6,
  hemiSky: 0xcfe3ff, hemiGround: 0x6f6148, hemiPower: 0.95, fogNear: 220, fogFar: 900,
  skyTop: [0.20, 0.42, 0.78], skyMid: [0.48, 0.70, 0.93], sunGlow: [1.0, 0.78, 0.5],
  mountainRock: [0x5d6f9e, 0x7484b3], mountainSnow: [0xe9eef7, 0xf2f5fb], snowLine: 0.72,
  ground: 0x74b552, shoulder: 0x7cc25a, curb: [0xffffff, 0xff4f79], road: [0x5d5672, 0x605977], walls: [0xffffff, 0x4cc9f0],
  decor: [0xf7b6c8, 0xf9c9d6, 0xee9fb6],
  exposure: 0.95,
};

/** Blue hour in the mountains: Sky Blue + Lavender light, a last orange glow low on the horizon. */
const FROST: Theme = {
  haze: 0xb7bfe0, sunDir: new THREE.Vector3(-0.6, 0.34, 0.72).normalize(), sunColor: 0xffbf94, sunPower: 1.9,
  hemiSky: 0xa9c2ff, hemiGround: 0x6b7194, hemiPower: 1.35, fogNear: 160, fogFar: 760,
  skyTop: [0.07, 0.09, 0.26], skyMid: [0.30, 0.34, 0.66], sunGlow: [1.0, 0.55, 0.32],
  mountainRock: [0x39456a, 0x4c5684], mountainSnow: [0xe4ebf8, 0xeef2fb], snowLine: 0.45,
  ground: 0xe6edf8, shoulder: 0xd6e0ef, curb: [0xf2f2f0, 0x6ca9e6], road: [0x434a5c, 0x464e60], walls: [0xf2f2f0, 0x8f84d9],
  decor: [0xffffff, 0xe3eeff, 0xc9dcf5],
  exposure: 1.0,
};

/** Moonlit forest: deep blue night, a big pale moon, warm lantern light, Sage greens. */
const GROVE: Theme = {
  haze: 0x232a48, sunDir: new THREE.Vector3(0.5, 0.38, -0.78).normalize(), sunColor: 0xb8c8ff, sunPower: 1.25,
  hemiSky: 0x7183c9, hemiGround: 0x22302a, hemiPower: 0.8, fogNear: 110, fogFar: 560,
  skyTop: [0.015, 0.02, 0.07], skyMid: [0.06, 0.08, 0.2], sunGlow: [0.55, 0.62, 0.9],
  mountainRock: [0x161b2e, 0x1b2138], mountainSnow: [0x262e4a, 0x2a3352], snowLine: 0.85,
  ground: 0x2a4636, shoulder: 0x34553f, curb: [0xf2f2f0, 0x7aa58a], road: [0x54483b, 0x574a3d], walls: [0xe9dcc0, 0x7a5636],
  decor: [0xfcc945, 0xffe39a, 0x7aa58a],
  exposure: 1.05,
};

/** The colours in use right now. Changed in place by `useTrack`, so everything reads the current track's look. */
export const THEME: Theme = { ...MEADOW, sunDir: MEADOW.sunDir.clone() };
export const SUN_DIR = new THREE.Vector3().copy(MEADOW.sunDir);
export const HAZE = new THREE.Color(MEADOW.haze);
/** The track being driven right now. */
export let TRACK: TrackDef = MEADOW_LOOP;
export const isFrost = () => TRACK.theme === 'frost';
export const isGrove = () => TRACK.theme === 'grove';

/** Switch the current track and its colours. Builders called after this use the new look. */
export function useTrack(def: TrackDef) {
  TRACK = def;
  const t = def.theme === 'frost' ? FROST : def.theme === 'grove' ? GROVE : MEADOW;
  Object.assign(THEME, t, { sunDir: t.sunDir.clone() });
  SUN_DIR.copy(t.sunDir); HAZE.set(t.haze);
}
