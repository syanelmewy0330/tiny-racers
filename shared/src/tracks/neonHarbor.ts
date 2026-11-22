import type { TrackDef } from './meadowLoop';

/**
 * Neon Harbor: the fourth track (test). A rainy night at the docks: a figure-8 where one
 * diagonal climbs onto a raised bridge and crosses over the other, neon signs on the
 * warehouses, cranes and shipping containers, and slick rain puddles that make you slide.
 */
export const NEON_HARBOR: TrackDef = {
  id: 'neon-harbor',
  name: 'Neon Harbor',
  blurb: 'Rainy night at the docks: a figure-8 with a bridge crossing, neon signs and slick puddles.',
  theme: 'harbor',
  points: [[0, -56], [98, -56], [195, 56], [248, 56], [248, -56], [195, -56], [98, 56], [0, 56]],
  roadHalfWidth: 7.5,
  shoulder: 3,
  // up onto the bridge, flat over the crossing, back down to the docks
  elevation: [[0.122, 0], [0.19, 6], [0.228, 6], [0.296, 0]],
  // one boost pad sits on the bridge top, right over the road below
  boostPads: [0.04, 0.209, 0.43, 0.81],
  ramps: [{ t: 0.405, side: 1 }, { t: 0.92, side: -1 }],
  // stacked cargo crates (they work like hay bales)
  hayBales: [{ t: 0.06, side: -1 }, { t: 0.47, side: 1 }, { t: 0.7, side: 1 }, { t: 0.95, side: 1 }],
  // rain puddles: slippery like ice
  icePatches: [{ t: 0.33, len: 16, side: 1 }, { t: 0.6, len: 18, side: -1 }, { t: 0.875, len: 14, side: 0 }],
};
