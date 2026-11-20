import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RaceRoom } from './RaceRoom.ts';

const PORT = Number(process.env.PORT ?? 2567);
// When the game has been built (npm run build), the server hands it out too,
// so one web address serves both the game and the races.
const GAME_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon',
};

/** Serves the game files. Returns false for requests Colyseus should answer (matchmaking). */
function serveGame(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname.startsWith('/matchmake')) return false;
  if (url.pathname === '/health') { res.end('ok'); return true; }
  if (!fs.existsSync(GAME_DIR)) { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('Tiny Racers server is running. (Run "npm run build" to serve the game from here too.)'); return true; }
  let file = path.join(GAME_DIR, decodeURIComponent(url.pathname));
  if (!file.startsWith(GAME_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(GAME_DIR, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000' });
  fs.createReadStream(file).pipe(res);
  return true;
}

const httpServer = http.createServer();
// Every web request goes to serveGame first; only matchmaking requests reach Colyseus.
const emit = httpServer.emit.bind(httpServer);
httpServer.emit = ((event: string, ...args: unknown[]) => {
  if (event === 'request' && serveGame(args[0] as http.IncomingMessage, args[1] as http.ServerResponse)) return true;
  return emit(event, ...args);
}) as typeof httpServer.emit;

const server = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
server.define('race', RaceRoom, { public: false });       // private rooms, joined with a code
server.define('public', RaceRoom, { public: true });      // Quick race: matched with anyone

server.listen(PORT).then(() => {
  console.log(`\n  Tiny Racers server is running on port ${PORT}.`);
  console.log('  Keep this window open while you race. Press Ctrl + C to stop it.\n');
});
