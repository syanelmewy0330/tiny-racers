import { buildPath } from '@shared/trackMath';
import type { TrackDef } from '@shared/tracks/meadowLoop';
import { TRACKS } from '../game/theme';

/** Colours for each track's card: sky behind the outline, and the road line. */
const LOOKS: Record<string, { bg: string; line: string; tag: string }> = {
  'meadow-loop': { bg: 'linear-gradient(160deg,#7fbf6a,#3f7f4f)', line: '#FCC945', tag: 'Golden afternoon' },
  'frostbite-pass': { bg: 'linear-gradient(160deg,#5b6aa8,#25305a)', line: '#CFE6FF', tag: 'Snow & ice' },
  'lantern-grove': { bg: 'linear-gradient(160deg,#2f4a3c,#141b30)', line: '#FCC945', tag: 'Moonlit forest' },
};

/** Small top-down outline of a track, as an SVG string. */
export function trackOutline(def: TrackDef, stroke: string): string {
  const pts = buildPath(def, 3).pts;
  const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const s = Math.min(180 / (maxX - minX), 100 / (maxZ - minZ));
  const ox = (200 - (maxX - minX) * s) / 2, oz = (120 - (maxZ - minZ) * s) / 2;
  const P = (x: number, z: number) => `${(ox + (x - minX) * s).toFixed(1)},${(oz + (z - minZ) * s).toFixed(1)}`;
  const d = 'M' + pts.map((p) => P(p.x, p.z)).join(' L') + ' Z';
  let extra = '';
  if (def.shortcut) {
    const n = pts.length, a = pts[Math.floor(def.shortcut.from * n)], b = pts[Math.floor(def.shortcut.to * n)];
    extra = `<path d="M${P(a.x, a.z)} ${def.shortcut.via.map(([x, z]) => 'L' + P(x, z)).join(' ')} L${P(b.x, b.z)}" stroke="${stroke}" stroke-width="3" stroke-dasharray="4 4" fill="none" opacity=".8"/>`;
  }
  const st = pts[0];
  return `<svg viewBox="0 0 200 120" aria-hidden="true"><path d="${d}" stroke="rgba(0,0,0,.35)" stroke-width="10" fill="none" stroke-linejoin="round"/><path d="${d}" stroke="${stroke}" stroke-width="5" fill="none" stroke-linejoin="round"/>${extra}<circle cx="${P(st.x, st.z).split(',')[0]}" cy="${P(st.x, st.z).split(',')[1]}" r="5" fill="#fff" stroke="#1C1F26" stroke-width="2"/></svg>`;
}

/**
 * One card per track: outline, name and a line about it. `onPick` gets the track id.
 * `readOnly` shows the cards without letting you choose (online, when you are not the host).
 */
export function trackCards(selected: string, onPick: (id: string) => void, opts: { compact?: boolean } = {}): { el: HTMLElement; mark: (id: string) => void; setEnabled: (on: boolean) => void } {
  const wrap = document.createElement('div');
  wrap.className = 'tracks' + (opts.compact ? ' compact' : '');
  const buttons: HTMLButtonElement[] = [];
  for (const t of TRACKS) {
    const look = LOOKS[t.id] ?? LOOKS['meadow-loop'];
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'track-card'; b.dataset.track = t.id;
    b.innerHTML = `<div class="map" style="background:${look.bg}">${trackOutline(t, look.line)}<span class="tag"></span></div><b></b><span class="blurb"></span>`;
    (b.querySelector('.tag') as HTMLElement).textContent = look.tag;
    (b.querySelector('b') as HTMLElement).textContent = t.name;
    (b.querySelector('.blurb') as HTMLElement).textContent = t.blurb ?? '';
    b.onclick = () => { mark(t.id); onPick(t.id); };
    buttons.push(b); wrap.append(b);
  }
  const mark = (id: string) => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.track === id)));
  mark(selected);
  return { el: wrap, mark, setEnabled: (on) => buttons.forEach((b) => { b.disabled = !on; }) };
}
