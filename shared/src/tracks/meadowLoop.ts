/** Meadow Loop: the first track. Points are the road's centre line (metres, x/z), driven in order. */
export interface TrackDef {
  id: string;
  name: string;
  points: [number, number][];
  roadHalfWidth: number;     // asphalt, full speed
  shoulder: number;          // grass strip each side before the wall (slows you down)
  boostPads: number[];       // positions around the lap, 0..1
}

export const MEADOW_LOOP: TrackDef = {
  id: 'meadow-loop',
  name: 'Meadow Loop',
  points: [
    [0, 40], [0, 0], [18, -20], [56, -19], [78, 4], [100, -14], [140, -23], [176, -9],
    [182, 27], [152, 49], [118, 45], [100, 64], [118, 86], [160, 81], [182, 99],
    [152, 113], [82, 107], [40, 97], [12, 79],
  ],
  roadHalfWidth: 7.5,
  shoulder: 4,
  boostPads: [0.16, 0.41, 0.62, 0.86],
};
