/**
 * Power-ups: item boxes, what you get from them, and the things items leave on the track.
 * Pure rules with no graphics, shared by practice races (run in the game) and online
 * races (run on the server), so both behave the same.
 */
import type { TrackPath } from './trackMath';
import { yawAt, nearestAt } from './trackMath';

export type ItemId = 'juice' | 'shield' | 'banana' | 'rocket' | 'bounce' | 'magnet' | 'thunder' | 'star';

export interface ItemInfo { id: ItemId; name: string; uses: number; blurb: string }
export const ITEMS: Record<ItemId, ItemInfo> = {
  juice: { id: 'juice', name: 'Turbo Juice', uses: 3, blurb: 'Three sips, three quick boosts.' },
  shield: { id: 'shield', name: 'Bubble Shield', uses: 1, blurb: 'Blocks one hit for 10 seconds.' },
  banana: { id: 'banana', name: 'Banana Slip', uses: 1, blurb: 'Drops a banana peel that spins racers out.' },
  rocket: { id: 'rocket', name: 'Rocket Pop', uses: 1, blurb: 'A firework that flies along the track and spins out the first racer it reaches.' },
  bounce: { id: 'bounce', name: 'Bounce Trap', uses: 1, blurb: 'A springy pad that bounces racers into the air and slows them.' },
  magnet: { id: 'magnet', name: 'Magnet', uses: 1, blurb: 'Pulls you along the road towards the racer ahead for 3 seconds.' },
  thunder: { id: 'thunder', name: 'Mini Thunder', uses: 1, blurb: 'Lightning shrinks every racer ahead of you for a few seconds.' },
  star: { id: 'star', name: 'Chaos Star', uses: 1, blurb: 'A wild star zig-zags along the track and spins out anyone it touches, you too.' },
};

export const MAGNET_S = 3;
export const SHRINK_S = 4;
/** Chaos Star: how long it roams, how fast, and how close counts as touching. */
export const STAR_LIFE_S = 10;
export const STAR_SPEED = 30;
export const STAR_REACH = 2.2;
export const STAR_GRACE_S = 1.5;

/** Rocket Pop flies along the track at this speed (m/s) for this long. */
export const ROCKET_SPEED = 52;
export const ROCKET_LIFE_S = 3.6;
export const ROCKET_REACH = 2.0;

/** Where item boxes sit around the lap (0..1), clear of the boost pads. */
const ROWS = [0.07, 0.3, 0.52, 0.74];
const PER_ROW = 4;
/** A box that was driven through comes back after this long. */
export const BOX_RESPAWN_MS = 2500;
/** How close (metres) the kart's centre must pass to collect a box / touch a banana peel. */
export const BOX_REACH = 2.1;
export const HAZARD_REACH = 1.7;
/** The slot spins this long before it shows what you got. */
export const ROLL_MS = 1100;
export const SHIELD_MS = 10_000;
/** Peels and traps disappear after this long, and there are never more than this many. */
const HAZARD_LIFE_MS = 60_000;
const MAX_HAZARDS = 16;
/** The racer who dropped a banana peel can't hit it for this long (it's right under them). */
export const OWNER_GRACE_MS = 1200;

export interface ItemBox { id: number; x: number; z: number }
/**
 * Something an item put on the track. Banana peels and Bounce Traps sit still at x, z.
 * A Rocket Pop starts at path sample i0, `off` metres to the side of the centre line, and
 * flies on from there (see rocketAt), so every computer can work out where it is.
 */
export interface Hazard { id: number; kind: 'banana' | 'bounce' | 'rocket' | 'star'; x: number; z: number; /** ground height it lies on (raised roads) */ y?: number; owner: string; at: number; i0?: number; off?: number }

/**
 * Where a flying item is, `age` seconds after launch. A Rocket Pop follows the road in its
 * lane; a Chaos Star rolls along slower, zig-zagging from one side of the road to the other.
 */
