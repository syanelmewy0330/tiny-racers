import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { characterById } from '@shared/characters';
import type { PlayerView, ResultRow } from '@shared/protocol';
import { createRacerModel, type RacerModel } from './racerModel';

interface Remote {
  model: RacerModel;
  body: RAPIER.RigidBody;
  tag: THREE.Sprite;
  target: PlayerView;
  x: number; z: number; yaw: number;
  seenAt: number;
  /** Recent positions, stamped with the sender's own clock. */
  buf: Shot[];
  /** Our clock minus theirs, for the quickest update seen (the network delay floor). */
  offset: number | null;
  /** How much later than the quickest ones updates usually arrive. */
  jitter: number;
  /** How far in the past we show them, so there is always a next position to glide to. */
  delay: number;
}

interface Shot { t: number; x: number; z: number; yaw: number }

const now = () => performance.now() / 1000;
const angleDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

/**
 * The other racers. Their positions arrive from the server ~20 times a second, but over
 * long distances they come unevenly, often several at once. So we keep the last few,
 * each stamped with when the sender took it, and replay them a little behind real time
 * at the pace they were driven. That keeps their karts gliding instead of stuttering.
 * Each one also has a physics body, so you can bump into them.
 */
export class RemoteKarts {
  private karts = new Map<string, Remote>();

  constructor(private scene: THREE.Scene, private world: RAPIER.World) {}

  /** Apply the latest world update. `me` is skipped: my own kart is driven locally. */
  sync(players: PlayerView[], me: string, time: number) {
    for (const p of players) {
      if (p.id === me) continue;
      let r = this.karts.get(p.id);
      if (r && r.model.ch.id !== p.character) { this.remove(p.id, r); r = undefined; }   // they picked another racer
      if (!r) {
        const model = createRacerModel(characterById(p.character));
        const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, 0.75, p.z));
        this.world.createCollider(RAPIER.ColliderDesc.ball(0.75).setRestitution(0.4), body);
        const tag = nameTag(p.name);
        model.root.add(tag);
        this.scene.add(model.root);
        r = { model, body, tag, target: p, x: p.x, z: p.z, yaw: p.yaw, seenAt: time, buf: [], offset: null, jitter: 0, delay: 0.1 };
        this.karts.set(p.id, r);
      }
      r.target = p; r.seenAt = time;
      const last = r.buf[r.buf.length - 1];
      if (p.t !== undefined && (!last || p.t > last.t)) {
        if (last && p.t - last.t > 2) { r.buf.length = 0; r.offset = null; }   // they were away: start fresh
        const o = now() - p.t;
        if (r.offset === null || o < r.offset) r.offset = o;
        else r.offset += (o - r.offset) * 0.005;   // follow slow clock drift
        r.jitter += (o - r.offset - r.jitter) * 0.1;
        r.buf.push({ t: p.t, x: p.x, z: p.z, yaw: p.yaw });
        if (r.buf.length > 30) r.buf.shift();
      }
    }
    for (const [id, r] of this.karts) if (!players.some((p) => p.id === id)) this.remove(id, r);
  }

  /** Every drawn frame: move each rival to where they were a moment ago. */
  update(dt: number, time: number) {
    for (const r of this.karts.values()) {
      const t = r.target;
      let tx: number, tz: number, tyaw: number;
      if (r.offset !== null && r.buf.length) {
        const want = Math.min(0.35, Math.max(0.08, 0.06 + 2.5 * r.jitter));
        r.delay += (want - r.delay) * Math.min(1, dt * 0.8);   // ease, so their pace never visibly jumps
        const at = now() - r.offset - r.delay;
        const b = r.buf;
        let i = b.length - 1;
        while (i > 0 && b[i - 1].t > at) i--;
        const hi = b[i], lo = b[i - 1];
        if (lo && at >= lo.t && at <= hi.t) {
          const f = (at - lo.t) / Math.max(1e-3, hi.t - lo.t);
          tx = lo.x + (hi.x - lo.x) * f; tz = lo.z + (hi.z - lo.z) * f; tyaw = lo.yaw + angleDiff(lo.yaw, hi.yaw) * f;
        } else if (at > hi.t) {
          // no newer update yet: carry on along their heading for a moment
          const ahead = Math.min(at - hi.t, 0.3) * t.speed;
          tx = hi.x + Math.sin(hi.yaw) * ahead; tz = hi.z + Math.cos(hi.yaw) * ahead; tyaw = hi.yaw;
        } else { tx = hi.x; tz = hi.z; tyaw = hi.yaw; }
      } else {
        const ahead = Math.min(0.08, time - r.seenAt + 0.05) * t.speed;
        tx = t.x + Math.sin(t.yaw) * ahead; tz = t.z + Math.cos(t.yaw) * ahead; tyaw = t.yaw;
      }
      if (Math.hypot(tx - r.x, tz - r.z) > 10) { r.x = tx; r.z = tz; r.yaw = tyaw; }   // respawn or new race: jump there
      else {
        const k = 1 - Math.exp(-30 * dt);   // just takes the edge off any small correction
        r.x += (tx - r.x) * k; r.z += (tz - r.z) * k; r.yaw += angleDiff(r.yaw, tyaw) * k;
      }
      r.body.setNextKinematicTranslation({ x: r.x, y: 0.75, z: r.z });
      r.model.root.position.set(r.x, 0, r.z);
      r.model.root.rotation.y = r.yaw;
      r.model.animate(dt, t.speed, 0, t.drift, t.drift ? 1 : 0, t.speed > 36, time);
    }
  }

  /** After a race: winner cheers, everyone else droops. `null` puts everyone back to racing. */
  setMoods(rows: ResultRow[] | null) {
    for (const [id, r] of this.karts) {
      const row = rows?.find((x) => x.id === id);
      r.model.setMood(!row ? 'race' : row.place === 1 ? 'win' : 'lose');
    }
  }

  /** A rival's 3D model (for shields and spin-outs). */
  model(id: string) { return this.karts.get(id)?.model ?? null; }

  /** Where everyone else is right now (for the minimap). */
  positions() { return [...this.karts.values()].map((r) => ({ x: r.x, z: r.z, character: r.model.ch.id })); }

  clear() { for (const [id, r] of this.karts) this.remove(id, r); }

  private remove(id: string, r: Remote) {
    this.scene.remove(r.model.root); r.model.dispose();
    this.world.removeRigidBody(r.body);
    this.karts.delete(id);
  }
}

function nameTag(name: string): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d')!;
  g.font = '800 34px Nunito, system-ui, sans-serif';
  const w = Math.min(248, g.measureText(name).width + 28);
  g.fillStyle = 'rgba(255,250,243,0.95)'; g.strokeStyle = '#2a1e3f'; g.lineWidth = 4;
  g.beginPath(); g.roundRect((256 - w) / 2, 8, w, 48, 16); g.fill(); g.stroke();
  g.fillStyle = '#2a1e3f'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 128, 33);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set(3.2, 0.8, 1); s.position.set(0, 3.4, 0); s.renderOrder = 10;
  return s;
}
