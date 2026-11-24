import type { ControlInput } from '@shared/types';

/** Buttons on a standard gamepad (Xbox / PlayStation layout in the browser). */
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export type MenuKey = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back';

/** A controller with its buttons put into the standard order, whatever the browser reported. */
interface Pad { buttons: { pressed: boolean; value: number }[]; axes: number[] }

const NONE = { pressed: false, value: 0 };
const btn = (b: GamepadButton | undefined) => (b ? { pressed: b.pressed, value: b.value } : NONE);

/** Sony's vendor id, or the names Windows gives PlayStation controllers. */
const isPlayStation = (id: string) => /054c|dualsense|dualshock|playstation/i.test(id) || (/wireless controller/i.test(id) && !/xbox|xinput/i.test(id));

/**
 * Some browsers hand over a PlayStation controller "raw" (mapping is not 'standard'):
 * Square, Cross, Circle, Triangle, L1, R1, L2, R2, Share, Options, L3, R3, PS, Touchpad,
 * with the d-pad as one "hat" axis. This puts it back into the standard order.
 */
function fromRawPlayStation(p: Gamepad): Pad {
  const r = (i: number) => btn(p.buttons[i]);
  const b = [r(1), r(2), r(0), r(3), r(4), r(5), r(6), r(7), r(8), r(9), r(10), r(11), NONE, NONE, NONE, NONE, r(12), r(13)];
  // d-pad: either extra buttons 14-17, or a hat axis (usually axis 9: -1 up, then clockwise in steps of 2/7; >1 means centred)
  if (p.buttons.length >= 18) { b[12] = r(14); b[13] = r(15); b[14] = r(16); b[15] = r(17); }
  else {
    const hat = p.axes[9];
    if (hat !== undefined && Math.abs(hat) <= 1.05) {
      const dir = ((Math.round((hat + 1) / (2 / 7)) % 8) + 8) % 8;   // 0 up, 1 up-right, 2 right … 7 up-left
      const on = { pressed: true, value: 1 };
      if (dir === 7 || dir === 0 || dir === 1) b[12] = on;
      if (dir >= 3 && dir <= 5) b[13] = on;
      if (dir >= 5 && dir <= 7) b[14] = on;
      if (dir >= 1 && dir <= 3) b[15] = on;
    }
  }
  return { buttons: b, axes: [p.axes[0] ?? 0, p.axes[1] ?? 0] };
}

/** Normalise any controller into the standard layout the game reads. */
function normalise(p: Gamepad): Pad {
  if (p.mapping !== 'standard' && isPlayStation(p.id)) return fromRawPlayStation(p);
  return { buttons: Array.from(p.buttons, btn), axes: [p.axes[0] ?? 0, p.axes[1] ?? 0] };
}

/** Things Windows reports as "gamepads" that are not (headsets, keyboards, empty slots from drivers). */
const usable = (p: Gamepad | null): p is Gamepad => !!p && p.connected && p.buttons.length >= 10 && p.axes.length >= 2;

/**
 * Reads the keyboard and any connected gamepad.
 * Keyboard: WASD or arrows drive, Space or Shift drifts, E uses an item, R respawns, Esc or P pauses.
 * Gamepad: left stick or d-pad steers, RT or A accelerates, LT or B brakes,
 * RB or X drifts, LB uses an item, Y respawns, Start pauses.
 * PlayStation: R2 or Cross go, L2 or Circle brake, R1 or Square drift, L1 item, Triangle reset, Options pause.
 */
export class Input {
  private down = new Set<string>();
  private respawnQueued = false;
  private pauseQueued = false;
  private itemQueued = false;
  private menuQueue: MenuKey[] = [];
  private padPrev: boolean[] = [];
  private stickPrev = { x: 0, y: 0 };
  /** The controller that was used last (Windows can list several, some of them fake). */
  private activeIndex = -1;
  private current: Pad | null = null;
  private wasConnected = false;
  /** Called when a controller is plugged in or unplugged. */
  onPad?: (connected: boolean) => void;

