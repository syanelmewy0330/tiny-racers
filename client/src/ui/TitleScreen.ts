import { ColyseusSession, defaultServerUrl } from '../net/ColyseusSession';
import { SERVERS, serverForCode, measurePing, type RaceServer } from '../net/servers';
import { characterCards, savedCharacter, saveCharacter } from './CharacterPicker';
import { trackCards } from './TrackPicker';
import { savedTrack, saveTrack } from '../game/theme';

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/** First screen: practice alone, or create / join an online room. */
export function showTitle(parent: HTMLElement, h: { onPractice: (character: string, track: string) => void; onRoom: (s: ColyseusSession) => void }, message = '') {
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.innerHTML = `
    <div class="panel" style="width:min(860px,100%)">
      <h1 class="logo">Tiny Racers</h1>
      <p class="sub">3 laps · up to 8 racers</p>
      <p class="error" data-msg ${message ? '' : 'hidden'}></p>
      <h2>Choose your racer</h2>
      <div data-picker></div>
      <h2>Choose your track</h2>
      <div data-tracks></div>
      <p class="sub" style="font-weight:600">For online races, the host picks the track in the room.</p>
      <div class="row" style="justify-content:flex-start"><button class="btn ghost" data-practice>Practice alone</button></div>
      <h2>Race online</h2>
      <div class="servers" role="radiogroup" aria-label="Race server">
        ${SERVERS.map((sv) => `<button class="srv" role="radio" data-srv="${sv.id}"><b>${sv.name}</b><span class="ms" data-ms>checking…</span></button>`).join('')}
      </div>
      <p class="sub" style="font-weight:600">Pick the server with the lower number for you both. Room codes know their server, so your partner just types the code.</p>
      <label class="field">Your name <input data-name maxlength="14" placeholder="Your name" autocomplete="off"></label>
      <div class="row" style="justify-content:flex-start">
        <button class="btn" data-quick>Quick race</button>
        <span class="sub" style="font-weight:600">Race anyone who is online now.</span>
      </div>
      <div class="row">
        <button class="btn" data-create>Create private room</button>
        <span class="or">or</span>
        <input data-code class="code-in" maxlength="5" placeholder="CODE" autocomplete="off" aria-label="Room code">
        <button class="btn ghost" data-join>Join</button>
      </div>
      <details><summary>Server address</summary>
        <label class="field">Race server <input data-server autocomplete="off"></label>
        <p class="sub" style="font-weight:600">You normally never need to change this.</p>
      </details>
      <div class="keys">
        <span><kbd>W</kbd> / <kbd>↑</kbd> accelerate</span>
        <span><kbd>S</kbd> / <kbd>↓</kbd> brake and reverse</span>
        <span><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd> steer</span>
        <span><kbd>Space</kbd> drift</span>
        <span><kbd>E</kbd> use item</span>
        <span><kbd>R</kbd> reset kart</span>
        <span><kbd>Esc</kbd> pause</span>
        <span>PlayStation and Xbox controllers work too: press any button to wake it up, then use the d-pad and Cross / A in menus</span>
      </div>
    </div>`;
  parent.append(screen);
  const q = <T extends HTMLElement>(s: string) => screen.querySelector(s) as T;
  const msg = q<HTMLElement>('[data-msg]'); msg.textContent = message;
  const name = q<HTMLInputElement>('[data-name]'), code = q<HTMLInputElement>('[data-code]'), server = q<HTMLInputElement>('[data-server]');
  name.value = store.get('tr-name'); server.value = store.get('tr-server') || defaultServerUrl();
  let character = savedCharacter();
  q<HTMLElement>('[data-picker]').replaceWith(characterCards(character, (id) => { character = id; saveCharacter(id); }));
  let track = savedTrack().id;
  q<HTMLElement>('[data-tracks]').replaceWith(trackCards(track, (id) => { track = id; saveTrack(id); }).el);
  const say = (t: string) => { msg.hidden = !t; msg.textContent = t; };
  // server switch: remembered choice, otherwise whichever answers fastest
  let chosen: RaceServer['id'] | '' = (store.get('tr-region') as RaceServer['id']) || '';
  const buttons = [...screen.querySelectorAll<HTMLButtonElement>('[data-srv]')];
  const showChoice = () => buttons.forEach((b) => { b.classList.toggle('on', b.dataset.srv === chosen); b.setAttribute('aria-checked', String(b.dataset.srv === chosen)); });
  buttons.forEach((b) => (b.onclick = () => { chosen = b.dataset.srv as RaceServer['id']; store.set('tr-region', chosen); showChoice(); }));
  if (!chosen) chosen = 'us';
  showChoice();
  const autoPick = !store.get('tr-region');
  const pings = new Map<string, number>();
  for (const sv of SERVERS) {
    const label = buttons.find((b) => b.dataset.srv === sv.id)!.querySelector('[data-ms]')!;
    const slow = window.setTimeout(() => { label.textContent = 'waking up…'; }, 3000);
    measurePing(sv).then((ms) => {
      window.clearTimeout(slow);
      label.textContent = ms === null ? 'not reachable' : `${ms} ms`;
      label.classList.toggle('good', ms !== null && ms < 150);
      if (ms !== null) pings.set(sv.id, ms);
      if (autoPick && !store.get('tr-region') && pings.size) { chosen = [...pings.entries()].sort((a, b) => a[1] - b[1])[0][0] as RaceServer['id']; showChoice(); }
    });
  }
  const close = () => { screen.remove(); window.removeEventListener('keydown', onKey); };
  const busy = (on: boolean) => screen.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = on));

  async function connect(kind: 'create' | 'join' | 'quick') {
    const n = name.value.trim() || 'Racer';
    store.set('tr-name', n); store.set('tr-server', server.value.trim() === defaultServerUrl() ? '' : server.value.trim());
    if (kind === 'join' && code.value.trim().length < 4) { say('Type the room code your friend sent you.'); return; }
    busy(true); say(kind === 'create' ? 'Creating a room… (the first visit can take up to a minute while the server wakes up)' : kind === 'quick' ? 'Finding a race…' : 'Joining…');
    try {
      const custom = server.value.trim() && server.value.trim() !== defaultServerUrl() ? server.value.trim() : '';
      const url = custom || (kind === 'join' ? serverForCode(code.value) : SERVERS.find((sv) => sv.id === chosen)!).url;
      const s = kind === 'create' ? await ColyseusSession.create(url, n, character) : kind === 'quick' ? await ColyseusSession.quick(url, n, character) : await ColyseusSession.join(url, code.value, n, character);
      close(); h.onRoom(s);
    } catch (e) {
      busy(false);
      const text = String((e as Error)?.message ?? e);
      say(kind === 'join' && /not found|invalid|locked|race_in_progress/i.test(text)
        ? 'That room was not found, is full, or is already racing. Check the code with your friend.'
        : 'Could not reach the race server. Check your internet, or if you are running it yourself, that it is running.');
    }
  }

  q<HTMLButtonElement>('[data-practice]').onclick = () => { close(); h.onPractice(character, track); };
  q<HTMLButtonElement>('[data-create]').onclick = () => connect('create');
  q<HTMLButtonElement>('[data-quick]').onclick = () => connect('quick');
  q<HTMLButtonElement>('[data-join]').onclick = () => connect('join');
  code.addEventListener('keydown', (e) => { if (e.key === 'Enter') connect('join'); });
  const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter' && document.activeElement === document.body) { close(); h.onPractice(character, track); } };
  window.addEventListener('keydown', onKey);
}
