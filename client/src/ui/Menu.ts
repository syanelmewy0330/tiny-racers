import { CHARACTERS, characterById, type CharacterDef } from '@shared/characters';
import { KARTS, kartById, signatureKart, combinedStats, type Loadout } from '@shared/karts';
import { ColyseusSession, defaultServerUrl } from '../net/ColyseusSession';
import { KartModel } from '../game/KartModel';
import { buildCharacter } from '../models/characters';
import { CharacterAnimator } from '../models/animator';
import { shadows } from '../models/karts/base';
import { Preview3D, type PreviewSubject } from './Preview3D';
import { hex, portraitUrl, savedLoadout, saveLoadout, statBar } from './CharacterPicker';

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

type View = 'home' | 'online' | 'racer' | 'garage';

export interface MenuHandlers {
  onPractice: (loadout: Loadout) => void;
  onRoom: (s: ColyseusSession) => void;
}

/** A character in their kart, gently idling on the podium. */
function racerSubject(l: Loadout): PreviewSubject {
  const m = new KartModel(characterById(l.character), l.kart, l.paint);
  return { object: m.root, update: (dt, t) => m.animate(dt, 0, Math.sin(t * 0.7) * 0.25, 0, 0, false, t), dispose: () => m.dispose() };
}

/** The character on their own, standing on the podium. Cheers once when picked. */
function characterSubject(id: string): PreviewSubject {
  const rig = buildCharacter(id); shadows(rig.root);
  const anim = new CharacterAnimator(rig); anim.setMood('race'); anim.react();
  return { object: rig.root, update: (dt, t) => anim.update(dt, t, { speed: 0, steer: 0, drift: 0, boosting: false }) };
}

const half = (n: number) => (n > 0 ? '+' : '−') + (Math.abs(n) === 0.5 ? '½' : String(Math.abs(n)));

/**
 * The main menu: a 3D podium with your racer on the left, and on the right the
 * home buttons, online options, character select and kart garage.
 */
