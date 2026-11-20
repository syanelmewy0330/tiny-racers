# Tiny Racers architecture

## Principles
- **Physics runs at a fixed 60 steps a second**, separate from drawing. Every computer simulates the same way, which multiplayer needs.
- **Driving feel is our own arcade model, collisions are Rapier's.** `KartController` decides the velocity the kart wants each step (acceleration, steering, drift grip, boosts) and hands it to a Rapier body. After the physics step it reads the velocity back, so walls really stop or deflect the kart.
- **Visuals never affect gameplay.** `KartModel` only animates (wheels, drift lean, sparks). A real character model can replace it later without touching physics.
- **Shared rules live in `shared/`.** Track shape, lap counting, characters and constants are plain TypeScript with no graphics, so the Node server can import the exact same code.

## Multiplayer (milestone 2 done, milestone 3 next)
- `server/` is a Node + Colyseus app with a `RaceRoom` (max 8 clients). The room id is a 5-letter invitation code (`joinById`). Public matchmaking (milestone 3) will use `joinOrCreate` on unlocked public rooms.
- Messages are plain JSON (see `shared/src/protocol.ts`), not Colyseus schema state, to keep the protocol easy to read and version.
- `client/src/net/Network.ts` defines `RaceSession`. `OfflineSession` is used for practice and `ColyseusSession` for rooms; `Game.attachRoom()` wires room events into the same race code.
- **Server-authoritative race state:** the server owns the countdown, lap counting (using `shared/trackMath.ts`), finishing order and results. Clients send their inputs and kart snapshots; the server checks them (for example speed and progress limits) before counting laps, so a client cannot simply claim it won.
- Other racers are drawn from snapshots with smoothing and slight prediction, and have kinematic physics bodies so karts bump. Your own kart is simulated locally for instant controls.
- Milestone 3 hosts the server on the internet so friends on different connections can play.

## Later milestones
4. Characters: real models per racer, stats already in `shared/characters.ts`.
5. Power-ups (boosts, projectiles, banana traps, shields), abilities, kart customization.
6. More tracks (each one a `TrackDef`), menus, sound, podium, progression.
