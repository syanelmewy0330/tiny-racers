import { LAPS, COUNTDOWN_SECONDS } from '@shared/constants';
import { indexDelta, nearest, type TrackPath } from '@shared/trackMath';
import type { RacePhase } from '@shared/types';

/**
 * Countdown, laps and timing for one kart.
 * In multiplayer the server will run this same logic to decide the real results.
 */
export class RaceTracker {
  phase: RacePhase = 'countdown';
  countdown = COUNTDOWN_SECONDS;
  raceTime = 0;
  index = 0;
  /** Samples travelled since the start line; laps = progress / samples per lap. */
  progress = 0;
  lapTimes: number[] = [];
  private lapStart = 0;
  onLap?: (lap: number) => void;
  onFinish?: () => void;

  constructor(private path: TrackPath) {}

  get lap() { return Math.min(LAPS, Math.max(1, Math.floor(this.progress / this.path.pts.length) + 1)); }

  reset(startIndex: number, startProgress: number) {
    this.phase = 'countdown'; this.countdown = COUNTDOWN_SECONDS; this.raceTime = 0;
    this.index = startIndex; this.progress = startProgress; this.lapTimes = []; this.lapStart = 0;
  }

  update(dt: number, x: number, z: number): { distFromCentre: number } {
    const near = nearest(this.path, x, z, this.index);
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.phase = 'racing';
      return { distFromCentre: near.dist };
    }
    const lapBefore = Math.floor(this.progress / this.path.pts.length);
    this.progress += indexDelta(this.path, this.index, near.i);
    this.index = near.i;
    if (this.phase !== 'racing') return { distFromCentre: near.dist };
    this.raceTime += dt;
    const lapNow = Math.floor(this.progress / this.path.pts.length);
    if (lapNow > lapBefore && lapNow >= 1) {
      this.lapTimes.push(this.raceTime - this.lapStart);
      this.lapStart = this.raceTime;
      if (lapNow >= LAPS) { this.phase = 'finished'; this.onFinish?.(); }
      else this.onLap?.(lapNow + 1);
    }
    return { distFromCentre: near.dist };
  }
}

export const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toFixed(2).padStart(5, '0')}`;
};
