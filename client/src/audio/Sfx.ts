/**
 * Every sound in the game, made in code with the Web Audio API (no sound files).
 * One shared instance: `sfx`. Browsers only allow sound after the first click or key press,
 * so the audio starts itself then.
 */
type Shot = 'drift' | 'boostMini' | 'boostBig' | 'wall' | 'kart' | 'beep' | 'go' | 'lap' | 'finalLap' | 'win' | 'finish' | 'hover' | 'select' | 'back' | 'ready' | 'ice' | 'mud';

const VOL_KEY = 'tr-volume', MUTE_KEY = 'tr-muted';
const LEVELS = [1, 0.75, 0.5, 0.25];
const N = (n: number) => 440 * Math.pow(2, (n - 69) / 12);   // note number to Hz

function load<T>(key: string, fallback: T, parse: (s: string) => T): T {
  try { const v = localStorage.getItem(key); return v == null ? fallback : parse(v); } catch { return fallback; }
}
function save(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* private mode */ } }

interface Engine { o1: OscillatorNode; o2: OscillatorNode; sub: OscillatorNode; lp: BiquadFilterNode; g: GainNode; lfo: OscillatorNode }
interface Squeal { g: GainNode; bq: BiquadFilterNode }

class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noiseBuf!: AudioBuffer;
  private engine: Engine | null = null;
  private squeal: Squeal | null = null;
  /** Glassy hiss of tyres sliding on ice (Frostbite Pass). */
  private glide: Squeal | null = null;
  volume = load(VOL_KEY, 0.75, (s) => Math.min(1, Math.max(0, Number(s) || 0)));
  muted = load(MUTE_KEY, false, (s) => s === '1');
  private lastHover = 0;

  constructor() {
    const unlock = () => this.ensure();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    // menu sounds for every button in the game
    document.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement)?.closest?.('button');
      if (!b || b.dataset.sfx === 'none') return;
      const t = b.textContent?.toLowerCase() ?? '';
      this.play(b.dataset.sfx as Shot || (/leave|quit|back|cancel|not ready/.test(t) ? 'back' : /ready/.test(t) ? 'ready' : 'select'));
    }, true);
    const hover = (e: Event) => {
      const b = (e.target as HTMLElement)?.closest?.('button');
      if (!b || b.disabled || (e.type === 'mouseover' && b.contains((e as MouseEvent).relatedTarget as Node))) return;
      const now = performance.now(); if (now - this.lastHover < 60) return; this.lastHover = now;
      this.play('hover');
    };
    document.addEventListener('mouseover', hover, true);
    document.addEventListener('focusin', hover, true);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM' && (e.target as HTMLElement)?.tagName !== 'INPUT') this.setMuted(!this.muted);
    });
  }

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const c = this.ctx = new AC();
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      this.master = c.createGain(); this.master.gain.value = this.level;
      this.master.connect(comp).connect(c.destination);
      this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }
  /** Only make sounds once the browser has let audio start. */
  private get live() { return !!this.ctx && this.ctx.state === 'running'; }
  private get level() { return this.muted ? 0 : this.volume; }

  // ---------- settings ----------
  setMuted(on: boolean) { this.muted = on; save(MUTE_KEY, on ? '1' : '0'); this.applyLevel(); this.onChange?.(); }
  /** The pause menu's Sound button: 100% → 75% → 50% → 25% → off → 100%. */
  cycleVolume() {
    if (this.muted) { this.muted = false; this.volume = 1; }
    else { const i = LEVELS.findIndex((l) => this.volume >= l - 0.01); const next = LEVELS[i + 1]; if (next === undefined) this.muted = true; else this.volume = next; }
    save(VOL_KEY, String(this.volume)); save(MUTE_KEY, this.muted ? '1' : '0'); this.applyLevel(); this.onChange?.();
  }
  get label() { return this.muted || this.volume === 0 ? 'OFF' : `${Math.round(this.volume * 100)}%`; }
  onChange?: () => void;
  private applyLevel() { if (this.ctx) this.master.gain.setTargetAtTime(this.level, this.ctx.currentTime, 0.02); }

  // ---------- building blocks ----------
  private env(g: GainNode, t: number, a: number, peak: number, dec: number) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  private tone(o: { type?: OscillatorType; f: number; f2?: number; t?: number; dur?: number; a?: number; peak?: number; detune?: number; filt?: number }) {
    const c = this.ctx!, s = c.currentTime + (o.t ?? 0), dur = o.dur ?? 0.2, a = o.a ?? 0.005;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type ?? 'sine'; osc.frequency.setValueAtTime(o.f, s); osc.detune.value = o.detune ?? 0;
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, s + dur);
    this.env(g, s, a, o.peak ?? 0.3, dur);
    let n: AudioNode = osc;
    if (o.filt) { const bq = c.createBiquadFilter(); bq.type = 'lowpass'; bq.frequency.value = o.filt; osc.connect(bq); n = bq; }
    n.connect(g).connect(this.master); osc.start(s); osc.stop(s + a + dur + 0.05);
  }
  private noise(o: { t?: number; dur?: number; a?: number; peak?: number; type?: BiquadFilterType; f?: number; f2?: number; q?: number }) {
    const c = this.ctx!, s = c.currentTime + (o.t ?? 0), dur = o.dur ?? 0.3;
    const src = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf; bq.type = o.type ?? 'bandpass'; bq.Q.value = o.q ?? 1; bq.frequency.setValueAtTime(o.f ?? 1000, s);
    if (o.f2) bq.frequency.exponentialRampToValueAtTime(o.f2, s + dur);
    this.env(g, s, o.a ?? 0.01, o.peak ?? 0.3, dur);
    src.connect(bq).connect(g).connect(this.master); src.start(s, Math.random()); src.stop(s + (o.a ?? 0.01) + dur + 0.05);
  }
  private chord(notes: number[], o: Parameters<Sfx['tone']>[0] & { strum?: number }) {
    notes.forEach((f, i) => this.tone({ ...o, f, t: (o.t ?? 0) + (o.strum ?? 0) * i }));
  }

  // ---------- one-shot sounds ----------
  /** `strength` 0..1 scales bump sounds. */
  play(name: Shot, strength = 1) {
    if (!this.live) return;
    const k = Math.max(0.15, Math.min(1, strength));
    switch (name) {
      case 'drift': [0, 1].forEach((i) => this.tone({ type: 'triangle', f: N(84 + i * 5), dur: 0.12, peak: 0.08 })); break;   // spark level-up tick
      case 'boostMini': this.noise({ dur: 0.45, peak: 0.35, f: 500, f2: 2600, q: 1.2 }); this.tone({ type: 'sawtooth', f: 110, f2: 260, dur: 0.4, peak: 0.12, filt: 1400 }); break;
      case 'boostBig':
        this.noise({ dur: 0.8, peak: 0.45, f: 350, f2: 4200, q: 1 }); this.tone({ type: 'sawtooth', f: 90, f2: 330, dur: 0.7, peak: 0.16, filt: 1800 });
        this.tone({ type: 'square', f: 180, f2: 520, dur: 0.6, peak: 0.05, filt: 2200, detune: 7 }); this.tone({ type: 'triangle', f: N(88), t: 0.02, dur: 0.25, peak: 0.07 }); break;
      case 'wall': this.tone({ f: 140, f2: 38, dur: 0.22, peak: 0.6 * k }); this.noise({ dur: 0.12, peak: 0.35 * k, type: 'lowpass', f: 1600, f2: 300 }); this.noise({ t: 0.01, dur: 0.2, peak: 0.12 * k, f: 3500, q: 3 }); break;
      case 'kart': this.tone({ f: 220, f2: 90, dur: 0.14, peak: 0.4 * k }); this.tone({ type: 'triangle', f: 420, f2: 300, dur: 0.1, peak: 0.12 * k }); this.noise({ dur: 0.08, peak: 0.2 * k, type: 'lowpass', f: 2500, f2: 600 }); break;
      case 'beep': this.tone({ type: 'square', f: N(72), dur: 0.22, peak: 0.16, filt: 3000 }); this.tone({ f: N(72), dur: 0.3, peak: 0.18 }); break;
      case 'go': this.chord([N(84), N(88), N(91)], { type: 'square', f: 0, dur: 0.7, peak: 0.1, filt: 4500 }); this.tone({ f: N(96), dur: 0.6, peak: 0.15 }); this.noise({ dur: 0.5, peak: 0.15, f: 2000, f2: 6000 }); break;
      case 'lap': this.tone({ type: 'triangle', f: N(76), dur: 0.25, peak: 0.28 }); this.tone({ type: 'triangle', f: N(83), t: 0.11, dur: 0.45, peak: 0.28 }); this.tone({ f: N(95), t: 0.11, dur: 0.5, peak: 0.06 }); break;
      case 'finalLap':
        [64, 67, 71, 76].forEach((n, i) => this.tone({ type: 'sawtooth', f: N(n), t: i * 0.09, dur: 0.25, peak: 0.12, filt: 2600 }));
        this.chord([N(76), N(80), N(83), N(88)], { type: 'sawtooth', f: 0, t: 0.36, dur: 0.9, peak: 0.08, filt: 3200, detune: 6 });
        this.tone({ type: 'triangle', f: N(52), t: 0.36, dur: 0.9, peak: 0.25 }); this.noise({ t: 0.36, dur: 0.4, peak: 0.1, f: 3000, q: 0.7 }); break;
      case 'win':
        [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36]].forEach(([n, t]) => this.tone({ type: 'square', f: N(n), t, dur: 0.18, peak: 0.09, filt: 3500 }));
        this.chord([N(72), N(76), N(79), N(84)], { type: 'sawtooth', f: 0, t: 0.52, dur: 1.4, peak: 0.07, filt: 2800, detune: 5 });
        this.chord([N(88), N(91)], { type: 'triangle', f: 0, t: 0.52, dur: 1.3, peak: 0.08 });
        this.tone({ type: 'triangle', f: N(48), t: 0.52, dur: 1.3, peak: 0.3 }); [0, 0.14, 0.28].forEach((t) => this.noise({ t: 0.52 + t, dur: 0.15, peak: 0.08, f: 7000, q: 2 })); break;
      case 'finish': [67, 71, 74].forEach((n, i) => this.tone({ type: 'triangle', f: N(n), t: i * 0.12, dur: 0.3, peak: 0.22 })); this.chord([N(67), N(71), N(74), N(79)], { type: 'triangle', f: 0, t: 0.36, dur: 1, peak: 0.1 }); break;
      case 'hover': this.tone({ f: 2200, dur: 0.03, a: 0.002, peak: 0.06 }); break;
      case 'select': this.tone({ type: 'triangle', f: N(81), dur: 0.08, a: 0.002, peak: 0.2 }); this.tone({ type: 'triangle', f: N(88), t: 0.05, dur: 0.12, peak: 0.16 }); break;
      case 'back': this.tone({ type: 'triangle', f: N(81), dur: 0.08, a: 0.002, peak: 0.18 }); this.tone({ type: 'triangle', f: N(74), t: 0.05, dur: 0.12, peak: 0.15 }); break;
      // hitting ice: a frosty crackle and two glassy pings
      case 'ice': this.noise({ dur: 0.18, peak: 0.12, f: 6500, f2: 3000, q: 3 }); this.tone({ f: N(100), dur: 0.25, peak: 0.05 }); this.tone({ f: N(107), t: 0.05, dur: 0.35, peak: 0.04 }); break;
      // driving into mud: a low wet squelch
      case 'mud': this.noise({ dur: 0.28, peak: 0.3, type: 'lowpass', f: 900, f2: 180, q: 4 }); this.tone({ f: 120, f2: 55, dur: 0.25, peak: 0.25 }); this.tone({ type: 'triangle', f: 260, f2: 140, t: 0.08, dur: 0.15, peak: 0.08 }); break;
      case 'ready': this.tone({ type: 'triangle', f: N(79), dur: 0.1, peak: 0.2 }); this.tone({ type: 'triangle', f: N(86), t: 0.08, dur: 0.25, peak: 0.2 }); this.noise({ t: 0.08, dur: 0.2, peak: 0.05, f: 6000, q: 2 }); break;
    }
  }

  // ---------- running sounds ----------
  /**
   * Called every frame during a race. `speed` 0..1 of top speed, `drift` 0 = none, 1..3 = drifting with
   * sparks level 0..2. `on` false silences both (title screen, frozen pause).
   */
  drive(on: boolean, speed: number, throttle: boolean, drift: number, ice = false) {
    if (!this.live) return;
    const c = this.ctx!, t = c.currentTime;
    if (on && !this.engine) this.engine = this.makeEngine();
    if (on && !this.squeal) this.squeal = this.makeSqueal();
    if (on && ice && !this.glide) this.glide = this.makeGlide();
    if (this.engine) {
      const e = this.engine, v = on ? Math.min(1.2, Math.max(0, speed)) : 0, f = 48 + v * 120 + (throttle ? 6 : 0);
      e.o1.frequency.setTargetAtTime(f, t, 0.08); e.o2.frequency.setTargetAtTime(f * 1.5, t, 0.08); e.sub.frequency.setTargetAtTime(f / 2, t, 0.08);
      e.lp.frequency.setTargetAtTime(380 + v * 1700 + (throttle ? 200 : 0), t, 0.08); e.lfo.frequency.setTargetAtTime(18 + v * 30, t, 0.08);
      e.g.gain.setTargetAtTime(on ? 0.11 + v * 0.07 + (throttle ? 0.02 : 0) : 0, t, on ? 0.08 : 0.05);
    }
    if (this.squeal) {
      const s = this.squeal, level = drift - 1;
      s.g.gain.setTargetAtTime(on && drift > 0 ? 0.13 : 0, t, 0.04);
      s.bq.frequency.setTargetAtTime(1800 + Math.max(0, level) * 650, t, 0.1);
    }
    if (this.glide) {
      const v = Math.min(1, Math.max(0, speed));
      this.glide.g.gain.setTargetAtTime(on && ice ? 0.025 + v * 0.09 : 0, t, ice ? 0.05 : 0.12);
      this.glide.bq.frequency.setTargetAtTime(4200 + v * 2600, t, 0.1);
    }
  }
  private makeGlide(): Squeal {
    const c = this.ctx!;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const bq = c.createBiquadFilter(); bq.type = 'bandpass'; bq.Q.value = 2.2; bq.frequency.value = 4500;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    // a slow shimmer so it sounds like skating, not wind
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 900; lfo.connect(lg).connect(bq.frequency);
    const g = c.createGain(); g.gain.value = 0;
    src.connect(hp).connect(bq).connect(g).connect(this.master); src.start(); lfo.start();
    return { g, bq };
  }

  private makeEngine(): Engine {
    const c = this.ctx!;
    const o1 = c.createOscillator(), o2 = c.createOscillator(), sub = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    const lfo = c.createOscillator(), lg = c.createGain(), mix2 = c.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; sub.type = 'sine'; o2.detune.value = 8; mix2.gain.value = 0.35; lp.type = 'lowpass'; lp.Q.value = 2.5;
    lfo.frequency.value = 20; lg.gain.value = 0.03; lfo.connect(lg).connect(g.gain);
    o1.connect(lp); o2.connect(mix2).connect(lp); sub.connect(lp); lp.connect(g).connect(this.master); g.gain.value = 0;
    for (const o of [o1, o2, sub, lfo]) o.start();
    return { o1, o2, sub, lp, g, lfo };
  }
  private makeSqueal(): Squeal {
    const c = this.ctx!;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const bq = c.createBiquadFilter(); bq.type = 'bandpass'; bq.Q.value = 6; bq.frequency.value = 1800;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 13; lg.gain.value = 220; lfo.connect(lg).connect(bq.frequency);
    const g = c.createGain(); g.gain.value = 0;
    src.connect(bq).connect(g).connect(this.master); src.start(); lfo.start();
    return { g, bq };
  }
}

export const sfx = new Sfx();
