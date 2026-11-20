import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RaceRoom } from './RaceRoom.ts';

const PORT = Number(process.env.PORT ?? 2567);

const server = new Server({ transport: new WebSocketTransport() });
server.define('race', RaceRoom);

server.listen(PORT).then(() => {
  console.log(`\n  Tiny Racers server is running on port ${PORT}.`);
  console.log('  Keep this window open while you race. Press Ctrl + C to stop it.\n');
});
