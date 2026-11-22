import type { TrackDef } from './meadowLoop';

/**
 * Lantern Grove: the third track (test). A moonlit forest with paper lanterns and fireflies,
 * winding S-bends between giant trees, a wooden bridge over a stream with a jump off the end,
 * and mud patches.
 */
export const LANTERN_GROVE: TrackDef = {
  id: 'lantern-grove',
  name: 'Lantern Grove',
  blurb: 'Moonlit forest of lanterns and fireflies: S-bends, a stream bridge jump and sticky mud.',
  theme: 'grove',
  points: [
    [0, 60], [0, -8], [50, -33], [81, 10], [118, -27], [174, -27], [211, 23],
    [180, 60], [211, 103], [136, 116], [87, 85], [43, 116],
  ],
  roadHalfWidth: 7.5,
  shoulder: 4,
  boostPads: [0.04, 0.3, 0.44, 0.86],
  // the jump off the end of the stream bridge, and one on the long back stretch
  ramps: [{ t: 0.383, side: 1 }, { t: 0.7, side: -1 }],
  // log piles (they work like hay bales)
  hayBales: [{ t: 0.14, side: 1 }, { t: 0.45, side: -1 }, { t: 0.77, side: 1 }, { t: 0.935, side: -1 }],
  mudPatches: [{ t: 0.205, len: 18, side: -1 }, { t: 0.55, len: 20, side: 0 }],
};
