import type { ControlInput } from '@shared/types';

/** Reads the keyboard. WASD or arrow keys drive, Space or Shift drifts, R respawns. */
export class Input {
  private down = new Set<string>();
  private respawnQueued = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      const k = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
      if (k === 'KeyR' && !e.repeat) this.respawnQueued = true;
      this.down.add(k);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  private has(...codes: string[]) { return codes.some((c) => this.down.has(c)); }

  read(): ControlInput {
    const left = this.has('KeyA', 'ArrowLeft'), right = this.has('KeyD', 'ArrowRight');
    return {
      throttle: this.has('KeyW', 'ArrowUp'),
      brake: this.has('KeyS', 'ArrowDown'),
      steer: (left ? 1 : 0) - (right ? 1 : 0),
      drift: this.has('Space', 'ShiftLeft', 'ShiftRight'),
    };
  }

  /** True once per press of R. */
  takeRespawn(): boolean {
    const r = this.respawnQueued;
    this.respawnQueued = false;
    return r;
  }
}
