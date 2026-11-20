# Tiny Racers race server

Node.js + Colyseus. Run it with `npm run server` from the project folder (or `npm run play` to start the game too).

- `src/RaceRoom.ts` is one race room (up to 8 players). Its 5-letter room id is the invitation code.
- The server is the referee: the host's **Start** begins a 3-second countdown, then the server counts laps from each kart's reported position using `shared/src/trackMath.ts`. Positions that jump faster than any kart can drive are rejected and the kart is sent back. The server decides places, finish times and results.
- It sends everyone a `world` update 20 times a second with all karts, laps and places.
