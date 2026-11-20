/** Shapes of data that will travel between computers in multiplayer. */
export interface KartSnapshot {
  x: number; y: number; z: number;
  yaw: number;
  speed: number;
  drift: -1 | 0 | 1;
}

export interface ControlInput {
  throttle: boolean;
  brake: boolean;
  steer: number;   // -1 right .. +1 left
  drift: boolean;
}

export type RacePhase = 'countdown' | 'racing' | 'finished';
