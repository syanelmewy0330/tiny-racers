// Starts the race server and the game together, for one-command local play.
import { spawn } from 'node:child_process';
import os from 'node:os';

const run = (name, args) => {
  const p = spawn('npm', args, { stdio: 'inherit', shell: true });
  p.on('exit', (code) => { console.log(`${name} stopped (${code}).`); process.exit(code ?? 0); });
  return p;
};
run('Race server', ['run', 'server']);
run('Game', ['run', 'dev']);

setTimeout(() => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log('\n  Tiny Racers is running.');
  console.log('  On this computer:      http://localhost:5173');
  for (const ip of ips) console.log(`  On another computer on the same Wi-Fi: http://${ip}:5173`);
  console.log('  Press Ctrl + C to stop.\n');
}, 4000);
