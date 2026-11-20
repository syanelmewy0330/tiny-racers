import { LAPS } from '@shared/constants';
import { formatTime } from '../game/RaceTracker';
import { characterById } from '@shared/characters';
import type { ResultRow } from '@shared/protocol';
import { portraitUrl } from './CharacterPicker';

const PRACTICE_RESULTS = `<h2>Finished!</h2><div class="time" data-total></div><ol class="laps" data-laps></ol>
  <div class="row" style="justify-content:center"><button class="btn" data-again>Race again</button></div>`;

const el = (html: string) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild as HTMLElement; };
const svgNS = 'http://www.w3.org/2000/svg';

/** One row of the live standings. */
export interface StandingRow { id: string; name: string; character: string; me: boolean }
/** A racer's dot on the minimap (world x, z). */
export interface MapDot { x: number; z: number; character: string; me: boolean }

export interface HudFrame {
  lap: number; time: number; kmh: number;
  drift: number; driftLevel: number; boosting: boolean;
  countdown: number | null;
  /** Online only: my place and how many are racing. */
  place?: { n: number; of: number } | null;
  standings?: StandingRow[] | null;
  dots: MapDot[];
  net?: { state: 'online' | 'reconnecting'; ping: number | null } | null;
}

// ----- speed gauge geometry (SVG units) -----
const C = 130, R = 100, A0 = 150, SPAN = 240, MAX_KMH = 160;
const pt = (a: number, r: number) => [C + r * Math.cos((a * Math.PI) / 180), C + r * Math.sin((a * Math.PI) / 180)];
const arcPath = (a: number, b: number, r: number) => { const [x1, y1] = pt(a, r), [x2, y2] = pt(b, r); return `M${x1} ${y1} A${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x2} ${y2}`; };
const DRIFT_COLORS = ['#6ca9e6', '#fcc945', '#e54b4b'];
const HELP_KEY = 'tr-hud-help';
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/**
 * The race HUD (design board v3.0): place, lap and time pills with live standings
 * (top left), minimap (top right), item slot and controls (bottom left), speed gauge
 * with the drift-charge ring (bottom right), plus lap banners, overtakes, boosts,
 * the countdown and the finish celebration. Display only: it never changes the race.
 */
export class Hud {
  readonly root: HTMLElement;
  private results: HTMLElement;
  onRestart?: () => void;
  /** Practice results: back to the main menu (wired up by the menus milestone). */
  onMenu?: () => void;

  private q = (s: string) => this.root.querySelector(s) as HTMLElement;
  private els: Record<string, HTMLElement> = {};
  private speedArc!: SVGPathElement; private glowArc!: SVGPathElement; private driftArc!: SVGPathElement; private ticks: SVGLineElement[] = [];
  private mapDots = new Map<string, SVGCircleElement>();
  private mapLayer!: SVGGElement;
  private toMap: ((x: number, z: number) => [number, number]) | null = null;
  private shownKmh = 0;
  private lastLap = 1; private lastPlace = 0; private standKey = '';
  private moved = new Map<string, { dir: 'up' | 'down'; until: number }>();
  private prevOrder: string[] = [];
  private clock = 0; private toastTimer = 0; private placeFlash = 0; private bannerTimer = 0;
  private helpOpen: boolean;

