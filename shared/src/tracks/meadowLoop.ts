export interface ShortcutDef {
  from: number; to: number; via: [number, number][]; halfWidth: number;
  kind?: 'ice' | 'planks' | 'trail' | 'tunnel';
}

/** Meadow Loop: the first track. Points are the road's centre line (metres, x/z), driven in order. */
export interface TrackDef {
  id: string;
  name: string;
  points: [number, number][];
  roadHalfWidth: number;     // asphalt, full speed
  shoulder: number;          // grass strip each side before the wall (slows you down)
  boostPads: number[];       // positions around the lap, 0..1
  /** Jump ramps: where around the lap (0..1) and which half of the road (+1 / -1). */
  ramps: { t: number; side: 1 | -1 }[];
  /** Hay bale stacks: where around the lap (0..1) and which edge of the road they sit on. */
  hayBales: { t: number; side: 1 | -1 }[];
  /** Look of the world around the road (scenery, sky, colours). Meadow if left out. */
  theme?: 'meadow' | 'frost' | 'grove' | 'harbor' | 'wall';
  /** Slippery ice on the road: where it starts (0..1), how long (metres), which half (+1 / -1, or 0 for the full width). */
  icePatches?: { t: number; len: number; side: 1 | -1 | 0 }[];
  /** Sticky mud on the road (same layout as ice patches): slows you down. */
  mudPatches?: { t: number; len: number; side: 1 | -1 | 0 }[];
  /** A tunnel the road drives through, from..to around the lap (0..1). */
  tunnel?: { from: number; to: number };
  /**
   * Shortcuts off the main road. Each leaves the centre line at `from` (0..1) and rejoins at `to`,
   * passing through the `via` points (metres). `halfWidth` is half its width. Driving one counts
   * as covering the road between from and to, so laps stay fair. Its height runs evenly from the
   * road's height at one end to the other. `kind` sets the surface: an icy pond lane (default),
   * a narrow plank bridge, a dirt trail with a muddy middle, or a stone tunnel.
   */
  shortcuts?: ShortcutDef[];
  /** Watchtowers the road drives through (stone wall tracks), around the lap (0..1). */
  towers?: number[];
  /**
   * Road height (metres) at points around the lap, as [t 0..1, height] pairs in order.
   * Between them the road eases up and down smoothly. Leave out for a flat track.
   */
  elevation?: [number, number][];
  /** One line for the track picker. */
  blurb?: string;
}

export const MEADOW_LOOP: TrackDef = {
  id: 'meadow-loop',
  name: 'Meadow Loop',
  blurb: 'Cherry blossoms, ramps and hay bales on a golden afternoon.',
  points: [
    [0, 40], [0, 0], [18, -20], [56, -19], [78, 4], [100, -14], [140, -23], [176, -9],
    [182, 27], [152, 49], [118, 45], [100, 64], [118, 86], [160, 81], [182, 99],
    [152, 113], [82, 107], [40, 97], [12, 79],
  ],
  roadHalfWidth: 7.5,
  shoulder: 4,
  boostPads: [0.16, 0.41, 0.62, 0.86],
  // Everything is placed from these numbers, so every computer builds exactly the same track.
  ramps: [{ t: 0.25, side: -1 }, { t: 0.8, side: 1 }],
  hayBales: [{ t: 0.12, side: 1 }, { t: 0.45, side: -1 }, { t: 0.585, side: 1 }, { t: 0.94, side: -1 }],
};
