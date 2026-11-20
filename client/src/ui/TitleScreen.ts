import { ColyseusSession, defaultServerUrl } from '../net/ColyseusSession';

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/** First screen: practice alone, or create / join an online room. */
export function showTitle(parent: HTMLElement, h: { onPractice: () => void; onRoom: (s: ColyseusSession) => void }, message = '') {
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.innerHTML = `
    <div class="panel" style="width:min(600px,100%)">
      <h1 class="logo">Tiny Racers</h1>
      <p class="sub">Meadow Loop · 3 laps</p>
      <p class="error" data-msg ${message ? '' : 'hidden'}></p>
      <div class="row" style="justify-content:flex-start"><button class="btn ghost" data-practice>Practice alone</button></div>
      <h2>Race online</h2>
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
        <span><kbd>R</kbd> reset kart</span>
      </div>
    </div>`;
  parent.append(screen);
  const q = <T extends HTMLElement>(s: string) => screen.querySelector(s) as T;
  const msg = q<HTMLElement>('[data-msg]'); msg.textContent = message;
  const name = q<HTMLInputElement>('[data-name]'), code = q<HTMLInputElement>('[data-code]'), server = q<HTMLInputElement>('[data-server]');
  name.value = store.get('tr-name'); server.value = store.get('tr-server') || defaultServerUrl();
  const say = (t: string) => { msg.hidden = !t; msg.textContent = t; };
  const close = () => { screen.remove(); window.removeEventListener('keydown', onKey); };
  const busy = (on: boolean) => screen.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = on));

  async function connect(kind: 'create' | 'join' | 'quick') {
    const n = name.value.trim() || 'Racer';
    store.set('tr-name', n); store.set('tr-server', server.value.trim() === defaultServerUrl() ? '' : server.value.trim());
    if (kind === 'join' && code.value.trim().length < 4) { say('Type the room code your friend sent you.'); return; }
    busy(true); say(kind === 'create' ? 'Creating a room… (the first visit can take up to a minute while the server wakes up)' : kind === 'quick' ? 'Finding a race…' : 'Joining…');
    try {
      const url = server.value.trim();
      const s = kind === 'create' ? await ColyseusSession.create(url, n) : kind === 'quick' ? await ColyseusSession.quick(url, n) : await ColyseusSession.join(url, code.value, n);
      close(); h.onRoom(s);
    } catch (e) {
      busy(false);
      const text = String((e as Error)?.message ?? e);
      say(kind === 'join' && /not found|invalid|locked|race_in_progress/i.test(text)
        ? 'That room was not found, is full, or is already racing. Check the code with your friend.'
        : 'Could not reach the race server. Check your internet, or if you are running it yourself, that it is running.');
    }
  }

  q<HTMLButtonElement>('[data-practice]').onclick = () => { close(); h.onPractice(); };
  q<HTMLButtonElement>('[data-create]').onclick = () => connect('create');
  q<HTMLButtonElement>('[data-quick]').onclick = () => connect('quick');
  q<HTMLButtonElement>('[data-join]').onclick = () => connect('join');
  code.addEventListener('keydown', (e) => { if (e.key === 'Enter') connect('join'); });
  const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter' && document.activeElement === document.body) { close(); h.onPractice(); } };
  window.addEventListener('keydown', onKey);
}
