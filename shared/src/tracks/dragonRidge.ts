import type { TrackDef } from './meadowLoop';

/**
 * Dragon Ridge: the fifth track (test). An ancient stone wall snaking over misty mountain ridges
 * at sunrise. You race along the top of the wall, through watchtowers, down into a gorge and back
 * up to the peak. Three shortcuts: a narrow plank bridge across the gorge, a lantern-lit tunnel
 * through a rocky spur, and a muddy goat trail round the foot of a hill.
 */
export const DRAGON_RIDGE: TrackDef = {
  id: 'dragon-ridge',
  name: 'Dragon Ridge',
  blurb: 'An old stone wall over misty mountain ridges at sunrise, with three shortcuts.',
  theme: 'wall',
  points: [
    [0, 46], [0, -12], [14, -46], [44, -66], [72, -58], [98, -62],
    [114, -38], [124, -24], [146, -22], [158, -40], [172, -60],
    [204, -72], [234, -58], [248, -24], [244, 10], [282, 48], [240, 86], [206, 90],
    [176, 94], [148, 86], [132, 60], [104, 50], [76, 62], [62, 90], [34, 100], [8, 82],
  ],
  roadHalfWidth: 7.5,
  shoulder: 2.5,
  // the wall climbs from the valley gate, dips into the gorge, tops out at the peak tower and
  // rolls back down; flat at every shortcut's ends so the side roads meet it level
  elevation: [
    [0, 0], [0.1, 5], [0.214, 10], [0.281, 2.5], [0.347, 10], [0.4, 12.5], [0.47, 8.5],
    [0.535, 7], [0.585, 9], [0.635, 7], [0.735, 3], [0.81, 8.5], [0.885, 3], [0.955, 0.5],
  ],
  boostPads: [0.05, 0.27, 0.46, 0.7, 0.85],
  ramps: [{ t: 0.292, side: 1 }, { t: 0.968, side: -1 }],
  // stacks of clay jars (they work like hay bales)
  hayBales: [{ t: 0.13, side: 1 }, { t: 0.45, side: -1 }, { t: 0.665, side: 1 }, { t: 0.925, side: -1 }],
  towers: [0.151, 0.4, 0.585, 0.81],
  shortcuts: [
    // straight across the gorge on a narrow rope-and-plank bridge
    { from: 0.214, to: 0.347, via: [[122, -64], [150, -63]], halfWidth: 3.4, kind: 'planks' },
    // through the rocky spur instead of round it
    { from: 0.535, to: 0.635, via: [[252, 40], [250, 62]], halfWidth: 3.8, kind: 'tunnel' },
    // a goat trail round the foot of the hill the wall climbs over; muddy in the middle
    { from: 0.735, to: 0.885, via: [[132, 100], [96, 102]], halfWidth: 4, kind: 'trail' },
  ],
};
