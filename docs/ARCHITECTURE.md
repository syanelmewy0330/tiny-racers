# Tiny Racers architecture

## Principles
- **Physics runs at a fixed 60 steps a second**, separate from drawing. Every computer simulates the same way, which multiplayer needs.
- **Driving feel is our own arcade model, collisions are Rapier's.** `KartController` decides the velocity the kart wants each step (acceleration, steering, drift grip, boosts) and hands it to a Rapier body. After the physics step it reads the velocity back, so walls really stop or deflect the kart.
- **Visuals never affect gameplay.** `KartModel` only animates (wheels, drift lean, sparks). A real character model can replace it later without touching physics.
- **Shared rules live in `shared/`.** Track shape, lap counting, characters and constants are plain TypeScript with no graphics, so the Node server can import the exact same code.

## Multiplayer plan (milestones 2 and 3)
- `server/` becomes a Node + Colyseus app with a `RaceRoom` (max 8 clients). Rooms are created with a short invitation code; public matchmaking uses Colyseus `joinOrCreate`.
- `client/src/net/Network.ts` defines `RaceSession`. Today `OfflineSession` is used. A `ColyseusSession` will implement the same interface, so `Game.ts` stays the same.
- **Server-authoritative race state:** the server owns the countdown, lap counting (using `shared/trackMath.ts`), finishing order and results. Clients send their inputs and kart snapshots; the server checks them (for example speed and progress limits) before counting laps, so a client cannot simply claim it won.
- Other racers are drawn from snapshots with interpolation; your own kart is predicted locally for instant controls.

## Later milestones
4. Characters: real models per racer, stats already in `shared/characters.ts`.
5. Power-ups (boosts, projectiles, banana traps, shields), abilities, kart customization.
6. More tracks (each one a `TrackDef`), menus, sound, podium, progression.
