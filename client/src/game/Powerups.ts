import * as THREE from 'three';
import { ItemWorld, ITEMS, BOX_REACH, HAZARD_REACH, ROLL_MS, SHIELD_MS, OWNER_GRACE_MS, ROCKET_LIFE_S, ROCKET_REACH, STAR_LIFE_S, STAR_REACH, STAR_GRACE_S, MAGNET_S, rocketAt, type Hazard, type ItemId, type ThunderHit } from '@shared/items';
import type { TrackPath } from '@shared/trackMath';
import type { WorldMessage, ItemGotMessage, ItemUsedMessage, ItemHitMessage } from '@shared/protocol';
import type { ColyseusSession } from '../net/ColyseusSession';
import { blob, cyl, cone, group, vinyl, gloss, part, G } from '../models/toy';

/** Flat icons for the item slot, in the Design Board palette. */
export const ITEM_ICONS: Record<ItemId, string> = {
  juice: `<rect x="26" y="30" width="44" height="58" rx="9" fill="#FF8A00"/><rect x="26" y="30" width="44" height="14" rx="7" fill="#FCC945"/>
    <path d="M58 30 L66 8 L74 10" stroke="#F2F2F0" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M50 52 L40 68 L49 68 L44 82 L58 62 L49 62 Z" fill="#F2F2F0"/>`,
  shield: `<circle cx="50" cy="52" r="36" fill="#6CA9E6" fill-opacity=".55" stroke="#BFE0FF" stroke-width="5"/>
    <ellipse cx="38" cy="38" rx="11" ry="7" fill="#F2F2F0" fill-opacity=".9" transform="rotate(-35 38 38)"/>
    <circle cx="62" cy="68" r="4" fill="#F2F2F0" fill-opacity=".7"/>`,
  banana: `<path d="M50 20 C46 40 30 58 14 74 C30 70 44 62 50 50 C56 62 70 70 86 74 C70 58 54 40 50 20 Z" fill="#FCC945" stroke="#C98A12" stroke-width="3" stroke-linejoin="round"/>
    <path d="M50 50 C46 62 44 74 46 86 C50 82 54 82 54 86 C56 74 54 62 50 50 Z" fill="#F7DD7A" stroke="#C98A12" stroke-width="3"/>
    <rect x="46" y="12" width="8" height="10" rx="3" fill="#6B4A1E"/>`,
  rocket: `<g transform="rotate(45 50 50)"><rect x="40" y="26" width="20" height="46" rx="6" fill="#E54B4B"/>
    <rect x="40" y="40" width="20" height="8" fill="#F2F2F0"/><rect x="40" y="56" width="20" height="8" fill="#F2F2F0"/>
    <path d="M40 30 L50 10 L60 30 Z" fill="#FCC945"/><path d="M40 62 L30 76 L40 72 Z M60 62 L70 76 L60 72 Z" fill="#8F84D9"/>
    <path d="M44 74 L50 92 L56 74 Z" fill="#FF8A00"/></g>`,
  bounce: `<rect x="16" y="70" width="68" height="12" rx="6" fill="#3A3F47"/>
    <path d="M30 66 Q50 58 70 66 M30 56 Q50 48 70 56 M30 46 Q50 38 70 46" stroke="#F2F2F0" stroke-width="5" fill="none" stroke-linecap="round"/>
    <rect x="20" y="22" width="60" height="16" rx="8" fill="#7AA58A"/><path d="M38 32 L50 24 L62 32" stroke="#F2F2F0" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  magnet: `<path d="M24 20 L24 54 A26 26 0 0 0 76 54 L76 20 L58 20 L58 54 A8 8 0 0 1 42 54 L42 20 Z" fill="#E54B4B"/>
    <rect x="24" y="14" width="18" height="14" fill="#F2F2F0"/><rect x="58" y="14" width="18" height="14" fill="#F2F2F0"/>
    <path d="M14 70 Q8 80 16 88 M86 70 Q92 80 84 88" stroke="#8F84D9" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  thunder: `<path d="M22 44 Q22 24 42 26 Q48 12 64 18 Q80 16 80 32 Q92 36 86 48 Q84 54 74 54 L28 54 Q18 52 22 44 Z" fill="#8790B8"/>
    <path d="M52 50 L38 74 L50 74 L42 94 L66 66 L54 66 L62 50 Z" fill="#FCC945" stroke="#FF8A00" stroke-width="2" stroke-linejoin="round"/>`,
  star: `<path d="M50 8 L61 36 L91 38 L68 57 L76 88 L50 71 L24 88 L32 57 L9 38 L39 36 Z" fill="#8F84D9" stroke="#FCC945" stroke-width="5" stroke-linejoin="round"/>
    <path d="M50 30 L55 44 L69 45 L58 54 L62 68 L50 60 L38 68 L42 54 L31 45 L45 44 Z" fill="#FCC945"/>
    <circle cx="84" cy="14" r="5" fill="#FF8A00"/><circle cx="14" cy="80" r="4" fill="#6CA9E6"/>`,
};