export function rocketAt(path: TrackPath, h: Hazard, age: number, roadHalfWidth = 7.5) {
  const N = path.pts.length;
  const star = h.kind === 'star';
  const f = (h.i0 ?? 0) + (star ? 8 : 2) + ((star ? STAR_SPEED : ROCKET_SPEED) * Math.max(0, age)) / path.spacing;
  const i = Math.floor(f), t = f - i;
  const a = path.pts[((i % N) + N) % N], b = path.pts[(((i + 1) % N) + N) % N];
  const yaw = yawAt(path, ((i % N) + N) % N);
  const off = star ? Math.sin(age * 1.9 + (h.off ?? 0)) * roadHalfWidth * 0.8 : h.off ?? 0;
  return { x: a.x + (b.x - a.x) * t + Math.cos(yaw) * off, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t - Math.sin(yaw) * off, yaw };
}

/** Item boxes in rows across the road. */
export function itemBoxes(path: TrackPath, roadHalfWidth: number): ItemBox[] {
  const out: ItemBox[] = [], N = path.pts.length;
  ROWS.forEach((t, r) => {
    const i = Math.floor(t * N) % N, p = path.pts[i], yaw = yawAt(path, i);
    const sx = Math.cos(yaw), sz = -Math.sin(yaw);   // sideways
    for (let k = 0; k < PER_ROW; k++) {
      const off = (k - (PER_ROW - 1) / 2) * (roadHalfWidth * 0.5);
      out.push({ id: r * PER_ROW + k, x: p.x + sx * off, z: p.z + sz * off });
    }
  });
  return out;
}

/**
 * What a box gives. Racers further back get more help: the leader mostly gets
 * defensive items, the back of the pack mostly boosts. Alone (practice) it's a fair mix.
 */
export function rollItem(place: number, of: number, rnd = Math.random): ItemId {
  const back = of <= 1 ? 0.5 : (place - 1) / (of - 1);   // 0 = leading, 1 = last
  const weights: [ItemId, number][] = [
    ['juice', 1 + back * 4],
    ['shield', 3 - back * 2],
    ['banana', 3 - back * 1.5],
    ['rocket', 1 + back * 2.5],
    ['bounce', 2.5 - back],
    ['magnet', 0.5 + back * 2],
    ['thunder', back > 0.6 ? back * 1.6 : 0.15],
    ['star', 0.8 + back],
  ];
  let r = rnd() * weights.reduce((s, [, w]) => s + w, 0);
  for (const [id, w] of weights) { r -= w; if (r <= 0) return id; }
  return 'juice';
}

interface Holder { item: ItemId | null; uses: number; shieldUntil: number }

export interface ThunderHit { id: string; blocked: boolean }
export type UseResult = { item: ItemId; usesLeft: number; hazard?: Hazard; thunder?: ThunderHit[] } | null;
export type HitResult = { hazard: number; kind: Hazard['kind']; victim: string; blocked: boolean } | null;

/** Boxes, held items, shields and dropped banana peels for one race. */
export class ItemWorld {
  readonly boxes: ItemBox[];
  hazards: Hazard[] = [];
  private hiddenUntil = new Map<number, number>();
  private holders = new Map<string, Holder>();
  private nextId = 1;
  private starHits = new Map<number, Set<string>>();

  constructor(private path: TrackPath, roadHalfWidth: number) { this.boxes = itemBoxes(path, roadHalfWidth); }

  reset() { this.hazards = []; this.hiddenUntil.clear(); this.holders.clear(); this.starHits.clear(); }
  remove(player: string) { this.holders.delete(player); }

  private holder(id: string): Holder {
    let h = this.holders.get(id);
    if (!h) { h = { item: null, uses: 0, shieldUntil: 0 }; this.holders.set(id, h); }
    return h;
  }

  boxReady(box: number, now: number) { return (this.hiddenUntil.get(box) ?? 0) <= now; }
  hiddenBoxes(now: number) { return this.boxes.filter((b) => !this.boxReady(b.id, now)).map((b) => b.id); }
  held(player: string) { const h = this.holders.get(player); return h?.item ? { item: h.item, uses: h.uses } : null; }
  shielded(player: string, now: number) { return (this.holders.get(player)?.shieldUntil ?? 0) > now; }

  /** Tests only: put an item straight into a racer's slot. */
  give(player: string, item: string) {
    if (!(item in ITEMS)) return;
    const h = this.holder(player); h.item = item as ItemId; h.uses = ITEMS[item as ItemId].uses;
  }