export function showMenu(parent: HTMLElement, h: MenuHandlers, message = '') {
  const screen = document.createElement('div');
  screen.className = 'screen menu';
  screen.innerHTML = `
    <div class="menu-wrap">
      <div class="stage"><canvas aria-label="Your racer. Drag to turn."></canvas><div class="stage-tag" data-tag></div></div>
      <div class="panel side" data-side></div>
    </div>`;
  parent.append(screen);
  const side = screen.querySelector('[data-side]') as HTMLElement, tag = screen.querySelector('[data-tag]') as HTMLElement;
  const pv = new Preview3D(screen.querySelector('canvas') as HTMLCanvasElement);

  let saved = savedLoadout();          // what you race with
  let draft: Loadout = { ...saved };   // what the racer / garage screens are showing
  let view: View = 'home';
  let note = message;

  const showRacer = (l: Loadout) => {
    pv.target.set(0, 0.9, 0); pv.distance = 6.2; pv.height = 1.6;
    pv.setPodiumColor(characterById(l.character).color);
    pv.setSubject(racerSubject(l));
    const k = kartById(l.kart);
    tag.innerHTML = `<b></b><span></span>`;
    (tag.firstChild as HTMLElement).textContent = characterById(l.character).name;
    (tag.lastChild as HTMLElement).textContent = `${k.name} · ${k.paints[l.paint].name}`;
  };
  const showCharacter = (id: string) => {
    pv.target.set(0, 0.75, 0); pv.distance = 4.4; pv.height = 1.0;
    pv.setPodiumColor(characterById(id).color);
    pv.setSubject(characterSubject(id));
    const ch = characterById(id);
    tag.innerHTML = `<b></b><span></span>`;
    (tag.firstChild as HTMLElement).textContent = ch.name;
    (tag.lastChild as HTMLElement).textContent = ch.species;
  };

  function go(v: View) {
    view = v;
    side.innerHTML = '';
    side.dataset.view = v;
    if (v === 'home') home();
    else if (v === 'online') online();
    else if (v === 'racer') racer();
    else garage();
    (side.querySelector('[data-focus]') as HTMLElement | null)?.focus();
  }

  // ---------- home ----------
  function home() {
    draft = { ...saved };
    showRacer(saved);
    const ch = characterById(saved.character), k = kartById(saved.kart), st = combinedStats(ch, k);
    side.innerHTML = `
      <h1 class="logo">Tiny Racers</h1>
      <p class="sub">Meadow Loop · 3 laps</p>
      <p class="error" data-msg hidden></p>
      <button type="button" class="loadout" data-edit style="--kart:${hex(ch.color)}">
        <img alt="" src="${portraitUrl(ch.id)}">
        <span class="who"><b data-name></b><span data-kart></span></span>
        <span class="mini-stats">${['Speed', 'Accel', 'Handling'].map((n, i) => `<span class="stat"><span>${n}</span>${statBar([st.speed, st.acceleration, st.handling][i])}</span>`).join('')}</span>
      </button>
      <div class="menu-buttons">
        <button class="btn huge" data-online data-focus>Race online</button>
        <button class="btn coral" data-practice>Practice alone</button>
        <div class="pair">
          <button class="btn ghost" data-racer>Choose racer</button>
          <button class="btn ghost" data-garage>Kart garage</button>
        </div>
      </div>
      <div class="keys">
        <span><kbd>W</kbd> / <kbd>↑</kbd> accelerate</span>
        <span><kbd>S</kbd> / <kbd>↓</kbd> brake and reverse</span>
        <span><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd> steer</span>
        <span><kbd>Space</kbd> drift</span>
        <span><kbd>R</kbd> reset kart</span>
      </div>`;
    const msg = side.querySelector('[data-msg]') as HTMLElement;
    msg.hidden = !note; msg.textContent = note; note = '';
    (side.querySelector('[data-name]') as HTMLElement).textContent = `${ch.name}, ${ch.title}`;
    (side.querySelector('[data-kart]') as HTMLElement).textContent = `${k.name} · ${k.paints[saved.paint].name}`;
    on('[data-edit]', () => go('racer'));
    on('[data-online]', () => go('online'));
    on('[data-practice]', () => { close(); h.onPractice(saved); });
    on('[data-racer]', () => go('racer'));
    on('[data-garage]', () => go('garage'));
  }

  // ---------- online ----------
  function online() {
    showRacer(saved);
    side.innerHTML = `
      <h2>Race online</h2>
      <p class="error" data-msg hidden></p>
      <label class="field">Your name <input data-name maxlength="14" placeholder="Your name" autocomplete="off" data-focus></label>
      <div class="choice">
        <button class="btn" data-quick>Quick race</button>
        <span class="sub">Race anyone who is online now.</span>
      </div>
      <div class="choice">
        <button class="btn" data-create>Create private room</button>
        <span class="sub">Get a code to send to your partner.</span>
      </div>
      <div class="row join-row">
        <input data-code class="code-in" maxlength="5" placeholder="CODE" autocomplete="off" aria-label="Room code">
        <button class="btn ghost" data-join>Join with code</button>
      </div>
      <details><summary>Server address</summary>
        <label class="field">Race server <input data-server autocomplete="off"></label>
        <p class="sub">You normally never need to change this.</p>
      </details>
      <div class="row"><button class="btn ghost small" data-back>Back</button></div>`;
    const msg = side.querySelector('[data-msg]') as HTMLElement;
    const name = side.querySelector('[data-name]') as HTMLInputElement, code = side.querySelector('[data-code]') as HTMLInputElement, server = side.querySelector('[data-server]') as HTMLInputElement;
    name.value = store.get('tr-name'); server.value = store.get('tr-server') || defaultServerUrl();
    const say = (t: string) => { msg.hidden = !t; msg.textContent = t; };
    const busy = (b: boolean) => side.querySelectorAll('button').forEach((x) => ((x as HTMLButtonElement).disabled = b));
    async function connect(kind: 'create' | 'join' | 'quick') {
      const n = name.value.trim() || 'Racer';
      store.set('tr-name', n); store.set('tr-server', server.value.trim() === defaultServerUrl() ? '' : server.value.trim());
      if (kind === 'join' && code.value.trim().length < 4) { say('Type the room code your partner sent you.'); return; }
      busy(true); say(kind === 'create' ? 'Creating a room… (the first visit can take up to a minute while the server wakes up)' : kind === 'quick' ? 'Finding a race…' : 'Joining…');
      try {
        const url = server.value.trim();
        const s = kind === 'create' ? await ColyseusSession.create(url, n, saved) : kind === 'quick' ? await ColyseusSession.quick(url, n, saved) : await ColyseusSession.join(url, code.value, n, saved);
        close(); h.onRoom(s);
      } catch (e) {
        busy(false);
        const text = String((e as Error)?.message ?? e);
        say(kind === 'join' && /not found|invalid|locked|race_in_progress/i.test(text)
          ? 'That room was not found, is full, or is already racing. Check the code with your partner.'
          : 'Could not reach the race server. Check your internet, or if you are running it yourself, that it is running.');
      }
    }
    on('[data-quick]', () => connect('quick'));
    on('[data-create]', () => connect('create'));
    on('[data-join]', () => connect('join'));
    code.addEventListener('keydown', (e) => { if (e.key === 'Enter') connect('join'); });
    on('[data-back]', () => go('home'));
  }

  // ---------- character select ----------
  function racer() {
    side.innerHTML = `
      <h2>Choose your racer</h2>
      <div class="picks" data-picks></div>
      <div class="detail" data-detail></div>
      <div class="row"><button class="btn ghost small" data-back>Back</button><button class="btn" data-ok data-focus></button></div>`;
    const picks = side.querySelector('[data-picks]') as HTMLElement, detail = side.querySelector('[data-detail]') as HTMLElement, ok = side.querySelector('[data-ok]') as HTMLButtonElement;
    const buttons = CHARACTERS.map((ch) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pick'; b.dataset.character = ch.id; b.style.setProperty('--kart', hex(ch.color));
      b.innerHTML = `<img alt="" src="${portraitUrl(ch.id)}"><span></span>`;
      (b.querySelector('span') as HTMLElement).textContent = ch.name;
      b.onclick = () => pick(ch);
      picks.append(b);
      return b;
    });
    function pick(ch: CharacterDef) {
      // your kart follows your racer unless you chose a different one in the garage
      if (draft.character !== ch.id && draft.kart === signatureKart(draft.character).id) { draft.kart = signatureKart(ch.id).id; draft.paint = 0; }
      draft.character = ch.id;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.character === ch.id)));
      showCharacter(ch.id);
      detail.style.setProperty('--kart', hex(ch.color));
      detail.innerHTML = `
        <div class="name"></div>
        <div class="title"></div>
        <p class="desc"></p>
        <div class="stats">
          <div class="stat"><span>Speed</span>${statBar(ch.stats.speed)}</div>
          <div class="stat"><span>Accel</span>${statBar(ch.stats.acceleration)}</div>
          <div class="stat"><span>Handling</span>${statBar(ch.stats.handling)}</div>
        </div>
        <div class="ability"><b></b> <span class="soon">with power-ups</span><br><span data-text></span></div>`;
      (detail.querySelector('.name') as HTMLElement).textContent = ch.name;
      (detail.querySelector('.title') as HTMLElement).textContent = `${ch.title} · ${ch.species}`;
      (detail.querySelector('.desc') as HTMLElement).textContent = ch.description;
      (detail.querySelector('.ability b') as HTMLElement).textContent = ch.ability;
      (detail.querySelector('[data-text]') as HTMLElement).textContent = ch.abilityText;
      ok.textContent = `Race as ${ch.name}`;
    }
    pick(characterById(draft.character));
    on('[data-back]', () => go('home'));
    on('[data-ok]', () => { saved = { ...draft }; saveLoadout(saved); go('home'); });
  }

  // ---------- kart garage ----------
  function garage() {
    side.innerHTML = `
      <h2>Kart garage</h2>
      <div class="picks karts" data-karts></div>
      <div class="detail" data-detail></div>
      <div class="row"><button class="btn ghost small" data-back>Back</button><button class="btn" data-ok data-focus>Done</button></div>`;
    const list = side.querySelector('[data-karts]') as HTMLElement, detail = side.querySelector('[data-detail]') as HTMLElement;
    const buttons = KARTS.map((k) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pick kart'; b.dataset.kart = k.id;
      b.style.setProperty('--kart', hex(k.paints[0].body)); b.style.setProperty('--trim', hex(k.paints[0].trim));
      b.innerHTML = `<i class="swatch"></i><span></span><small></small>`;
      (b.querySelector('span') as HTMLElement).textContent = k.name;
      (b.querySelector('small') as HTMLElement).textContent = `${characterById(k.owner).name}'s kart`;
      b.onclick = () => { if (draft.kart !== k.id) { draft.kart = k.id; draft.paint = 0; } render(); };
      list.append(b);
      return b;
    });
    function render() {
      const ch = characterById(draft.character), k = kartById(draft.kart), st = combinedStats(ch, k);
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kart === k.id)));
      showRacer(draft);
      detail.style.setProperty('--kart', hex(ch.color));
      const mod = (n: number) => (n ? `<em class="${n > 0 ? 'up' : 'down'}">${half(n * 0.5)}</em>` : '<em></em>');
      detail.innerHTML = `
        <p class="desc"></p>
        <div class="paint-row"><span class="label">Paint</span><div class="paints" data-paints></div><span class="paint-name"></span></div>
        <div class="stats with-mods">
          <div class="stat"><span>Speed</span>${statBar(st.speed)}${mod(k.mods.speed)}</div>
          <div class="stat"><span>Accel</span>${statBar(st.acceleration)}${mod(k.mods.acceleration)}</div>
          <div class="stat"><span>Handling</span>${statBar(st.handling)}${mod(k.mods.handling)}</div>
        </div>
        <p class="sub small">${ch.name}'s stats in this kart. Paint is just for looks.</p>`;
      (detail.querySelector('.desc') as HTMLElement).textContent = k.description;
      (detail.querySelector('.paint-name') as HTMLElement).textContent = k.paints[draft.paint].name;
      const paints = detail.querySelector('[data-paints]') as HTMLElement;
      k.paints.forEach((p, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'paint'; b.title = p.name; b.setAttribute('aria-label', p.name);
        b.style.setProperty('--body', hex(p.body)); b.style.setProperty('--trim', hex(p.trim));
        b.setAttribute('aria-pressed', String(i === draft.paint));
        b.onclick = () => { draft.paint = i; render(); };
        paints.append(b);
      });
    }
    render();
    on('[data-back]', () => go('home'));
    on('[data-ok]', () => { saved = { ...draft }; saveLoadout(saved); go('home'); });
  }

  function on(sel: string, fn: () => void) { (side.querySelector(sel) as HTMLElement).onclick = fn; }

  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Escape' && view !== 'home') go('home');
    else if (e.code === 'Enter' && view === 'home' && (document.activeElement === document.body || document.activeElement === null)) { close(); h.onPractice(saved); }
  };
  window.addEventListener('keydown', onKey);
  function close() { window.removeEventListener('keydown', onKey); pv.dispose(); screen.remove(); }

  go('home');
  return close;
}
