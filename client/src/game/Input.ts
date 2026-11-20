import type { ControlInput } from '@shared/types';

/** Buttons on a standard gamepad (Xbox / PlayStation layout in the browser). */
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export type MenuKey = 'up' | 'down' | 'ok' | 'back';

/**
 * Reads the keyboard and any connected gamepad.
 * Keyboard: WASD or arrows drive, Space or Shift drifts, R respawns, Esc or P pauses.
 * Gamepad: left stick or d-pad steers, RT or A accelerates, LT or B brakes,
 * RB, LB or X drifts, Y respawns, Start pauses.
 */
export class Input {
  private down = new Set<string>();
  private respawnQueued = false;
  private pauseQueued = false;
  private menuQueue: MenuKey[] = [];
  private padPrev: boolean[] = [];
  /** Called when a controller is plugged in or unplugged. */
  onPad?: (connected: boolean) => void;

  constructor() {
    window.addEventListener('keydown', (e) => {
      const k = e.code;
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT';
      if (!typing && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
      if (k === 'KeyR' && !e.repeat && !typing) this.respawnQueued = true;
      if ((k === 'Escape' || k === 'KeyP') && !e.repeat && !typing) this.pauseQueued = true;
      this.down.add(k);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    window.addEventListener('gamepadconnected', () => this.onPad?.(true));
    window.addEventListener('gamepaddisconnected', () => this.onPad?.(false));
  }

  private has(...codes: string[]) { return codes.some((c) => this.down.has(c)); }

  private pad(): Gamepad | null {
    const list = navigator.getGamepads?.() ?? [];
    for (const p of list) if (p && p.connected) return p;
    return null;
  }

  /** Call once per frame: turns gamepad button presses into one-shot events. */
  poll() {
    const p = this.pad();
    if (!p) { this.padPrev = []; return; }
    const pressed = (i: number) => !!p.buttons[i]?.pressed;
    const edge = (i: number) => pressed(i) && !this.padPrev[i];
    if (edge(PAD.START)) this.pauseQueued = true;
    if (edge(PAD.Y)) this.respawnQueued = true;
    if (edge(PAD.UP)) this.menuQueue.push('up');
    if (edge(PAD.DOWN)) this.menuQueue.push('down');
    if (edge(PAD.A)) this.menuQueue.push('ok');
    if (edge(PAD.B)) this.menuQueue.push('back');
    // stick flicks also move through menus
    const y = p.axes[1] ?? 0, wasY = this.padPrev[100] ? 1 : this.padPrev[101] ? -1 : 0;
    if (y < -0.6 && wasY !== -1) this.menuQueue.push('up');
    if (y > 0.6 && wasY !== 1) this.menuQueue.push('down');
    this.padPrev = p.buttons.map((b) => b.pressed);
    this.padPrev[100] = y > 0.6; this.padPrev[101] = y < -0.6;
  }

  get hasPad() { return !!this.pad(); }

  read(): ControlInput {
    const left = this.has('KeyA', 'ArrowLeft'), right = this.has('KeyD', 'ArrowRight');
    let steer = (left ? 1 : 0) - (right ? 1 : 0);
    let throttle = this.has('KeyW', 'ArrowUp'), brake = this.has('KeyS', 'ArrowDown'), drift = this.has('Space', 'ShiftLeft', 'ShiftRight');
    const p = this.pad();
    if (p) {
      const b = (i: number) => p.buttons[i]?.pressed ?? false;
      const v = (i: number) => p.buttons[i]?.value ?? 0;
      const x = p.axes[0] ?? 0;
      if (Math.abs(x) > 0.18) steer = -Math.sign(x) * Math.min(1, (Math.abs(x) - 0.18) / 0.72);
      if (b(PAD.LEFT)) steer = 1;
      if (b(PAD.RIGHT)) steer = -1;
      throttle ||= v(PAD.RT) > 0.25 || b(PAD.A);
      brake ||= v(PAD.LT) > 0.25 || b(PAD.B);
      drift ||= b(PAD.RB) || b(PAD.LB) || b(PAD.X);
    }
    return { throttle, brake, steer, drift };
  }

  /** True once per press of R or the gamepad's Y. */
  takeRespawn(): boolean {
    const r = this.respawnQueued;
    this.respawnQueued = false;
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
