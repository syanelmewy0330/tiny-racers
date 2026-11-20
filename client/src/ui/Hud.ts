import { LAPS } from '@shared/constants';
import { formatTime } from '../game/RaceTracker';
import { characterById } from '@shared/characters';
import type { ResultRow } from '@shared/protocol';

const PRACTICE_RESULTS = `<h2>Finished!</h2><div class="time" data-total></div><ol class="laps" data-laps></ol>
  <div class="row" style="justify-content:center"><button class="btn" data-again>Race again</button></div>`;

const el = (html: string) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild as HTMLElement; };

/** Race overlay: lap, time, speedometer, drift meter, countdown and results. */
export class Hud {
  readonly root: HTMLElement;
  private place!: HTMLElement;
  private net!: HTMLElement;
  private lap: HTMLElement; private time: HTMLElement; private speed: HTMLElement; private arc: SVGPathElement;
  private driftBar: HTMLElement; private big: HTMLElement; private toast: HTMLElement; private results: HTMLElement;
  private toastTimer = 0;
  onRestart?: () => void;

  constructor(parent: HTMLElement) {
    this.root = el(`<div class="hud" hidden>
      <div class="chips"><span class="chip" data-lap>Lap 1/${LAPS}</span><span class="chip" data-time>0:00.00</span><span class="chip" data-place hidden></span><span class="chip net" data-net hidden></span></div>
      <div class="speedo">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="47" fill="rgba(37,38,56,.9)" stroke="#ffffff" stroke-opacity=".18" stroke-width="2"/>
          <path d="M 22 78 A 38 38 0 1 1 78 78" fill="none" stroke="#3c3f5c" stroke-width="8" stroke-linecap="round"/>
          <path data-arc d="M 22 78 A 38 38 0 1 1 78 78" fill="none" stroke="#e5a94b" stroke-width="8" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100"/>
        </svg>
        <div class="num"><b data-speed>0</b><span>km/h</span></div>
      </div>
      <div class="drift" title="Drift charge"><i data-drift></i></div>
      <div class="help keys">
        <span><kbd>W</kbd>/<kbd>↑</kbd> go</span><span><kbd>S</kbd>/<kbd>↓</kbd> brake, reverse</span>
        <span><kbd>A</kbd><kbd>D</kbd>/<kbd>←</kbd><kbd>→</kbd> steer</span><span><kbd>Space</kbd> drift</span><span><kbd>R</kbd> reset</span>
      </div>
      <div class="toast" data-toast hidden></div>
      <div class="big" data-big hidden></div>
    </div>`);
    this.results = el(`<div class="results" hidden><div class="panel">${PRACTICE_RESULTS}</div></div>`);
    parent.append(this.root, this.results);
    const q = (s: string) => this.root.querySelector(s) as HTMLElement;
    this.lap = q('[data-lap]'); this.place = q('[data-place]'); this.time = q('[data-time]'); this.speed = q('[data-speed]'); this.net = q('[data-net]');
    this.arc = this.root.querySelector('[data-arc]') as SVGPathElement;
    this.driftBar = q('[data-drift]'); this.big = q('[data-big]'); this.toast = q('[data-toast]');
    (this.results.querySelector('[data-again]') as HTMLElement).onclick = () => this.onRestart?.();
  }

  show(on: boolean) { this.root.hidden = !on; if (!on) this.results.hidden = true; }

  update(dt: number, d: { lap: number; time: number; kmh: number; drift: number; driftLevel: number; countdown: number | null; place?: string | null;
    net?: { state: 'online' | 'reconnecting'; ping: number | null } | null }) {
    this.net.hidden = !d.net;
    if (d.net) {
      const bad = d.net.state === 'reconnecting';
      this.net.textContent = bad ? 'Reconnecting…' : d.net.ping === null ? 'Online' : `Online · ${d.net.ping} ms`;
      this.net.dataset.state = bad ? 'bad' : d.net.ping !== null && d.net.ping > 200 ? 'slow' : 'good';
    }
    this.place.hidden = !d.place; if (d.place) this.place.textContent = d.place;
    this.lap.textContent = `Lap ${d.lap}/${LAPS}`;
    this.time.textContent = formatTime(d.time);
    this.speed.textContent = String(Math.round(Math.abs(d.kmh)));
    this.arc.setAttribute('stroke-dasharray', `${Math.min(100, Math.abs(d.kmh) / 1.6)} 100`);
    this.driftBar.style.width = `${Math.min(100, (d.drift / 1.6) * 100)}%`;
    this.driftBar.style.background = d.driftLevel >= 2 ? '#f05b65' : d.driftLevel >= 1 ? '#e5a94b' : '#8790b8';
    if (d.countdown !== null) { this.big.hidden = false; this.big.textContent = d.countdown > 0 ? String(Math.ceil(d.countdown)) : 'GO!'; }
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) this.toast.hidden = true; }
  }

  flashGo() { this.big.textContent = 'GO!'; setTimeout(() => (this.big.hidden = true), 700); }

  say(text: string, seconds = 1.2) { this.toast.textContent = text; this.toast.hidden = false; this.toastTimer = seconds; }

  showResults(total: number, laps: number[]) {
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
    const panel = this.results.querySelector('.panel') as HTMLElement;
    const mine = rows.find((r) => r.id === me);
    panel.innerHTML = `<h2>${mine && mine.place === 1 ? 'You win!' : 'Race results'}</h2><ol class="laps" data-rows></ol>
      <p class="sub" data-wait></p><div class="row" style="justify-content:center"></div>`;
    const list = panel.querySelector('[data-rows]') as HTMLElement;
    for (const r of rows) {
      const li = document.createElement('li');
      const pos = document.createElement('span'); pos.className = 'pos'; pos.textContent = String(r.place);
      const face = document.createElement('img'); face.className = 'face'; face.alt = ''; face.src = `characters/${characterById(r.character).id}.jpg`;
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
