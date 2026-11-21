import * as THREE from 'three';
import { ItemWorld, ITEMS, BOX_REACH, HAZARD_REACH, ROLL_MS, SHIELD_MS, OWNER_GRACE_MS, type Hazard, type ItemId } from '@shared/items';
import type { TrackPath } from '@shared/trackMath';
import type { WorldMessage, ItemGotMessage, ItemUsedMessage, ItemHitMessage } from '@shared/protocol';
import type { ColyseusSession } from '../net/ColyseusSession';
import { blob, cyl, group, vinyl, gloss } from '../models/toy';

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

  constructor(scene: THREE.Scene, path: TrackPath, roadHalfWidth: number) {
    this.local = new ItemWorld(path, roadHalfWidth);
    this.boxes = this.local.boxes;
    this.boxMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), boxMaterial(), this.boxes.length);
    this.boxMesh.castShadow = true;
    this.boxMesh.frustumCulled = false;
    scene.add(this.boxMesh, this.peelGroup);
  }

  private now() { return performance.now(); }

  /** A new race: everything back in place, nothing held. */
  start(online: ColyseusSession | null) {
    this.online = online;
    this.local.reset();
    this.hidden.clear(); this.predictedHidden.clear(); this.hazards = []; this.hazardHit.clear(); this.hazardSeen.clear();
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
  }
  onHit(d: ItemHitMessage, me: string) {
    this.hazardHit.add(d.hazard);
    this.hazards = this.hazards.filter((h) => h.id !== d.hazard); this.syncPeels();
    if (d.victim === me) { if (d.blocked) this.myShieldUntil = 0; return; }
    if (d.blocked) { this.remoteShields.delete(d.victim); this.popBubble(d.victim); } else this.spinRacer?.(d.victim);
  }

  // ---------- each physics step ----------
  /** Collect boxes and touch peels. Call while racing. */
  step(me: string, x: number, z: number, place: number, of: number) {
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
    // banana peels
    for (const h of this.hazards) {
      if (this.hazardHit.has(h.id) || Math.hypot(x - h.x, z - h.z) > HAZARD_REACH) continue;
      if (!this.hazardSeen.has(h.id)) this.hazardSeen.set(h.id, now);
      if (h.owner === me && now - (this.hazardSeen.get(h.id) ?? now) < OWNER_GRACE_MS) continue;
      if (this.online) {
        this.hazardHit.add(h.id);
        this.online.hitHazard(h.id);
        this.hazards = this.hazards.filter((x2) => x2.id !== h.id); this.syncPeels();
        this.hitMe(this.shielded);
      } else {
        const r = this.local.hit(me, h.id, now);
        if (r) { this.hazards = this.local.hazards.slice(); this.syncPeels(); this.hitMe(r.blocked); }
      }
    }
    if (!this.online) { this.local.tick(now); this.hazards = this.local.hazards.slice(); }
    for (const h of this.hazards) if (!this.hazardSeen.has(h.id)) this.hazardSeen.set(h.id, now);
  }

  private hitMe(blocked: boolean) {
    if (blocked) { this.myShieldUntil = 0; this.popBubble('me'); this.onSay?.('Shield saved you!'); }
    else { this.onSpin?.(); this.onSay?.('Slipped!'); }
  }

  /** E / LB: use what you hold. */
  use(me: string, x: number, z: number, yaw: number) {
    if (!this.held || this.rolling) return;
    const now = this.now();
    const item = this.held.item;
    if (this.online) {
      this.online.useItem();
      this.held.uses -= 1;
      if (this.held.uses <= 0) this.held = null;
    } else {
      const r = this.local.use(me, now, x, z, yaw);
      if (!r) return;
      this.held = r.usesLeft > 0 ? { item, uses: r.usesLeft } : null;
      if (r.hazard) { this.hazardSeen.set(r.hazard.id, now); this.hazards = this.local.hazards.slice(); this.syncPeels(); }
    }
    if (item === 'juice') this.onBoost?.();
    if (item === 'shield') { this.myShieldUntil = now + SHIELD_MS; this.onSay?.('Bubble Shield!'); }
    if (item === 'banana') this.onSay?.('Banana Slip dropped');
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
    // peels wobble a little
    for (const [, o] of this.peels) o.rotation.y += dt * 0.3;
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

  /** Keep one peel model per banana on the track. */
  private syncPeels() {
    const ids = new Set(this.hazards.map((h) => h.id));
    for (const [id, o] of this.peels) if (!ids.has(id)) { this.peelGroup.remove(o); this.peels.delete(id); }
    for (const h of this.hazards) {
      if (this.peels.has(h.id)) continue;
      const o = bananaPeel(); o.position.set(h.x, 0, h.z); o.rotation.y = (h.id * 2.4) % 6.28;
      this.peelGroup.add(o); this.peels.set(h.id, o);
    }
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
