import { CHARACTERS, characterById, isCharacterId, type CharacterDef } from '@shared/characters';

const KEY = 'tr-character';

/** The racer this player picked last time (remembered in the browser). */
export function savedCharacter(): CharacterDef['id'] {
  let id: string | null = null;
  try { id = localStorage.getItem(KEY); } catch { /* private mode */ }
  return isCharacterId(id) ? id : 'bubbles';
}

export function saveCharacter(id: string) {
  try { localStorage.setItem(KEY, id); } catch { /* private mode */ }
}

/** Portrait image path. Relative, because the game can be served from any folder. */
export const portraitUrl = (id: string) => `characters/${characterById(id).id}.jpg`;

export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

/**
 * The four character cards: portrait, name, title, stat bars and ability.
 * Calls `onPick` with the id when one is clicked.
 */
export function characterCards(selected: string, onPick: (id: CharacterDef['id']) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'cards';
  const buttons: HTMLButtonElement[] = [];
  for (const ch of CHARACTERS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'card';
    b.dataset.character = ch.id;
    b.style.setProperty('--kart', hex(ch.color));
    b.innerHTML = `
      <div class="portrait"><img alt="" src="${portraitUrl(ch.id)}"><span></span></div>
      <div class="title"></div>
      ${stat('Speed', ch.stats.speed)}${stat('Accel', ch.stats.acceleration)}${stat('Handling', ch.stats.handling)}
      <div class="ability"><b></b> <span class="soon">milestone 5</span><br><span data-text></span></div>`;
    (b.querySelector('.portrait span') as HTMLElement).textContent = ch.name;
    (b.querySelector('.title') as HTMLElement).textContent = ch.title;
    (b.querySelector('.ability b') as HTMLElement).textContent = ch.ability;
    (b.querySelector('[data-text]') as HTMLElement).textContent = ch.abilityText;
    b.onclick = () => { mark(ch.id); onPick(ch.id); };
    buttons.push(b); wrap.append(b);
  }
  const mark = (id: string) => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.character === id)));
  mark(selected);
  return wrap;
}

function stat(label: string, v: number) {
  return `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${v * 20}%"></i></div></div>`;
}