  constructor(parent: HTMLElement) {
    this.root = el(`<div class="hud rh" hidden>
      <div class="rh-lines" data-lines></div>
      <div class="rh-top">
        <div class="rh-pill rh-place" data-place hidden><span class="n" data-pn>1</span><span class="of" data-pof>/1</span><span class="badge" data-pbadge hidden></span></div>
        <div class="rh-pill rh-small"><span class="cap">LAP</span><span class="num" data-lap>1<small>/${LAPS}</small></span></div>
        <div class="rh-pill rh-small"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="#ff8a00" stroke-width="2.6"/><path d="M12 9v4.5l3 2M9.5 3h5" stroke="#ff8a00" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg><span class="num" data-time>0:00.00</span></div>
        <div class="rh-pill rh-net" data-net hidden></div>
      </div>
      <div class="rh-standings" data-standings></div>
      <div class="rh-map"><svg data-map aria-hidden="true"></svg></div>
      <div class="rh-help" data-help>
        <div class="t">CONTROLS</div>
        <span><b class="kc">W</b> <b class="kc">↑</b></span><span>Accelerate</span>
        <span><b class="kc">S</b> <b class="kc">↓</b></span><span>Brake / reverse</span>
        <span><b class="kc">A</b> <b class="kc">D</b></span><span>Steer</span>
        <span><b class="kc">Space</b></span><span>Drift, release to boost</span>
        <span><b class="kc">E</b></span><span>Use item</span>
        <span><b class="kc">R</b></span><span>Back on track</span>
        <span><b class="kc">H</b></span><span>Hide controls</span>
      </div>
      <div class="rh-item empty" data-item><svg viewBox="0 0 100 100" data-icon aria-hidden="true"></svg><div class="key">E</div></div>
      <div class="rh-item-label" data-ilabel><span class="cap">NO ITEM</span></div>
      <div class="rh-hint" data-hint><b class="kc">H</b> Controls</div>
      <div class="rh-speedo" data-speedo>
        <svg viewBox="0 0 260 260" aria-hidden="true">
          <defs>
            <linearGradient id="rh-g" x1="0" x2="1" y1="1" y2="0"><stop offset="0" stop-color="#fcc945"/><stop offset=".55" stop-color="#ff8a00"/><stop offset="1" stop-color="#e54b4b"/></linearGradient>
            <radialGradient id="rh-face" cx=".5" cy=".42"><stop offset="0" stop-color="#3a3f47" stop-opacity=".96"/><stop offset="1" stop-color="#1c1f26" stop-opacity=".96"/></radialGradient>
            <filter id="rh-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
          </defs>
          <circle cx="130" cy="130" r="122" fill="url(#rh-face)"/>
          <circle cx="130" cy="130" r="121" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="2"/>
          <path d="${arcPath(A0, A0 + SPAN, R)}" stroke="rgba(255,255,255,.1)" stroke-width="16" fill="none" stroke-linecap="round"/>
          <path data-glow d="${arcPath(A0, A0 + SPAN, R)}" pathLength="100" stroke="#ff8a00" stroke-width="26" fill="none" stroke-linecap="round" filter="url(#rh-glow)" stroke-dasharray="0 100" opacity="0"/>
          <path data-arc d="${arcPath(A0, A0 + SPAN, R)}" pathLength="100" stroke="url(#rh-g)" stroke-width="16" fill="none" stroke-linecap="round" stroke-dasharray="0 100"/>
          <g data-ticks></g>
          <path d="${arcPath(A0 + 26, A0 + SPAN - 26, R - 20)}" stroke="rgba(255,255,255,.1)" stroke-width="5" fill="none" stroke-linecap="round"/>
          <path data-drift d="${arcPath(A0 + 26, A0 + SPAN - 26, R - 20)}" pathLength="100" stroke="#6ca9e6" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="0 100"/>
        </svg>
        <div class="read"><b class="num" data-speed>0</b><span>km/h</span></div>
        <div class="tag" data-boost>BOOST</div>
      </div>
      <div class="rh-banner" data-banner hidden><div class="r"><i class="flag"></i><div class="t shout" data-btext></div><i class="flag"></i></div></div>
      <div class="rh-toast shout" data-toast hidden></div>
      <div class="rh-big shout" data-big hidden></div>
      <div class="rh-finish" data-finish hidden><div class="big shout">FINISH!</div><div class="sub shout" data-fplace></div></div>
      <div class="rh-confetti" data-confetti></div>
    </div>`);
    this.results = el(`<div class="results" hidden><div class="panel">${PRACTICE_RESULTS}</div></div>`);
    parent.append(this.root, this.results);
    for (const k of ['place', 'pn', 'pof', 'pbadge', 'lap', 'time', 'net', 'standings', 'help', 'hint', 'speedo', 'speed', 'boost', 'banner', 'btext', 'toast', 'big', 'finish', 'fplace', 'confetti', 'lines', 'item', 'ilabel'])
      this.els[k] = this.q(`[data-${k}]`);
    this.speedArc = this.root.querySelector('[data-arc]') as unknown as SVGPathElement;
    this.glowArc = this.root.querySelector('[data-glow]') as unknown as SVGPathElement;
    this.driftArc = this.root.querySelector('[data-drift]') as unknown as SVGPathElement;
    const tickG = this.root.querySelector('[data-ticks]') as unknown as SVGGElement;
    for (let i = 0; i <= 8; i++) {
      const a = A0 + (SPAN * i) / 8, [x1, y1] = pt(a, R + 14), [x2, y2] = pt(a, R + 20);
      const l = document.createElementNS(svgNS, 'line');
      l.setAttribute('x1', String(x1)); l.setAttribute('y1', String(y1)); l.setAttribute('x2', String(x2)); l.setAttribute('y2', String(y2));
      l.setAttribute('stroke-width', '3'); l.setAttribute('stroke-linecap', 'round');
      tickG.append(l); this.ticks.push(l);
    }
    (this.results.querySelector('[data-again]') as HTMLElement).onclick = () => this.onRestart?.();

    // controls guide: open for new players, H toggles and remembers
    this.helpOpen = store.get(HELP_KEY) !== 'hidden';
    this.applyHelp();
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyH' || this.root.hidden || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      this.helpOpen = !this.helpOpen; store.set(HELP_KEY, this.helpOpen ? 'shown' : 'hidden'); this.applyHelp();
    });
  }

  private applyHelp() { this.els.help.hidden = !this.helpOpen; this.els.hint.classList.toggle('on', this.helpOpen); }

  /** Draw the track outline for the minimap (world x, z points around the loop). */
  setTrack(points: { x: number; z: number }[]) {
    const svg = this.root.querySelector('[data-map]') as unknown as SVGSVGElement;
    const W = 280, H = 240, pad = 16;
    const xs = points.map((p) => p.x), zs = points.map((p) => p.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const sc = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxZ - minZ));
    const ox = (W - pad * 2 - (maxX - minX) * sc) / 2, oz = (H - pad * 2 - (maxZ - minZ) * sc) / 2;
    this.toMap = (x, z) => [pad + ox + (maxX - x) * sc, pad + oz + (maxZ - z) * sc];
    const d = 'M' + points.filter((_, i) => i % 3 === 0).map((p) => this.toMap!(p.x, p.z).map((v) => v.toFixed(1)).join(' ')).join(' L') + ' Z';
    const [sx, sy] = this.toMap(points[0].x, points[0].z);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = `<path d="${d}" fill="none" stroke="#1c1f26" stroke-width="18" stroke-linejoin="round" opacity=".8"/>
      <path d="${d}" fill="none" stroke="#f2f2f0" stroke-width="8" stroke-linejoin="round"/>
      <rect x="${sx - 10}" y="${sy - 4}" width="20" height="8" rx="2" fill="#ff8a00" stroke="#1c1f26" stroke-width="2"/><g></g>`;
    this.mapLayer = svg.querySelector('g') as SVGGElement;
    this.mapDots.clear();
  }

  show(on: boolean) {
    this.root.hidden = !on;
    if (!on) this.results.hidden = true;
    if (on) { this.els.finish.hidden = true; this.els.banner.hidden = true; this.lastLap = 1; this.lastPlace = 0; this.standKey = ''; this.prevOrder = []; this.moved.clear(); }
  }

  update(dt: number, d: HudFrame) {
    this.clock += dt;
    const e = this.els;
    // ---- top left ----
    e.place.hidden = !d.place;
    if (d.place) {
      if (this.lastPlace && d.place.n !== this.lastPlace) this.overtake(d.place.n < this.lastPlace ? 'up' : 'down');
      this.lastPlace = d.place.n;
      e.pn.textContent = String(d.place.n); e.pof.textContent = `/${d.place.of}`;
      e.place.classList.toggle('lead', d.place.n === 1);
    }
    if (this.placeFlash > 0) { this.placeFlash -= dt; if (this.placeFlash <= 0) { e.pbadge.hidden = true; e.place.classList.remove('pop'); } }
    if (d.lap !== this.lastLap) { if (d.lap > this.lastLap) this.lapBanner(d.lap); this.lastLap = d.lap; }
    e.lap.innerHTML = `${d.lap}<small>/${LAPS}</small>`;
    e.time.textContent = formatTime(d.time);
    e.net.hidden = !d.net;
    if (d.net) {
      const bad = d.net.state === 'reconnecting';
      e.net.textContent = bad ? 'Reconnecting…' : d.net.ping === null ? 'Online' : `${d.net.ping} ms`;
      e.net.dataset.state = bad ? 'bad' : d.net.ping !== null && d.net.ping > 200 ? 'slow' : 'good';
    }
    this.standings(d.standings ?? null);

    // ---- gauge: the number eases toward the real speed, the arc follows it ----
    const kmh = Math.abs(d.kmh);
    this.shownKmh += (kmh - this.shownKmh) * (1 - Math.exp(-dt * 14));
    const f = Math.min(1, this.shownKmh / MAX_KMH) * 100;
    this.speedArc.setAttribute('stroke-dasharray', `${f} 100`);
    this.glowArc.setAttribute('stroke-dasharray', `${f} 100`);
    this.glowArc.setAttribute('opacity', d.boosting ? String(0.75 + Math.sin(this.clock * 18) * 0.25) : '0');
    this.ticks.forEach((t, i) => t.setAttribute('stroke', (i / 8) * 100 <= f + 0.5 ? '#f2f2f0' : 'rgba(242,242,240,.3)'));
    e.speed.textContent = String(Math.round(this.shownKmh));
    e.speedo.classList.toggle('boost', d.boosting);
    e.lines.classList.toggle('on', d.boosting);
    const charge = Math.min(1, d.drift / 1.6) * 100;
    this.driftArc.setAttribute('stroke-dasharray', `${charge} 100`);
    this.driftArc.setAttribute('stroke', DRIFT_COLORS[Math.min(2, d.driftLevel)]);

    // ---- minimap ----
    if (this.toMap) {
      const seen = new Set<string>();
      d.dots.forEach((o, i) => {
        const key = o.me ? 'me' : `r${i}`;
        seen.add(key);
        let c = this.mapDots.get(key);
        if (!c) {
          c = document.createElementNS(svgNS, 'circle');
          c.setAttribute('r', o.me ? '12' : '8'); c.setAttribute('stroke', '#1c1f26'); c.setAttribute('stroke-width', o.me ? '4' : '3.5');
          if (o.me) this.mapLayer.append(c); else this.mapLayer.prepend(c);
          this.mapDots.set(key, c);
        }
        c.setAttribute('fill', o.me ? '#fcc945' : hexColor(characterById(o.character).color));
        const [x, y] = this.toMap!(o.x, o.z);
        c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1));
      });
      for (const [k, c] of this.mapDots) if (!seen.has(k)) { c.remove(); this.mapDots.delete(k); }
    }

    // ---- countdown, toasts, banners ----
    if (d.countdown !== null) { e.big.hidden = false; e.big.textContent = d.countdown > 0 ? String(Math.ceil(d.countdown)) : 'GO!'; }
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) e.toast.hidden = true; }
    if (this.bannerTimer > 0) { this.bannerTimer -= dt; if (this.bannerTimer <= 0) e.banner.hidden = true; }
  }

  private standings(rows: StandingRow[] | null) {
    const box = this.els.standings;
    if (!rows || rows.length < 2) { box.hidden = true; return; }
    box.hidden = false;
    // remember who moved, to show ▲ / ▼ for a moment
    const order = rows.map((r) => r.id);
    if (this.prevOrder.length) order.forEach((id, i) => { const was = this.prevOrder.indexOf(id); if (was !== -1 && was !== i) this.moved.set(id, { dir: i < was ? 'up' : 'down', until: this.clock + 2 }); });
    this.prevOrder = order;
    for (const [id, m] of this.moved) if (m.until < this.clock) this.moved.delete(id);
    const key = rows.map((r) => `${r.id}:${r.name}:${r.character}:${this.moved.get(r.id)?.dir ?? ''}`).join('|');
    if (key === this.standKey) return;
    this.standKey = key;
    box.textContent = '';
    rows.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = `rh-pill rh-st${r.me ? ' me' : ''}`;
      const pos = document.createElement('span'); pos.className = 'pos'; pos.textContent = String(i + 1);
      const face = document.createElement('img'); face.className = 'face'; face.alt = ''; face.src = portraitUrl(r.character);
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = r.name;
      row.append(pos, face, nm);
      const m = this.moved.get(r.id);
      if (m) { const a = document.createElement('span'); a.className = `ar ${m.dir}`; a.textContent = m.dir === 'up' ? '▲' : '▼'; row.append(a); row.classList.add('moved'); }
      box.append(row);
    });
  }

  /** Place changed: badge on the place pill plus a short pop. */
  private overtake(dir: 'up' | 'down') {
    const b = this.els.pbadge;
    b.hidden = false; b.textContent = dir === 'up' ? '▲' : '▼'; b.dataset.dir = dir;
    const p = this.els.place; p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop');
    this.placeFlash = 1.6;
  }

  /** New lap: a banner sweeps across ("LAP 2", or "FINAL LAP"). */
  lapBanner(lap: number) {
    this.els.btext.innerHTML = lap >= LAPS ? 'FINAL <em>LAP</em>' : `LAP <em>${lap}</em>`;
    const b = this.els.banner; b.hidden = false; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
    this.bannerTimer = 2.2;
  }

  flashGo() { this.els.big.textContent = 'GO!'; setTimeout(() => (this.els.big.hidden = true), 700); }

  say(text: string, seconds = 1.2) {
    const t = this.els.toast;
    t.textContent = text; t.hidden = false; t.classList.remove('go'); void t.offsetWidth; t.classList.add('go');
    this.toastTimer = seconds;
  }

  /** Crossing the line: big FINISH!, your place, and confetti. */
  celebrate(place: number | null) {
    const f = this.els.finish;
    this.els.toast.hidden = true; this.toastTimer = 0; this.els.banner.hidden = true;
    this.els.fplace.textContent = place ? ordinalText(place) : '';
    f.hidden = false; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    const box = this.els.confetti; box.textContent = '';
    const cols = ['#ff8a00', '#fcc945', '#e54b4b', '#7aa58a', '#6ca9e6', '#8f84d9', '#f2f2f0'];
    for (let i = 0; i < 80; i++) {
      const c = document.createElement('i');
      c.style.background = cols[i % cols.length];
      c.style.left = `${Math.random() * 100}%`;
      c.style.setProperty('--dx', `${(Math.random() - 0.5) * 30}vw`);
      c.style.setProperty('--rot', `${Math.random() * 900 - 450}deg`);
      c.style.animationDelay = `${Math.random() * 0.6}s`;
      c.style.animationDuration = `${2.2 + Math.random() * 1.4}s`;
      box.append(c);
    }
    setTimeout(() => { box.textContent = ''; }, 4200);
  }

  /** Items arrive with the power-ups milestone; until then the slot stays empty. */
  setItem(name: string | null, iconSvg = '') {
    const it = this.els.item;
    it.classList.toggle('empty', !name);
    (it.querySelector('[data-icon]') as HTMLElement).innerHTML = iconSvg;
    this.els.ilabel.innerHTML = name ? `${name}<span class="cap">PRESS E</span>` : '<span class="cap">NO ITEM</span>';
    if (name) { it.classList.remove('got'); void it.offsetWidth; it.classList.add('got'); }
  }

  showResults(total: number, laps: number[]) {
    this.els.finish.hidden = true;
    (this.results.querySelector('.panel') as HTMLElement).innerHTML = PRACTICE_RESULTS;
    (this.results.querySelector('[data-again]') as HTMLElement).onclick = () => this.onRestart?.();
    (this.results.querySelector('[data-total]') as HTMLElement).textContent = formatTime(total);
    const list = this.results.querySelector('[data-laps]') as HTMLElement; list.textContent = '';
    laps.forEach((t, i) => { const li = document.createElement('li'); li.innerHTML = `<span class="pos">${i + 1}</span><span>Lap ${i + 1}</span><span class="t">${formatTime(t)}</span>`; list.append(li); });
    this.results.hidden = false;
    (this.results.querySelector('[data-again]') as HTMLElement).focus();
  }
  hideResults() { this.results.hidden = true; }

  /** Online results from the server: everyone's place and time, with Rematch for the host. */
  showOnlineResults(rows: ResultRow[], me: string, isHost: boolean, rematch: () => void, leave: () => void) {
    this.els.finish.hidden = true;
    const panel = this.results.querySelector('.panel') as HTMLElement;
    const mine = rows.find((r) => r.id === me);
    panel.innerHTML = `<h2>${mine && mine.place === 1 ? 'You win!' : 'Race results'}</h2><ol class="laps" data-rows></ol>
      <p class="sub" data-wait></p><div class="row" style="justify-content:center"></div>`;
    const list = panel.querySelector('[data-rows]') as HTMLElement;
    for (const r of rows) {
      const li = document.createElement('li');
      const pos = document.createElement('span'); pos.className = 'pos'; pos.textContent = String(r.place);
      const face = document.createElement('img'); face.className = 'face'; face.alt = ''; face.src = portraitUrl(r.character);
      face.style.cssText = 'width:28px;height:28px;border-radius:8px;object-fit:cover';
      const name = document.createElement('span'); name.textContent = `${r.name}${r.id === me ? ' (you)' : ''}`;
      const t = document.createElement('span'); t.className = 't'; t.textContent = r.time === null ? 'did not finish' : formatTime(r.time / 1000);
      li.append(pos, face, name, t);
      list.append(li);
    }
    const row = panel.querySelector('.row') as HTMLElement;
    if (isHost) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Rematch'; b.onclick = rematch; row.append(b); }
    else (panel.querySelector('[data-wait]') as HTMLElement).textContent = 'Waiting for the host to start a rematch…';
    const l = document.createElement('button'); l.className = 'btn coral'; l.textContent = 'Leave room'; l.onclick = leave; row.append(l);
    this.results.hidden = false;
  }
}

const hexColor = (n: number) => '#' + n.toString(16).padStart(6, '0');
const ordinalText = (n: number) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] ?? 'th') + ' place';