  /** Drive through a box. Returns the item rolled, or null (box gone, too far, or already holding one). */
  pick(player: string, box: number, now: number, x: number, z: number, place: number, of: number): ItemId | null {
    const b = this.boxes[box];
    if (!b || !this.boxReady(box, now) || Math.hypot(x - b.x, z - b.z) > BOX_REACH + 2.5) return null;
    this.hiddenUntil.set(box, now + BOX_RESPAWN_MS);
    const h = this.holder(player);
    if (h.item) return null;    // the box still breaks, but you keep what you have
    h.item = rollItem(place, of);
    h.uses = ITEMS[h.item].uses;
    return h.item;
  }

  /** Use the held item. Peels and traps are dropped just behind the kart; rockets fire ahead. */
  /** `ahead` = racers in front of this player (Mini Thunder strikes them). */
  /** `y` = ground height under the kart (only matters on tracks with a bridge). */
  use(player: string, now: number, x: number, z: number, yaw: number, ahead: string[] = [], y = 0): UseResult {
    const h = this.holder(player);
    if (!h.item) return null;
    const item = h.item;
    let hazard: Hazard | undefined;
    if (item === 'shield') h.shieldUntil = now + SHIELD_MS;
    if (item === 'banana' || item === 'bounce') {
      hazard = { id: this.nextId++, kind: item, x: x - Math.sin(yaw) * 2.6, z: z - Math.cos(yaw) * 2.6, y: Math.max(0, y), owner: player, at: now };
    }
    if (item === 'rocket') {
      const near = nearestAt(this.path, x, z, y);
      const p = this.path.pts[near.i], ry = yawAt(this.path, near.i);
      const off = Math.max(-5, Math.min(5, (x - p.x) * Math.cos(ry) - (z - p.z) * Math.sin(ry)));
      hazard = { id: this.nextId++, kind: 'rocket', x, z, owner: player, at: now, i0: near.i, off };
    }
    if (item === 'star') {
      const near = nearestAt(this.path, x, z, y);
      hazard = { id: this.nextId++, kind: 'star', x, z, owner: player, at: now, i0: near.i, off: Math.random() * 6 };
    }
    let thunder: ThunderHit[] | undefined;
    if (item === 'thunder') {
      thunder = ahead.map((id) => {
        const v = this.holder(id), blocked = v.shieldUntil > now;
        if (blocked) v.shieldUntil = 0;
        return { id, blocked };
      });
    }
    if (hazard) {
      this.hazards.push(hazard);
      const old = this.hazards.findIndex((h) => h.kind !== 'rocket');
      if (this.hazards.length > MAX_HAZARDS && old >= 0) this.hazards.splice(old, 1);
    }
    h.uses -= 1;
    if (h.uses <= 0) { h.item = null; h.uses = 0; }
    return { item, usesLeft: h.uses, hazard, thunder };
  }

  /** A racer drove into a hazard. A shield pops instead of spinning out. */
  hit(player: string, hazardId: number, now: number): HitResult {
    const i = this.hazards.findIndex((hz) => hz.id === hazardId);
    if (i < 0) return null;
    const hz = this.hazards[i];
    if (hz.owner === player && (hz.kind === 'rocket' || now - hz.at < (hz.kind === 'star' ? STAR_GRACE_S * 1000 : OWNER_GRACE_MS))) return null;
    if (hz.kind === 'rocket' && now - hz.at > (ROCKET_LIFE_S + 1.5) * 1000) return null;
    if (hz.kind === 'star') {
      // the star keeps going: it can catch each racer once
      const hitBy = this.starHits.get(hz.id) ?? new Set<string>();
      if (hitBy.has(player) || now - hz.at > (STAR_LIFE_S + 1.5) * 1000) return null;
      hitBy.add(player); this.starHits.set(hz.id, hitBy);
    } else this.hazards.splice(i, 1);
    const h = this.holder(player);
    const blocked = h.shieldUntil > now;
    if (blocked) h.shieldUntil = 0;
    return { hazard: hazardId, kind: hz.kind, victim: player, blocked };
  }

  /** Forget rockets that flew out and peels or traps that have been lying around too long. */
  tick(now: number) { this.hazards = this.hazards.filter((h) => now - h.at < (h.kind === 'rocket' ? (ROCKET_LIFE_S + 1.5) * 1000 : h.kind === 'star' ? (STAR_LIFE_S + 1.5) * 1000 : HAZARD_LIFE_MS)); }
}