interface Box { x: number; z: number; id: number }

/**
 * Power-ups in a race: item boxes on the road, the item you hold, Bubble Shields and
 * Banana Slip peels. Practice races run the rules here with ItemWorld; online, the
 * server runs them and this class only predicts your own actions and draws everything.
 */
export class Powerups {
  /** Practice-race rules (unused online). */
  private local: ItemWorld;
  private online: ColyseusSession | null = null;
  private boxes: Box[];
  private hidden = new Set<number>();
  private predictedHidden = new Map<number, number>();
  private hazards: Hazard[] = [];
  private hazardSeen = new Map<number, number>();
  private hazardHit = new Set<number>();
  private rocketChecked = new Map<number, number>();
  /** Chaos Stars that already caught me (each can catch a racer once). */
  private starTouched = new Set<number>();
  private magnets = new Map<string, { o: THREE.Object3D; until: number }>();
  private bolts: { m: THREE.Object3D; t: number }[] = [];
  private boltMat = new THREE.MeshBasicMaterial({ color: 0xffc83d });
  private boltCore = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });
  private held: { item: ItemId; uses: number } | null = null;
  private rolling: { until: number; item: ItemId | null; since: number } | null = null;
  private myShieldUntil = 0;
  private remoteShields = new Set<string>();

  // visuals
  private boxMesh: THREE.InstancedMesh;
  private boxScale: number[] = [];
  private peelGroup = new THREE.Group();
  private peels = new Map<number, THREE.Object3D>();
  private bubbles = new Map<string, THREE.Mesh>();
  private pops: { m: THREE.Mesh; t: number }[] = [];
  private bubbleGeo = new THREE.SphereGeometry(1, 32, 20);
  private dummy = new THREE.Object3D();

  /** Hooks into the game: HUD slot and messages, the player's kart, remote models. */
  onSlot?: (item: ItemId | null, uses: number, rollingIcon: ItemId | null) => void;
  onSay?: (text: string) => void;
  onBoost?: () => void;
  onSpin?: () => void;
  /** 3D model of a racer by id ('me' for the player), for shields and spins. */
  racerRoot?: (id: string) => THREE.Object3D | null;
  spinRacer?: (id: string) => void;
  /** Bounce Trap: hop the player's kart / a rival's model. */
  onBounce?: () => void;
  hopRacer?: (id: string) => void;
  /** Batch 3: Magnet on the player, Mini Thunder shrinking the player / a rival, screen flash. */
  onMagnet?: () => void;
  onShrink?: () => void;
  shrinkRacer?: (id: string) => void;
  onFlash?: () => void;

  private roadHalf: number;
  constructor(scene: THREE.Scene, private path: TrackPath, roadHalfWidth: number) {
    this.roadHalf = roadHalfWidth;
    this.local = new ItemWorld(path, roadHalfWidth);
    this.boxes = this.local.boxes;
    this.boxMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), boxMaterial(), this.boxes.length);
    this.boxMesh.castShadow = true;
    this.boxMesh.frustumCulled = false;
    scene.add(this.boxMesh, this.peelGroup);
  }

  /** A different track: new item boxes along its road. */
  setTrack(path: TrackPath, roadHalfWidth: number) {
    this.path = path;
    this.local = new ItemWorld(path, roadHalfWidth);
    this.boxes = this.local.boxes;
    const old = this.boxMesh, parent = old.parent;
    this.boxMesh = new THREE.InstancedMesh(old.geometry, old.material, this.boxes.length);
    this.boxMesh.castShadow = true; this.boxMesh.frustumCulled = false;
    parent?.remove(old); parent?.add(this.boxMesh);
    this.start(null);
  }

  private now() { return performance.now(); }

  /** A new race: everything back in place, nothing held. */
  start(online: ColyseusSession | null) {
    this.online = online;
    this.local.reset();
    this.hidden.clear(); this.predictedHidden.clear(); this.hazards = []; this.hazardHit.clear(); this.hazardSeen.clear(); this.rocketChecked.clear(); this.starTouched.clear();
    for (const m of this.magnets.values()) m.o.removeFromParent(); this.magnets.clear();
    this.held = null; this.rolling = null; this.myShieldUntil = 0; this.remoteShields.clear();
    this.syncPeels();
    this.slot();
  }

  /** Back to the menu: drop items and hide bubbles. */
  stop() { this.start(null); for (const b of this.bubbles.values()) b.visible = false; }

  get shielded() { return this.myShieldUntil > this.now(); }

  // ---------- online messages ----------
  onWorld(w: WorldMessage, me: string) {
    this.hidden = new Set(w.items?.hidden ?? []);
    this.hazards = (w.items?.hazards ?? []).filter((h) => !this.hazardHit.has(h.id));
    this.remoteShields = new Set(w.players.filter((p) => p.shield && p.id !== me).map((p) => p.id));
    this.syncPeels();
  }
  onGot(d: ItemGotMessage) {
    if (this.rolling) this.rolling.item = d.item;
    else { this.held = { item: d.item, uses: d.uses }; this.slot(); }
    this.pendingUses = d.uses;
  }
  private pendingUses = 1;
  onUsed(d: ItemUsedMessage, me: string) {
    if (d.hazard && !this.hazards.some((h) => h.id === d.hazard!.id)) { this.hazards.push(d.hazard); this.syncPeels(); }
    if (d.id !== me && d.item === 'shield') this.remoteShields.add(d.id);
    if (d.id !== me && d.item === 'magnet') this.showMagnet(d.id);
    if (d.thunder) this.strike(d.thunder, me);
  }

  /** Mini Thunder: lightning on everyone ahead; shields pop instead. */
  private strike(hits: ThunderHit[], me: string) {
    for (const h of hits) {
      const id = h.id === me ? 'me' : h.id;
      const root = this.racerRoot?.(id);
      if (root) this.bolt(root.position.x, root.position.z);
      if (h.blocked) { if (id === 'me') this.myShieldUntil = 0; else this.remoteShields.delete(id); this.popBubble(id); if (id === 'me') this.onSay?.('Shield saved you!'); continue; }
      if (id === 'me') { this.onShrink?.(); this.onFlash?.(); this.onSay?.('Zapped!'); }
      else this.shrinkRacer?.(id);
    }
  }
  onHit(d: ItemHitMessage, me: string) {
    if (d.kind !== 'star') { this.hazardHit.add(d.hazard); this.hazards = this.hazards.filter((h) => h.id !== d.hazard); this.syncPeels(); }
    if (d.victim === me) { if (d.blocked) this.myShieldUntil = 0; return; }
    if (d.blocked) { this.remoteShields.delete(d.victim); this.popBubble(d.victim); }
    else if (d.kind === 'bounce') this.hopRacer?.(d.victim);
    else this.spinRacer?.(d.victim);
  }

  // ---------- each physics step ----------
  /** Collect boxes and touch peels. Call while racing. */
  /** `y` = ground height under the kart, so a peel on the bridge can't hit you on the road below. */
  step(me: string, x: number, z: number, place: number, of: number, y = 0) {
    const now = this.now();
    // item boxes
    for (const b of this.boxes) {
      if (this.isHidden(b.id, now) || Math.hypot(x - b.x, z - b.z) > BOX_REACH) continue;
      if (this.online) {
        this.predictedHidden.set(b.id, now + 1500);
        if (!this.held && !this.rolling) { this.rolling = { until: now + ROLL_MS, item: null, since: now }; this.online.pickBox(b.id); }
      } else {
        const item = this.local.pick(me, b.id, now, x, z, place, of);
        if (item) this.rolling = { until: now + ROLL_MS, item, since: now };
      }
    }
    // banana peels, bounce traps and rockets
    for (const h of this.hazards) {
      if (!this.hazardSeen.has(h.id)) this.hazardSeen.set(h.id, now);
      if (this.hazardHit.has(h.id) || this.starTouched.has(h.id)) continue;
      const age = (now - this.hazardSeen.get(h.id)!) / 1000;
      if (h.kind === 'rocket' || h.kind === 'star') {
        const star = h.kind === 'star';
        if (star ? (h.owner === me && age < STAR_GRACE_S) || age > STAR_LIFE_S : h.owner === me || age > ROCKET_LIFE_S) continue;
        // check the whole stretch it flew since last time, so a fast rocket can't skip past a kart
        const prev = Math.min(age, this.rocketChecked.get(h.id) ?? 0);
        this.rocketChecked.set(h.id, age);
        const r0 = rocketAt(this.path, h, prev, this.roadHalf), r1 = rocketAt(this.path, h, age, this.roadHalf);
        if (segDist(x, z, r0.x, r0.z, r1.x, r1.z) > (star ? STAR_REACH : ROCKET_REACH) || Math.abs(r1.y - y) > 2.5) continue;
      } else {
        if (Math.hypot(x - h.x, z - h.z) > HAZARD_REACH || Math.abs((h.y ?? 0) - y) > 2.5) continue;
        if (h.owner === me && age * 1000 < OWNER_GRACE_MS) continue;
      }
      if (this.online) {
        if (h.kind === 'star') this.starTouched.add(h.id);
        else { this.hazardHit.add(h.id); this.hazards = this.hazards.filter((x2) => x2.id !== h.id); this.syncPeels(); }
        this.online.hitHazard(h.id);
        this.hitMe(this.shielded, h.kind, h);
      } else {
        const r = this.local.hit(me, h.id, now);
        if (r) { if (h.kind === 'star') this.starTouched.add(h.id); this.hazards = this.local.hazards.slice(); this.syncPeels(); this.hitMe(r.blocked, h.kind, h); }
      }
    }
    if (!this.online) { this.local.tick(now); this.hazards = this.local.hazards.slice(); }
    for (const h of this.hazards) if (!this.hazardSeen.has(h.id)) this.hazardSeen.set(h.id, now);
  }

  private hitMe(blocked: boolean, kind: Hazard['kind'], h: Hazard) {
    if (kind === 'rocket') { const r = rocketAt(this.path, h, (this.now() - (this.hazardSeen.get(h.id) ?? this.now())) / 1000); this.burst(r.x, r.y + 1, r.z); }
    if (blocked) { this.myShieldUntil = 0; this.popBubble('me'); this.onSay?.('Shield saved you!'); return; }
    if (kind === 'bounce') { this.onBounce?.(); this.onSay?.('Boing!'); }
    else { this.onSpin?.(); this.onSay?.(kind === 'rocket' ? 'Popped!' : kind === 'star' ? 'Chaos!' : 'Slipped!'); }
  }

  /** E / LB: use what you hold. */
  use(me: string, x: number, z: number, yaw: number, y = 0) {
    if (!this.held || this.rolling) return;
    const now = this.now();
    const item = this.held.item;
    if (this.online) {
      this.online.useItem();
      this.held.uses -= 1;
      if (this.held.uses <= 0) this.held = null;
    } else {
      const r = this.local.use(me, now, x, z, yaw, [], y);
      if (!r) return;
      if (r.thunder) this.strike(r.thunder, me);
      this.held = r.usesLeft > 0 ? { item, uses: r.usesLeft } : null;
      if (r.hazard) { this.hazardSeen.set(r.hazard.id, now); this.hazards = this.local.hazards.slice(); this.syncPeels(); }
    }
    if (item === 'juice') this.onBoost?.();
    if (item === 'shield') { this.myShieldUntil = now + SHIELD_MS; this.onSay?.('Bubble Shield!'); }
    if (item === 'banana') this.onSay?.('Banana Slip dropped');
    if (item === 'bounce') this.onSay?.('Bounce Trap set');
    if (item === 'rocket') this.onSay?.('Rocket Pop!');
    if (item === 'magnet') { this.onMagnet?.(); this.showMagnet('me'); this.onSay?.('Magnet!'); }
    if (item === 'thunder') { this.onSay?.('Mini Thunder!'); if (!this.online) this.bolt(x + Math.sin(yaw) * 25, z + Math.cos(yaw) * 25); }
    if (item === 'star') this.onSay?.('Chaos Star!');
    this.slot();
  }

  private isHidden(id: number, now: number) {
    if (this.online) return this.hidden.has(id) || (this.predictedHidden.get(id) ?? 0) > now;
    return !this.local.boxReady(id, now);
  }

  private slot() {
    this.onSlot?.(this.held?.item ?? null, this.held?.uses ?? 0, null);
  }

  // ---------- each frame ----------
  frame(dt: number, time: number) {
    const now = this.now();
    // the slot spins through icons, then lands on the item
    if (this.rolling) {
      const r = this.rolling;
      if (now >= r.until && (r.item || now - r.since > 2500)) {
        this.rolling = null;
        if (r.item) { this.held = { item: r.item, uses: this.online ? this.pendingUses : ITEMS[r.item].uses }; this.onSay?.(ITEMS[r.item].name + '!'); }
        this.slot();
      } else {
        const ids = Object.keys(ITEMS) as ItemId[];
        this.onSlot?.(null, 0, ids[Math.floor(now / 90) % ids.length]);
      }
    }
    // boxes bob and turn; broken ones shrink away and grow back
    const ease = Math.min(1, dt * 10);
    this.boxes.forEach((b, i) => {
      const target = this.isHidden(b.id, now) ? 0 : 1;
      const sc = (this.boxScale[i] ?? 1) + (target - (this.boxScale[i] ?? 1)) * ease;
      this.boxScale[i] = sc;
      this.dummy.position.set(b.x, 1.3 + Math.sin(time * 2 + i) * 0.18, b.z);
      this.dummy.rotation.set(0.5, time * 1.4 + i, 0.3);
      this.dummy.scale.setScalar(Math.max(0.0001, sc));
      this.dummy.updateMatrix();
      this.boxMesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.boxMesh.instanceMatrix.needsUpdate = true;
    // hazards: peels turn slowly, traps squash and stretch, rockets fly along the road
    for (const h of this.hazards) {
      const o = this.peels.get(h.id); if (!o) continue;
      if (h.kind === 'banana') o.rotation.y += dt * 0.3;
      if (h.kind === 'bounce') { const top = o.getObjectByName('top'); if (top) top.position.y = 0.55 + Math.abs(Math.sin(time * 5 + h.id)) * 0.12; }
      if (h.kind === 'star') {
        const age = (now - (this.hazardSeen.get(h.id) ?? now)) / 1000;
        if (age > STAR_LIFE_S) { if (o.visible) { o.visible = false; this.burst(o.position.x, 1.2, o.position.z); } continue; }
        const r = rocketAt(this.path, h, age, this.roadHalf);
        o.position.set(r.x, r.y + 1.2 + Math.abs(Math.sin(age * 5)) * 0.8, r.z); o.rotation.set(0, r.yaw + Math.PI / 2, age * 9);
        if (Math.random() < 0.6) this.trail(r.x, r.z, r.y + 1.2);
        continue;
      }
      if (h.kind === 'rocket') {
        const age = (now - (this.hazardSeen.get(h.id) ?? now)) / 1000;
        if (age > ROCKET_LIFE_S) { if (o.visible) { o.visible = false; this.burst(o.position.x, 1, o.position.z); } continue; }
        const r = rocketAt(this.path, h, age);
        o.position.set(r.x, r.y + 1.0 + Math.sin(age * 18) * 0.06, r.z); o.rotation.set(0, r.yaw, 0);
        const spin = o.getObjectByName('spin'); if (spin) spin.rotation.z = age * 14;
        this.trail(r.x - Math.sin(r.yaw) * 0.9, r.z - Math.cos(r.yaw) * 0.9, r.y + 1.0);
      }
    }
    // magnets float over karts while they pull
    for (const [id, m] of this.magnets) {
      if (now > m.until) { m.o.removeFromParent(); this.magnets.delete(id); continue; }
      const root = this.racerRoot?.(id);
      if (root && m.o.parent !== root) root.add(m.o);
      m.o.position.y = 2.7 + Math.sin(time * 6) * 0.12; m.o.rotation.set(0, Math.sin(time * 4) * 0.35, Math.sin(time * 9) * 0.08);
    }
    // lightning bolts flash and fade
    for (const b of this.bolts) { b.t += dt; b.m.visible = Math.floor(b.t * 30) % 3 !== 2; b.m.scale.x = b.m.scale.z = Math.max(0.05, 1 - b.t * 2.5); }
    this.bolts = this.bolts.filter((b) => { if (b.t > 0.4) { b.m.removeFromParent(); return false; } return true; });
    // sparks and confetti
    for (const q of this.bits) {
      q.life -= dt; q.v.y -= 9 * dt * q.grav;
      q.m.position.addScaledVector(q.v, dt); q.m.rotation.x += dt * 8; q.m.scale.setScalar(Math.max(0.01, q.life / q.max) * q.size);
    }
    this.bits = this.bits.filter((q) => { if (q.life <= 0) { this.bitGroup.remove(q.m); return false; } return true; });
    // shields
    const want = new Set<string>(this.remoteShields);
    if (this.shielded) want.add('me');
    for (const id of want) {
      const root = this.racerRoot?.(id);
      if (!root) continue;
      let b = this.bubbles.get(id);
      if (!b) { b = this.makeBubble(); this.bubbles.set(id, b); }
      if (b.parent !== root) root.add(b);
      b.visible = true;
      const left = id === 'me' ? (this.myShieldUntil - now) / 1000 : 9;
      const flicker = left < 2 ? (Math.sin(time * 30) > 0 ? 1 : 0.35) : 1;
      const u = (b.material as THREE.ShaderMaterial).uniforms; u.uOpacity.value = flicker; u.uTime.value = time;
      b.scale.setScalar(1.75 + Math.sin(time * 4) * 0.04);
    }
    for (const [id, b] of this.bubbles) if (!want.has(id)) b.visible = false;
    // shield pops: a quick expanding flash
    for (const p of this.pops) {
      p.t += dt; p.m.scale.setScalar(1.8 + p.t * 6);
      (p.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.6 - p.t * 2);
    }
    this.pops = this.pops.filter((p) => { if (p.t > 0.3) { p.m.removeFromParent(); return false; } return true; });
  }

  /** Bubble Shield: clear in the middle, a bright sky-blue rim, like a soap bubble. */
  private makeBubble() {
    const m = new THREE.Mesh(this.bubbleGeo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uOpacity: { value: 1 }, uTime: { value: 0 } },
      vertexShader: /* glsl */`varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); vP = position; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */`uniform float uOpacity; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
          vec3 sky = vec3(0.42, 0.66, 0.90), lav = vec3(0.56, 0.52, 0.85), white = vec3(1.0);
          vec3 col = mix(sky, lav, 0.5 + 0.5 * sin(vP.y * 3.0 + uTime * 2.0));
          col = mix(col, white, smoothstep(0.75, 1.0, f));
          float a = (0.08 + f * 0.85) * uOpacity;
          gl_FragColor = vec4(col, a);
        }`,
    }));
    m.position.y = 1.1; m.renderOrder = 2;
    return m;
  }

  private popBubble(id: string) {
    const root = this.racerRoot?.(id); if (!root) return;
    const m = new THREE.Mesh(this.bubbleGeo, new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.6, depthWrite: false }));
    m.position.y = 1.1; root.add(m); this.pops.push({ m, t: 0 });
    const b = this.bubbles.get(id); if (b) b.visible = false;
  }

  /** Keep one model per peel, trap and rocket on the track. */
  private syncPeels() {
    const ids = new Set(this.hazards.map((h) => h.id));
    for (const [id, o] of this.peels) if (!ids.has(id)) { this.peelGroup.remove(o); this.peels.delete(id); }
    for (const h of this.hazards) {
      if (this.peels.has(h.id)) continue;
      const o = h.kind === 'rocket' ? rocketModel() : h.kind === 'star' ? chaosStar() : h.kind === 'bounce' ? bounceTrap() : bananaPeel();
      o.position.set(h.x, h.y ?? 0, h.z); if (h.kind !== 'rocket' && h.kind !== 'star') o.rotation.y = (h.id * 2.4) % 6.28;
      this.peelGroup.add(o); this.peels.set(h.id, o);
    }
  }

  // ---------- little particles ----------
  private bitGroup = new THREE.Group();
  private bits: { m: THREE.Mesh; v: THREE.Vector3; life: number; max: number; size: number; grav: number }[] = [];
  private bitGeo = new THREE.BoxGeometry(0.18, 0.18, 0.05);
  private bitMats = [0xff8a00, 0xfcc945, 0xe54b4b, 0x8f84d9, 0x6ca9e6, 0xf2f2f0].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  private trailMat = new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.8 });

  /** Magnet: a red horseshoe magnet spinning above the kart while it pulls. */
  private showMagnet(id: string) {
    this.magnets.get(id)?.o.removeFromParent();
    this.magnets.set(id, { o: magnetModel(), until: this.now() + MAGNET_S * 1000 });
  }

  /** Mini Thunder: a jagged yellow-white bolt from the sky down to (x, z). */
  private bolt(x: number, z: number) {
    const g = new THREE.Group();
    let px = x + 2, py = 26, pz = z, side = 1;
    const core = this.boltCore;
    while (py > 0.6) {
      side = -side;
      const nx = x + side * (1.6 + Math.random() * 1.2), ny = Math.max(0.6, py - 3.5 - Math.random() * 2), nz = z + (Math.random() - 0.5) * 1.0;
      const len = Math.hypot(nx - px, ny - py, nz - pz);
      for (const [mat, w] of [[this.boltMat, 2.6], [core, 1.1]] as const) {
        const seg = new THREE.Mesh(this.bitGeo, mat);
        seg.scale.set(w, len / 0.18, w * 3.6);
        seg.position.set((px + nx) / 2, (py + ny) / 2, (pz + nz) / 2);
        seg.lookAt(nx, ny, nz); seg.rotateX(Math.PI / 2);
        if (mat === core) seg.renderOrder = 3;
        g.add(seg);
      }
      px = nx; py = ny; pz = nz;
    }
    this.peelGroup.add(g); this.bolts.push({ m: g, t: 0 });
    this.burst(x, 0.6, z);
  }

  /** Firework pop: a burst of confetti in the board colours. */
  private burst(x: number, y: number, z: number) {
    if (!this.bitGroup.parent) this.peelGroup.parent?.add(this.bitGroup);
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(this.bitGeo, this.bitMats[i % this.bitMats.length]);
      m.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2, up = 3 + Math.random() * 5, out = 3 + Math.random() * 4;
      this.bitGroup.add(m);
      this.bits.push({ m, v: new THREE.Vector3(Math.cos(a) * out, up, Math.sin(a) * out), life: 0.9, max: 0.9, size: 1, grav: 1 });
    }
  }

  /** A few sparks behind a flying rocket. */
  private trail(x: number, z: number, y = 1.0) {
    if (!this.bitGroup.parent) this.peelGroup.parent?.add(this.bitGroup);
    if (this.bits.length > 160) return;
    const m = new THREE.Mesh(this.bitGeo, y > 1 ? this.bitMats[Math.floor(Math.random() * this.bitMats.length)] : this.trailMat);
    m.position.set(x + (Math.random() - 0.5) * 0.2, y, z + (Math.random() - 0.5) * 0.2);
    this.bitGroup.add(m);
    this.bits.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.2, (Math.random() - 0.5) * 1.5), life: 0.35, max: 0.35, size: 1.4, grav: 0.2 });
  }
}

/** Item box: a frosted gem-cut cube in Racing Orange and Lavender with a sparkle on each face. */
function boxMaterial() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#FF8A00'); grad.addColorStop(1, '#8F84D9');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(242,242,240,0.22)'; g.fillRect(14, 14, 228, 228);
  g.strokeStyle = '#F2F2F0'; g.lineWidth = 10; g.strokeRect(14, 14, 228, 228);
  // four-point sparkle
  g.fillStyle = '#F2F2F0';
  g.beginPath();
  const cx = 128, cy = 128, R = 78, r = 18;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rad = i % 2 ? r : R; g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
  g.closePath(); g.fill();
  g.beginPath(); g.arc(190, 66, 12, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.35, transparent: true, opacity: 0.92 });
}

/** Rocket Pop: a striped firework rocket with a yellow nose cone and lavender fins. Points +z. */
function rocketModel() {
  const red = gloss(0xe54b4b), white = vinyl(0xf2f2f0, 0.4), nose = gloss(0xfcc945), fin = vinyl(0x8f84d9, 0.4), fire = new THREE.MeshBasicMaterial({ color: 0xffa62b });
  const spin = group();
  spin.name = 'spin';
  spin.add(cyl(red, [0, 0, 0], 0.2, 0.9, [Math.PI / 2, 0, 0]));
  spin.add(cyl(white, [0, 0, 0.12], 0.205, 0.12, [Math.PI / 2, 0, 0]), cyl(white, [0, 0, -0.18], 0.205, 0.12, [Math.PI / 2, 0, 0]));
  spin.add(cone(nose, [0, 0, 0.62], 0.2, 0.36, [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    spin.add(part(G.rbox(0.04, 0.26, 0.3, 0.02), fin, [Math.sin(a) * 0.24, Math.cos(a) * 0.24, -0.4], 1, [0, 0, -a]));
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 12), fire);
  flame.rotation.x = -Math.PI / 2; flame.position.z = -0.75;
  const g = group([0, 0, 0], spin, flame);
  g.scale.setScalar(1.4);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== flame) o.castShadow = true; });
  return g;
}

/** Chaos Star: a chunky lavender star with a yellow heart and rim, tumbling as it rolls. */
function chaosStar() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.42 : 1;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 3 });
  geo.center();
  const body = new THREE.Mesh(geo, gloss(0x8f84d9));
  const heart = new THREE.Mesh(geo, gloss(0xfcc945)); heart.scale.set(0.5, 0.5, 1.25);
  const g = group([0, 0, 0], body, heart);
  g.scale.setScalar(0.95);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return g;
}

/** Magnet: a classic red horseshoe with silver tips. */
function magnetModel() {
  const red = gloss(0xe54b4b), tip = gloss(0xf2f2f0);
  const g = group();
  g.add(part(G.torus(0.42, 0.14, Math.PI), red, [0, 0, 0], 1, [0, 0, Math.PI]));
  for (const sx of [-1, 1]) { g.add(cyl(red, [sx * 0.42, 0.18, 0], 0.14, 0.36)); g.add(cyl(tip, [sx * 0.42, 0.44, 0], 0.145, 0.18)); }
  g.scale.setScalar(1.1);
  return g;
}

/** Bounce Trap: a sage-green pad on a fat white spring, sitting on a dark base plate. */
function bounceTrap() {
  const base = vinyl(0x3a3f47, 0.6), coil = gloss(0xf2f2f0), pad = vinyl(0x7aa58a, 0.45), stripe = vinyl(0xfcc945, 0.4);
  const g = group();
  g.add(cyl(base, [0, 0.06, 0], 1.0, 0.12));
  for (let i = 0; i < 3; i++) g.add(part(G.torus(0.55, 0.07), coil, [0, 0.18 + i * 0.14, 0], 1, [Math.PI / 2, 0, 0]));
  const top = group([0, 0.55, 0], cyl(pad, [0, 0, 0], 0.9, 0.16), cyl(stripe, [0, 0.085, 0], 0.5, 0.02));
  top.name = 'top';
  g.add(top);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return g;
}

/** Banana Slip: an opened peel lying on the road, three flaps around a soft centre. */
function bananaPeel() {
  const peel = vinyl(0xfcc945, 0.45), inside = vinyl(0xf7e7a6, 0.7), tip = gloss(0x6b4a1e);
  const g = group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const flap = blob(peel, [Math.sin(a) * 0.55, 0.07, Math.cos(a) * 0.55], [0.32, 0.07, 0.62], [0, a, 0]);
    const lining = blob(inside, [Math.sin(a) * 0.5, 0.11, Math.cos(a) * 0.5], [0.22, 0.04, 0.48], [0, a, 0]);
    const end = blob(tip, [Math.sin(a) * 1.1, 0.07, Math.cos(a) * 1.1], 0.07);
    g.add(flap, lining, end);
  }
  g.add(blob(peel, [0, 0.2, 0], [0.32, 0.26, 0.32]));
  g.add(cyl(tip, [0, 0.5, 0], 0.07, 0.18));
  g.scale.setScalar(1.25);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
  return g;
}

/** Distance from point (px, pz) to the segment a-b. */
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
