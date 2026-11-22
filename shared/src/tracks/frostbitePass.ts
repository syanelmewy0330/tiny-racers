import type { TrackDef } from './meadowLoop';

/**
 * Frostbite Pass: the second track (test). A snowy mountain pass at blue hour, with a
 * hairpin around a frozen lake, ice patches on two corners and a tunnel on the back straight.
 */
export const FROSTBITE_PASS: TrackDef = {
  id: 'frostbite-pass',
  name: 'Frostbite Pass',
  theme: 'frost',
  points: [
    [0, 64], [0, -26], [32, -66], [92, -60], [112, -12], [158, -6], [184, -52],
    [226, -44], [228, 32], [184, 66], [132, 54], [100, 86], [46, 94],
  ],
  roadHalfWidth: 7.5,
  shoulder: 4,
  boostPads: [0.15, 0.45, 0.6, 0.88],
  ramps: [{ t: 0.07, side: -1 }, { t: 0.68, side: 1 }],
  // snow piles (they work like hay bales)
  hayBales: [{ t: 0.22, side: 1 }, { t: 0.31, side: -1 }, { t: 0.72, side: -1 }, { t: 0.95, side: 1 }],
  icePatches: [{ t: 0.39, len: 22, side: 0 }, { t: 0.77, len: 24, side: 1 }],
  tunnel: { from: 0.565, to: 0.625 },
};