  constructor() {
    window.addEventListener('keydown', (e) => {
      const k = e.code;
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT';
      if (!typing && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
      if (k === 'KeyR' && !e.repeat && !typing) this.respawnQueued = true;
      if ((k === 'Escape' || k === 'KeyP') && !e.repeat && !typing) this.pauseQueued = true;
      if (k === 'KeyE' && !e.repeat && !typing) this.itemQueued = true;
      this.down.add(k);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  private has(...codes: string[]) { return codes.some((c) => this.down.has(c)); }

  /** Pick the controller to listen to: the one last touched, else the first real one. */
  private findPad(): Gamepad | null {
    let list: (Gamepad | null)[] = [];
    try { list = Array.from(navigator.getGamepads?.() ?? []); } catch { /* blocked by the page's permissions */ }
    const pads = list.filter(usable);
    for (const p of pads) {
      const n = normalise(p);
      if (n.buttons.some((b) => b.pressed) || Math.abs(n.axes[0]) > 0.5 || Math.abs(n.axes[1]) > 0.5) { this.activeIndex = p.index; break; }
    }
    return pads.find((p) => p.index === this.activeIndex)
      ?? pads.find((p) => p.mapping === 'standard')
      ?? pads[0] ?? null;
  }

  /** Call once per frame: reads the controller and turns button presses into one-shot events. */
  poll() {
    const raw = this.findPad();
    if (!!raw !== this.wasConnected) { this.wasConnected = !!raw; this.onPad?.(!!raw); }
    const p = (this.current = raw ? normalise(raw) : null);
    if (!p) { this.padPrev = []; this.stickPrev = { x: 0, y: 0 }; return; }
    const pressed = (i: number) => !!p.buttons[i]?.pressed;
    const edge = (i: number) => pressed(i) && !this.padPrev[i];
    if (edge(PAD.START)) this.pauseQueued = true;
    if (edge(PAD.Y)) this.respawnQueued = true;
    if (edge(PAD.LB)) this.itemQueued = true;
    if (edge(PAD.UP)) this.menuQueue.push('up');
    if (edge(PAD.DOWN)) this.menuQueue.push('down');
    if (edge(PAD.LEFT)) this.menuQueue.push('left');
    if (edge(PAD.RIGHT)) this.menuQueue.push('right');
    if (edge(PAD.A)) this.menuQueue.push('ok');
    if (edge(PAD.B)) this.menuQueue.push('back');
    // stick flicks also move through menus
    const zone = (v: number) => (v > 0.6 ? 1 : v < -0.6 ? -1 : 0);
    const sx = zone(p.axes[0]), sy = zone(p.axes[1]);
    if (sy && sy !== this.stickPrev.y) this.menuQueue.push(sy < 0 ? 'up' : 'down');
    if (sx && sx !== this.stickPrev.x) this.menuQueue.push(sx < 0 ? 'left' : 'right');
    this.stickPrev = { x: sx, y: sy };
    this.padPrev = p.buttons.map((b) => b.pressed);
  }

  get hasPad() { return !!this.current; }

  read(): ControlInput {
    const left = this.has('KeyA', 'ArrowLeft'), right = this.has('KeyD', 'ArrowRight');
    let steer = (left ? 1 : 0) - (right ? 1 : 0);
    let throttle = this.has('KeyW', 'ArrowUp'), brake = this.has('KeyS', 'ArrowDown'), drift = this.has('Space', 'ShiftLeft', 'ShiftRight');
    const p = this.current;
    if (p) {
      const b = (i: number) => p.buttons[i]?.pressed ?? false;
      const v = (i: number) => Math.max(p.buttons[i]?.value ?? 0, b(i) ? 1 : 0);
      const x = p.axes[0] ?? 0;
      if (Math.abs(x) > 0.18) steer = -Math.sign(x) * Math.min(1, (Math.abs(x) - 0.18) / 0.72);
      if (b(PAD.LEFT)) steer = 1;
      if (b(PAD.RIGHT)) steer = -1;
      throttle ||= v(PAD.RT) > 0.25 || b(PAD.A);
      brake ||= v(PAD.LT) > 0.25 || b(PAD.B);
      drift ||= b(PAD.RB) || b(PAD.X);
    }
    return { throttle, brake, steer, drift };
  }

  /** True once per press of R or the gamepad's Y. */
  takeRespawn(): boolean {
    const r = this.respawnQueued;
    this.respawnQueued = false;
    return r;
  }

  /** True once per press of E or the gamepad's LB. */
  takeItem(): boolean {
    const r = this.itemQueued;
    this.itemQueued = false;
    return r;
  }

  /** True once per press of Esc, P or the gamepad's Start. */
  takePause(): boolean {
    const r = this.pauseQueued;
    this.pauseQueued = false;
    return r;
  }

  /** Gamepad menu presses since the last call. */
  takeMenu(): MenuKey[] { const q = this.menuQueue; this.menuQueue = []; return q; }
}
