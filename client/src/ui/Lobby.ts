import { CHARACTERS, characterById } from '@shared/characters';
import { portraitUrl, saveCharacter } from './CharacterPicker';
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
      <div class="mini-picks" data-picks><span class="sub">Your racer:</span></div>
      <p class="notice" data-notice hidden></p>
      <p class="sub" data-note></p>
      <p class="sub" data-net></p>
      <div class="row"><button class="btn" data-start>Start race</button><button class="btn" data-ready>I'm ready</button><button class="btn ghost" data-leave>Leave room</button></div>
    </div>`;
  parent.append(screen);
  const q = <T extends HTMLElement>(sel: string) => screen.querySelector(sel) as T;
  q<HTMLElement>('[data-code]').textContent = s.code;
  q<HTMLButtonElement>('[data-start]').onclick = () => s.start();
  const readyBtn = q<HTMLButtonElement>('[data-ready]');
  readyBtn.onclick = () => s.setReady(!(s.latest?.players.find((p) => p.id === s.me)?.ready));
  q<HTMLButtonElement>('[data-leave]').onclick = () => { close(); onLeave(); };

  const picks = q<HTMLElement>('[data-picks]');
  const pickButtons = CHARACTERS.map((ch) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mini-pick'; b.title = `${ch.name}, ${ch.title}`;
    const img = document.createElement('img'); img.src = portraitUrl(ch.id); img.alt = ch.name;
    b.append(img);
    b.onclick = () => { s.setCharacter(ch.id); saveCharacter(ch.id); };
    picks.append(b);
    return { b, id: ch.id };
  });

  const render = () => {
    const w = s.latest; if (!w) return;
    const list = q<HTMLElement>('[data-list]'); list.textContent = '';
    for (const p of [...w.players].sort((a, b) => a.slot - b.slot)) {
      const li = document.createElement('li');
      const ch = characterById(p.character);
      const face = document.createElement('img'); face.className = 'face'; face.alt = ''; face.src = portraitUrl(ch.id);
      face.style.background = '#' + ch.color.toString(16).padStart(6, '0');
      const label = document.createElement('span');
      label.textContent = `${p.name}${p.id === s.me ? ' (you)' : ''}`;
      const who = document.createElement('span'); who.className = 'who'; who.textContent = ch.name;
      const status = document.createElement('span'); status.className = 'status';
      if (!p.connected) { status.textContent = 'Reconnecting…'; status.classList.add('away'); }
      else if (p.id === w.hostId) status.textContent = 'Host';
      else if (p.ready) { status.textContent = 'Ready ✓'; status.classList.add('ready'); }
      else status.textContent = 'Not ready';
      li.append(face, label, who, status); list.append(li);
    }
    if (w.isPublic) {
      q<HTMLElement>('[data-title]').textContent = 'Quick race';
      q<HTMLElement>('[data-code]').hidden = true;
      q<HTMLElement>('[data-how]').textContent = 'You are in the public queue. Anyone who presses Quick race joins this race.';
    }
    const mine = w.players.find((p) => p.id === s.me)?.character;
    for (const { b, id } of pickButtons) b.setAttribute('aria-pressed', String(id === mine));
    const start = q<HTMLButtonElement>('[data-start]');
    const others = w.players.filter((p) => p.id !== w.hostId);
    const waitingFor = others.filter((p) => !p.ready || !p.connected);
    start.hidden = !s.isHost || w.isPublic;
    start.disabled = waitingFor.length > 0;
    const meReady = !!w.players.find((p) => p.id === s.me)?.ready;
    readyBtn.hidden = s.isHost || w.isPublic;
    readyBtn.textContent = meReady ? 'Not ready' : "I'm ready";
    readyBtn.classList.toggle('ghost', meReady);
    q<HTMLElement>('[data-note]').textContent = w.autoStartIn !== null
      ? `Race starts in ${w.autoStartIn} s…`
      : w.isPublic && w.players.length < 2 ? 'Waiting for another racer to join…'
      : s.isHost
      ? (w.players.length < 2 ? 'Waiting for someone to join. You can also start alone.'
        : waitingFor.length ? `Waiting for ${waitingFor.map((p) => p.name).join(', ')} to press Ready.`
        : `${w.players.length} of ${MAX_PLAYERS} racers here. Everyone is ready!`)
      : meReady ? 'You are ready. Waiting for the host to start the race…' : 'Press "I\'m ready" when you are set.';
    const n = s.lastNotice, notice = q<HTMLElement>('[data-notice]');
    notice.hidden = !n || performance.now() - n.at > 8000;
    if (n) notice.textContent = n.text;
    q<HTMLElement>('[data-net]').textContent = s.connection === 'reconnecting'
      ? 'Connection lost. Reconnecting…' : `Connected${s.pingMs !== null ? ` · ${s.pingMs} ms` : ''}`;
  };
  const timer = window.setInterval(render, 200);
  render();
  function close() { window.clearInterval(timer); screen.remove(); }
  return close;
}
