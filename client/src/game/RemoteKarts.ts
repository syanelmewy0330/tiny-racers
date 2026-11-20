import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { characterById } from '@shared/characters';
import type { PlayerView, ResultRow } from '@shared/protocol';
import { KartModel } from './KartModel';

interface Remote {
  model: KartModel;
  body: RAPIER.RigidBody;
  tag: THREE.Sprite;
  target: PlayerView;
  x: number; z: number; yaw: number;
  seenAt: number;
}

/**
 * The other racers. Their positions arrive from the server ~20 times a second;
 * we glide each kart toward its latest position so movement looks smooth.
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
        const model = new KartModel(characterById(p.character));
        const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, 0.75, p.z));
        this.world.createCollider(RAPIER.ColliderDesc.ball(0.75).setRestitution(0.4), body);
        const tag = nameTag(p.name);
        model.root.add(tag);
        this.scene.add(model.root);
        r = { model, body, tag, target: p, x: p.x, z: p.z, yaw: p.yaw, seenAt: time };
        this.karts.set(p.id, r);
      }
      r.target = p; r.seenAt = time;
    }
    for (const [id, r] of this.karts) if (!players.some((p) => p.id === id)) this.remove(id, r);
  }

  update(dt: number, time: number) {
    const k = 1 - Math.exp(-12 * dt);
    for (const r of this.karts.values()) {
      const t = r.target;
      // a little prediction along their heading hides network delay
      const ahead = Math.min(0.08, time - r.seenAt + 0.05) * t.speed;
      const tx = t.x + Math.sin(t.yaw) * ahead, tz = t.z + Math.cos(t.yaw) * ahead;
      r.x += (tx - r.x) * k; r.z += (tz - r.z) * k;
      let d = t.yaw - r.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      r.yaw += d * k;
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
