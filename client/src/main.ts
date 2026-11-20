import RAPIER from '@dimforge/rapier3d-compat';
import './style.css';
import { Game } from './game/Game';
import { showTitle } from './ui/TitleScreen';
import { showLobby } from './ui/Lobby';
import type { ColyseusSession } from './net/ColyseusSession';

async function boot() {
  await RAPIER.init();               // loads the physics engine (WebAssembly)
  // ?glb=bubbles tries the Blender-made Bubbles instead of the built-in one
  if (new URLSearchParams(location.search).get('glb') === 'bubbles') {
    const [{ loadGlbCharacter, BUBBLES_V1 }, { setCharacterBuilder }] = await Promise.all([import('./models/characters/glbCharacter'), import('./models/characters')]);
    setCharacterBuilder('bubbles', await loadGlbCharacter(BUBBLES_V1));
    const [{ loadGlbKart, ZOOMIE_V1 }, { setKartBuilder }] = await Promise.all([import('./models/karts/glbKart'), import('./models/karts')]);
    setKartBuilder('zoomie', await loadGlbKart(ZOOMIE_V1));
  }
  const ui = document.getElementById('ui')!;
  const game = new Game(document.getElementById('scene') as HTMLCanvasElement, ui);

  let closeLobby: (() => void) | null = null;
  const title = (message = '') => showTitle(ui, { onPractice: (character) => game.startRace(character), onRoom }, message);
  const onRoom = (s: ColyseusSession) => {
    game.attachRoom(s);
    closeLobby = showLobby(ui, s, () => game.leaveRoom());
  };
  game.onRaceStarted = () => { closeLobby?.(); closeLobby = null; };
  game.onLeftRoom = (reason) => { closeLobby?.(); closeLobby = null; title(reason ?? ''); };
  title();
  (window as unknown as { tinyRacers: Game }).tinyRacers = game;   // handy for debugging in the browser console
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<p style="position:fixed;top:20px;left:20px;background:#fff;padding:12px;border:2px solid #000">Tiny Racers could not start: ${String(err)}</p>`);
});
