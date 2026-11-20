/** First screen: title, controls and a Play button. Character select arrives in milestone 4. */
export function showTitle(parent: HTMLElement, onPlay: () => void) {
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.innerHTML = `
    <div class="panel" style="width:min(560px,100%)">
      <h1 class="logo">Tiny Racers</h1>
      <p class="sub">Meadow Loop · 3 laps · practice run</p>
      <div class="keys">
        <span><kbd>W</kbd> / <kbd>↑</kbd> accelerate</span>
        <span><kbd>S</kbd> / <kbd>↓</kbd> brake and reverse</span>
        <span><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd> steer</span>
        <span><kbd>Space</kbd> drift (hold while turning)</span>
        <span><kbd>R</kbd> reset kart</span>
      </div>
      <p class="sub" style="font-weight:600">Tip: hold a drift until the sparks turn orange, then let go for a super turbo. Drive over yellow pads for a boost.</p>
      <div class="row"><button class="btn" data-play>Play</button></div>
    </div>`;
  parent.append(screen);
  const btn = screen.querySelector('[data-play]') as HTMLButtonElement;
  const go = () => { screen.remove(); window.removeEventListener('keydown', onKey); onPlay(); };
  const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter') go(); };
  btn.onclick = go;
  window.addEventListener('keydown', onKey);
  btn.focus();
}
