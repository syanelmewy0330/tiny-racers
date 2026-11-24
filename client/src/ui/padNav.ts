import type { MenuKey, PadKind } from '../game/Input';

/** One controller button drawn as a little badge (PlayStation shapes in their colours, or Xbox letters). */
const B = (t: string, cls = '') => `<b class="pb ${cls}">${t}</b>`;
const PS = { cross: B('✕', 'cross'), circle: B('○', 'circle'), square: B('□', 'square'), triangle: B('△', 'triangle') };

export function padGlyph(kind: PadKind, what: 'item' | 'help'): string {
  if (what === 'item') return kind === 'ps' ? B('L1') : B('LB');
  return kind === 'ps' ? B('SHARE') : B('VIEW');
}

/** The controls guide rows for a controller: [buttons html, what it does]. */
export function padLegend(kind: PadKind): [string, string][] {
  const ps = kind === 'ps';
  return [
    [B('L-STICK') + ' ' + B('D-PAD'), 'Steer'],
    [ps ? B('R2') + ' ' + PS.cross : B('RT') + ' ' + B('A', 'xa'), 'Accelerate'],
    [ps ? B('L2') + ' ' + PS.circle : B('LT') + ' ' + B('B', 'xb'), 'Brake / reverse'],
    [ps ? B('R1') + ' ' + PS.square : B('RB') + ' ' + B('X', 'xx'), 'Drift, release to boost'],
    [ps ? B('L1') : B('LB'), 'Use item'],
    [ps ? PS.triangle : B('Y', 'xy'), 'Back on track'],
    [ps ? B('OPTIONS') : B('MENU'), 'Pause menu'],
    [padGlyph(kind, 'help'), 'Hide controls'],
  ];
}

/** Short one-line version for the title screen. */
export function padLegendLine(kind: PadKind): string {
  return padLegend(kind).slice(0, 7).map(([k, w]) => `<span>${k} ${w.split(',')[0].toLowerCase()}</span>`).join('');
}

/** Focus an element so the controller's highlight shows, even after mouse use. */
export function padFocus(el: HTMLElement) {
  document.body.classList.add('pad-nav');
  el.focus({ preventScroll: false, focusVisible: true } as FocusOptions);
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
// moving the mouse hands control back to it
window.addEventListener('pointerdown', () => document.body.classList.remove('pad-nav'), true);

const visible = (el: HTMLElement) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

/**
 * Controller navigation for the menu screens (title, pickers, lobby):
 * d-pad / stick moves to the nearest button in that direction, Cross / A presses it.
 */
export function padNav(k: MenuKey): boolean {
  const screens = [...document.querySelectorAll<HTMLElement>('.screen')].filter(visible);
  const root = screens[screens.length - 1];
  if (!root) return false;
  const items = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), summary')].filter(visible);
  if (!items.length) return false;
  const cur = items.find((el) => el === document.activeElement);
  if (!cur) {
    // first press: start on the picked racer, else the first button
    padFocus(items.find((el) => el.getAttribute('aria-pressed') === 'true') ?? items[0]);
    return true;
  }
  if (k === 'ok') { cur.click(); return true; }
  if (k === 'back') return false;
  const c = cur.getBoundingClientRect(), cx = c.left + c.width / 2, cy = c.top + c.height / 2;
  const cands: { el: HTMLElement; along: number; side: number }[] = [];
  for (const el of items) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
    // how far along the pressed direction, and how far off to the side
    const [along, side] = k === 'up' ? [-dy, dx] : k === 'down' ? [dy, dx] : k === 'left' ? [-dx, dy] : [dx, dy];
    if (along >= 8) cands.push({ el, along, side: Math.abs(side) });
  }
  let best: HTMLElement | null = null;
  if (cands.length) {
    if (k === 'up' || k === 'down') {
      // the next row first, then the closest button in it
      const near = Math.min(...cands.map((c) => c.along));
      best = cands.filter((c) => c.along <= near + 24).sort((p, q) => p.side - q.side)[0].el;
    } else {
      // same row if there is one, else the closest overall
      const row = cands.filter((c) => c.side < 30).sort((p, q) => p.along - q.along);
      best = (row[0] ?? cands.sort((p, q) => p.along + p.side * 2.5 - q.along - q.side * 2.5)[0]).el;
    }
  }
  if (best) padFocus(best);
  return true;
}
