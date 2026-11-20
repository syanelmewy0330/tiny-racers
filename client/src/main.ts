import RAPIER from '@dimforge/rapier3d-compat';
import './style.css';
import { Game } from './game/Game';
import { showTitle } from './ui/TitleScreen';

async function boot() {
  await RAPIER.init();               // loads the physics engine (WebAssembly)
  const ui = document.getElementById('ui')!;
  const game = new Game(document.getElementById('scene') as HTMLCanvasElement, ui);
  showTitle(ui, () => game.startRace());
  (window as unknown as { tinyRacers: Game }).tinyRacers = game;   // handy for debugging in the browser console
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<p style="position:fixed;top:20px;left:20px;background:#fff;padding:12px;border:2px solid #000">Tiny Racers could not start: ${String(err)}</p>`);
});
