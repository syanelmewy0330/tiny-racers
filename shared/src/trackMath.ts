/**
 * Pure maths about a track's centre line, with no graphics code, so the
 * multiplayer server can use exactly the same lap and progress rules later.
 */
import type { TrackDef } from './tracks/meadowLoop';

export interface TrackPath {
  pts: { x: number; z: number; y: number }[];   // evenly spaced centre-line samples (y = road height)
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
  const pts: { x: number; z: number; y: number }[] = [];
  let carry = 0, length = 0;
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i], b = raw[(i + 1) % raw.length];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    length += d;
    let t = carry;
    while (t < d) { pts.push({ x: a.x + (b.x - a.x) * (t / d), z: a.z + (b.z - a.z) * (t / d), y: 0 }); t += spacing; }
    carry = t - d;
  }
  // road height: ease between the keyframes (smoothstep), wrapping round the lap
  const E = track.elevation;
  if (E?.length) {
    const n = pts.length;
    pts.forEach((p, k) => {
      const t = k / n;
      let j = E.findIndex(([et]) => et > t);
      if (j < 0) j = E.length;
      const [t0, h0] = E[(j - 1 + E.length) % E.length], [t1, h1] = E[j % E.length];
      const span = ((t1 - t0) % 1 + 1) % 1 || 1, f = (((t - t0) % 1 + 1) % 1) / span;
      const sm = f * f * (3 - 2 * f);
      p.y = h0 + (h1 - h0) * sm;
    });
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

/** A shortcut as a centre line sampled every metre, plus where it leaves (a) and rejoins (b) the main road. */
export interface ShortcutPath { a: number; b: number; pts: { x: number; z: number }[]; halfWidth: number }

/** Everything lap counting needs: the main centre line and the shortcut, if the track has one. */
export interface Route { path: TrackPath; shortcut: ShortcutPath | null; roadHalfWidth: number }

export function buildRoute(track: TrackDef, path = buildPath(track, 1)): Route {
  const sc = track.shortcut;
  let shortcut: ShortcutPath | null = null;
  if (sc) {
    const N = path.pts.length, a = Math.floor(sc.from * N) % N, b = Math.floor(sc.to * N) % N;
    const corners = [path.pts[a], ...sc.via.map(([x, z]) => ({ x, z })), path.pts[b]];
    const pts: { x: number; z: number }[] = [];
    for (let k = 0; k < corners.length - 1; k++) {
      const p = corners[k], q = corners[k + 1], d = Math.hypot(q.x - p.x, q.z - p.z), n = Math.max(1, Math.round(d));
      for (let s = 0; s < n; s++) pts.push({ x: p.x + (q.x - p.x) * (s / n), z: p.z + (q.z - p.z) * (s / n) });
    }
    pts.push(corners[corners.length - 1]);
    shortcut = { a, b, pts, halfWidth: sc.halfWidth };
  }
  return { path, shortcut, roadHalfWidth: track.roadHalfWidth };
}

/** Nearest sample on a shortcut, as its position (0..1 along it) and the distance to it. */
export function nearShortcut(sc: ShortcutPath, x: number, z: number): { f: number; dist: number } {
  let best = 0, bd = Infinity;
  sc.pts.forEach((p, k) => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = k; } });
  return { f: best / (sc.pts.length - 1), dist: Math.sqrt(bd) };
}

/**
 * Where a kart is along the lap. Like `nearest`, but a kart on the shortcut is placed between
 * its two ends in proportion, and its distance is scaled so the shortcut's edge counts as the road's edge.
 */
export function locate(route: Route, x: number, z: number, hint?: number): { i: number; dist: number; onShortcut: boolean } {
  const near = nearest(route.path, x, z, hint);
  const sc = route.shortcut;
  if (sc && near.dist > route.roadHalfWidth * 0.6) {
    const s = nearShortcut(sc, x, z);
    if (s.dist < sc.halfWidth + 3 && s.dist < near.dist) {
      const N = route.path.pts.length;
      let span = sc.b - sc.a; if (span < 0) span += N;
      return { i: (sc.a + Math.round(span * s.f)) % N, dist: s.dist * (route.roadHalfWidth / sc.halfWidth), onShortcut: true };
    }
  }
  return { ...near, onShortcut: false };
}
