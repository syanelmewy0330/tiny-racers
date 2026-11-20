import { characterById } from '@shared/characters';
import { MAX_PLAYERS } from '@shared/constants';
import type { ColyseusSession } from '../net/ColyseusSession';

/** Waiting room: shows the invite code and who has joined. The host starts the race. */
export function showLobby(parent: HTMLElement, s: ColyseusSession, onLeave: () => void): () => void {
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.innerHTML = `
    <div class="panel" style="width:min(520px,100%)">
      <h2 data-title>Room code</h2>
      <div class="bigcode" data-code></div>
      <p class="sub" data-how>Send this code to your friends. They open Tiny Racers, type it next to <b>Join</b>, and appear here.</p>
      <ul class="players" data-list></ul>
      <p class="sub" data-note></p>
      <div class="row"><button class="btn" data-start>Start race</button><button class="btn ghost" data-leave>Leave room</button></div>
    </div>`;
  parent.append(screen);
  const q = <T extends HTMLElement>(sel: string) => screen.querySelector(sel) as T;
  q<HTMLElement>('[data-code]').textContent = s.code;
  q<HTMLButtonElement>('[data-start]').onclick = () => s.start();
  q<HTMLButtonElement>('[data-leave]').onclick = () => { close(); onLeave(); };

  const render = () => {
    const w = s.latest; if (!w) return;
    const list = q<HTMLElement>('[data-list]'); list.textContent = '';
    for (const p of [...w.players].sort((a, b) => a.slot - b.slot)) {
      const li = document.createElement('li');
      const dot = document.createElement('span'); dot.className = 'dot';
      dot.style.background = '#' + characterById(p.character).color.toString(16).padStart(6, '0');
      const label = document.createElement('span');
      label.textContent = `${p.name}${p.id === s.me ? ' (you)' : ''}${p.id === w.hostId ? ' · host' : ''}`;
      li.append(dot, label); list.append(li);
    }
    if (w.isPublic) {
      q<HTMLElement>('[data-title]').textContent = 'Quick race';
      q<HTMLElement>('[data-code]').hidden = true;
      q<HTMLElement>('[data-how]').textContent = 'You are in the public queue. Anyone who presses Quick race joins this race.';
    }
    const start = q<HTMLButtonElement>('[data-start]');
    start.hidden = !s.isHost;
    q<HTMLElement>('[data-note]').textContent = w.autoStartIn !== null
      ? `Race starts in ${w.autoStartIn} s…`
      : w.isPublic && w.players.length < 2 ? 'Waiting for another racer to join…'
      : s.isHost
      ? (w.players.length < 2 ? 'Waiting for someone to join. You can also start alone.' : `${w.players.length} of ${MAX_PLAYERS} racers here. Start when everyone is in.`)
      : 'Waiting for the host to start the race…';
  };
  const timer = window.setInterval(render, 200);
  render();
  function close() { window.clearInterval(timer); screen.remove(); }
  return close;
}
