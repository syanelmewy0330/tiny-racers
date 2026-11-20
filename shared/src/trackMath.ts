/**
 * Pure maths about a track's centre line, with no graphics code, so the
 * multiplayer server can use exactly the same lap and progress rules later.
 */
import type { TrackDef } from './tracks/meadowLoop';

export interface TrackPath {
  pts: { x: number; z: number }[];   // evenly spaced centre-line samples
  spacing: number;
  length: number;
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export function buildPath(track: TrackDef, spacing = 1): TrackPath {
  const P = track.points, n = P.length, raw: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n], d = P[(i + 2) % n];
    for (let s = 0; s < 60; s++) {
      const t = s / 60;
      raw.push({ x: catmull(a[0], b[0], c[0], d[0], t), z: catmull(a[1], b[1], c[1], d[1], t) });
    }
  }
  const pts: { x: number; z: number }[] = [];
  let carry = 0, length = 0;
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i], b = raw[(i + 1) % raw.length];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    length += d;
    let t = carry;
    while (t < d) { pts.push({ x: a.x + (b.x - a.x) * (t / d), z: a.z + (b.z - a.z) * (t / d) }); t += spacing; }
    carry = t - d;
  }
  return { pts, spacing, length };
}

/** Direction of travel at sample i, as a yaw angle (0 = +z, turning toward +x). */
export function yawAt(path: TrackPath, i: number): number {
  const N = path.pts.length;
  const a = path.pts[(i - 2 + N) % N], b = path.pts[(i + 2) % N];
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/** Closest centre-line sample. Pass the previous index as a hint to search only nearby. */
export function nearest(path: TrackPath, x: number, z: number, hint?: number): { i: number; dist: number } {
  const N = path.pts.length;
  let best = 0, bd = Infinity;
  const check = (i: number) => {
    const p = path.pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  };
  if (hint === undefined) for (let i = 0; i < N; i++) check(i);
  else for (let k = -40; k <= 40; k++) check((hint + k + N) % N);
  return { i: best, dist: Math.sqrt(bd) };
}

/** How far the index moved, accounting for wrapping past the start line. */
export function indexDelta(path: TrackPath, from: number, to: number): number {
  const N = path.pts.length;
  let d = to - from;
  if (d < -N / 2) d += N;
  if (d > N / 2) d -= N;
  return d;
}
