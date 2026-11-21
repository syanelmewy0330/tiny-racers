/**
 * Power-ups: item boxes, what you get from them, and the things items leave on the track.
 * Pure rules with no graphics, shared by practice races (run in the game) and online
 * races (run on the server), so both behave the same.
 */
import type { TrackPath } from './trackMath';
import { yawAt } from './trackMath';

export type ItemId = 'juice' | 'shield' | 'banana';

export interface ItemInfo { id: ItemId; name: string; uses: number; blurb: string }
export const ITEMS: Record<ItemId, ItemInfo> = {
  juice: { id: 'juice', name: 'Turbo Juice', uses: 3, blurb: 'Three sips, three quick boosts.' },
  shield: { id: 'shield', name: 'Bubble Shield', uses: 1, blurb: 'Blocks one hit for 10 seconds.' },
  banana: { id: 'banana', name: 'Banana Slip', uses: 1, blurb: 'Drops a banana peel that spins racers out.' },
};

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
/** Jellies melt away after this long, and there are never more than this many. */
const HAZARD_LIFE_MS = 60_000;
const MAX_HAZARDS = 16;
/** The racer who dropped a banana peel can't hit it for this long (it's right under them). */
export const OWNER_GRACE_MS = 1200;

export interface ItemBox { id: number; x: number; z: number }
export interface Hazard { id: number; kind: 'banana'; x: number; z: number; owner: string; at: number }

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
  ];
  let r = rnd() * weights.reduce((s, [, w]) => s + w, 0);
  for (const [id, w] of weights) { r -= w; if (r <= 0) return id; }
  return 'juice';
}

interface Holder { item: ItemId | null; uses: number; shieldUntil: number }

export type UseResult = { item: ItemId; usesLeft: number; hazard?: Hazard } | null;
export type HitResult = { hazard: number; victim: string; blocked: boolean } | null;

/** Boxes, held items, shields and dropped banana peels for one race. */
export class ItemWorld {
  readonly boxes: ItemBox[];
  hazards: Hazard[] = [];
  private hiddenUntil = new Map<number, number>();
  private holders = new Map<string, Holder>();
  private nextId = 1;

  constructor(path: TrackPath, roadHalfWidth: number) { this.boxes = itemBoxes(path, roadHalfWidth); }

  reset() { this.hazards = []; this.hiddenUntil.clear(); this.holders.clear(); }
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

  /** Use the held item. A banana peel is dropped just behind the kart. */
  use(player: string, now: number, x: number, z: number, yaw: number): UseResult {
    const h = this.holder(player);
    if (!h.item) return null;
    const item = h.item;
    let hazard: Hazard | undefined;
    if (item === 'shield') h.shieldUntil = now + SHIELD_MS;
    if (item === 'banana') {
      hazard = { id: this.nextId++, kind: 'banana', x: x - Math.sin(yaw) * 2.6, z: z - Math.cos(yaw) * 2.6, owner: player, at: now };
      this.hazards.push(hazard);
      if (this.hazards.length > MAX_HAZARDS) this.hazards.shift();
    }
    h.uses -= 1;
    if (h.uses <= 0) { h.item = null; h.uses = 0; }
    return { item, usesLeft: h.uses, hazard };
  }

  /** A racer drove into a hazard. A shield pops instead of spinning out. */
  hit(player: string, hazardId: number, now: number): HitResult {
    const i = this.hazards.findIndex((hz) => hz.id === hazardId);
    if (i < 0) return null;
    const hz = this.hazards[i];
    if (hz.owner === player && now - hz.at < OWNER_GRACE_MS) return null;
    this.hazards.splice(i, 1);
    const h = this.holder(player);
    const blocked = h.shieldUntil > now;
    if (blocked) h.shieldUntil = 0;
    return { hazard: hazardId, victim: player, blocked };
  }

  /** Forget melted banana peels. */
  tick(now: number) { this.hazards = this.hazards.filter((h) => now - h.at < HAZARD_LIFE_MS); }
}
