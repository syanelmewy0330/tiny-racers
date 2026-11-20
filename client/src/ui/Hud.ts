import { LAPS } from '@shared/constants';
import { formatTime } from '../game/RaceTracker';

const el = (html: string) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild as HTMLElement; };

/** Race overlay: lap, time, speedometer, drift meter, countdown and results. */
export class Hud {
  readonly root: HTMLElement;
  private lap: HTMLElement; private time: HTMLElement; private speed: HTMLElement; private arc: SVGPathElement;
  private driftBar: HTMLElement; private big: HTMLElement; private toast: HTMLElement; private results: HTMLElement;
  private toastTimer = 0;
  onRestart?: () => void;

  constructor(parent: HTMLElement) {
    this.root = el(`<div class="hud" hidden>
      <div class="chips"><span class="chip" data-lap>Lap 1/${LAPS}</span><span class="chip" data-time>0:00.00</span></div>
      <div class="speedo">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="46" fill="#fffaf3" stroke="#2a1e3f" stroke-width="3"/>
          <path d="M 22 78 A 38 38 0 1 1 78 78" fill="none" stroke="#eee6f5" stroke-width="9" stroke-linecap="round"/>
          <path data-arc d="M 22 78 A 38 38 0 1 1 78 78" fill="none" stroke="#ff4f79" stroke-width="9" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100"/>
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
    this.results = el(`<div class="results" hidden><div class="panel">
      <h2>Finished!</h2><div class="time" data-total></div><ol class="laps" data-laps></ol>
      <div class="row" style="justify-content:center"><button class="btn" data-again>Race again</button></div>
    </div></div>`);
    parent.append(this.root, this.results);
    const q = (s: string) => this.root.querySelector(s) as HTMLElement;
    this.lap = q('[data-lap]'); this.time = q('[data-time]'); this.speed = q('[data-speed]');
    this.arc = this.root.querySelector('[data-arc]') as SVGPathElement;
    this.driftBar = q('[data-drift]'); this.big = q('[data-big]'); this.toast = q('[data-toast]');
    (this.results.querySelector('[data-again]') as HTMLElement).onclick = () => this.onRestart?.();
  }

  show(on: boolean) { this.root.hidden = !on; if (!on) this.results.hidden = true; }

  update(dt: number, d: { lap: number; time: number; kmh: number; drift: number; driftLevel: number; countdown: number | null }) {
    this.lap.textContent = `Lap ${d.lap}/${LAPS}`;
    this.time.textContent = formatTime(d.time);
    this.speed.textContent = String(Math.round(Math.abs(d.kmh)));
    this.arc.setAttribute('stroke-dasharray', `${Math.min(100, Math.abs(d.kmh) / 1.6)} 100`);
    this.driftBar.style.width = `${Math.min(100, (d.drift / 1.6) * 100)}%`;
    this.driftBar.style.background = d.driftLevel >= 2 ? '#ff7b29' : '#4cc9f0';
    if (d.countdown !== null) { this.big.hidden = false; this.big.textContent = d.countdown > 0 ? String(Math.ceil(d.countdown)) : 'GO!'; }
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) this.toast.hidden = true; }
  }

  flashGo() { this.big.textContent = 'GO!'; setTimeout(() => (this.big.hidden = true), 700); }

  say(text: string, seconds = 1.2) { this.toast.textContent = text; this.toast.hidden = false; this.toastTimer = seconds; }

  showResults(total: number, laps: number[]) {
    (this.results.querySelector('[data-total]') as HTMLElement).textContent = formatTime(total);
    const list = this.results.querySelector('[data-laps]') as HTMLElement; list.textContent = '';
    laps.forEach((t, i) => { const li = document.createElement('li'); li.textContent = `Lap ${i + 1}  ${formatTime(t)}`; list.append(li); });
    this.results.hidden = false;
    (this.results.querySelector('[data-again]') as HTMLElement).focus();
  }
  hideResults() { this.results.hidden = true; }
}
