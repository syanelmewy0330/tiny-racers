# Tiny Racers architecture

## Principles
- **Physics runs at a fixed 60 steps a second**, separate from drawing. Every computer simulates the same way, which multiplayer needs.
- **Driving feel is our own arcade model, collisions are Rapier's.** `KartController` decides the velocity the kart wants each step (acceleration, steering, drift grip, boosts) and hands it to a Rapier body. After the physics step it reads the velocity back, so walls really stop or deflect the kart.
- **Visuals never affect gameplay.** `KartModel` only animates (wheels, drift lean, sparks). A real character model can replace it later without touching physics.
- **Shared rules live in `shared/`.** Track shape, lap counting, characters and constants are plain TypeScript with no graphics, so the Node server can import the exact same code.

## Multiplayer (milestones 2 and 3)
- `server/` is a Node + Colyseus app with a `RaceRoom` (max 8 clients). The room id is a 5-letter invitation code (`joinById`). Quick race is a second room type, `public`, joined with `joinOrCreate`: it fills waiting rooms up to 8, starts by itself 15 s after two racers are in, and locks while racing so latecomers get a fresh room.
- Messages are plain JSON (see `shared/src/protocol.ts`), not Colyseus schema state, to keep the protocol easy to read and version.
- `client/src/net/Network.ts` defines `RaceSession`. `OfflineSession` is used for practice and `ColyseusSession` for rooms; `Game.attachRoom()` wires room events into the same race code.
- **Server-authoritative race state:** the server owns the countdown, lap counting (using `shared/trackMath.ts`), finishing order and results. Clients send their inputs and kart snapshots; the server checks them (for example speed and progress limits) before counting laps, so a client cannot simply claim it won.
- Other racers are drawn from snapshots with smoothing and slight prediction, and have kinematic physics bodies so karts bump. Your own kart is simulated locally for instant controls.
- Hosting: one Render web service (`render.yaml`). `server/src/index.ts` serves `client/dist` over HTTP and Colyseus over WebSocket on the same port, so the game connects to its own address.

## Characters (milestone 4)
- `shared/characters.ts` holds each racer's stats (1 to 5). `KartController` turns them into physics numbers (top speed, acceleration, turn rate), so stats change how the kart drives, not just how it looks.
- `KartModel` builds a different kart and driver per character from simple shapes (placeholders until real models), plus `setMood('race' | 'win' | 'lose')` for the finish animations.
- The choice is sent when joining a room (`character` option) and can be changed in the lobby with a `character` message. The server checks it is a real id (`isCharacterId`) and only allows changes between races. Duplicates are allowed, so two people can both be Bubbles.

## Later milestones
5. Power-ups (boosts, projectiles, banana traps, shields), abilities, kart customization.
6. More tracks (each one a `TrackDef`), menus, sound, podium, progression.
