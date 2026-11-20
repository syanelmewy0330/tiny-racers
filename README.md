# Tiny Racers

A cute 3D arcade kart racing game for the browser, built with Vite, TypeScript, Three.js and Rapier physics.

**Current milestone: 1, first playable kart.** One kart, one track (Meadow Loop), 3 laps, practice mode.

## Run it on Windows

You need two free tools, installed once. Open **Windows PowerShell** and run:

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

Close PowerShell and open it again so it picks them up. Then:

```powershell
cd $HOME\Documents
git clone https://github.com/syanelmewy0330/tiny-racers.git
cd tiny-racers
npm install
npm run dev
```

Your browser opens the game at http://localhost:5173. To stop the game server, click in PowerShell and press `Ctrl + C`.
Next time you only need `cd $HOME\Documents\tiny-racers` and `npm run dev`. To get my latest changes first, run `git pull`.

**If PowerShell says "running scripts is disabled on this system"**, run this once, then try again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Controls

| Key | Action |
| --- | --- |
| W / Up arrow | Accelerate |
| S / Down arrow | Brake, then reverse |
| A D / Left Right arrows | Steer |
| Space (hold while turning) | Drift. Blue sparks = mini turbo, orange sparks = super turbo when you let go |
| R | Reset the kart onto the road |
| Enter | Start from the title screen |

Yellow chevron pads on the road give a speed boost. The grass strip by the walls slows you down.

## Project layout

```
tiny-racers/
  client/                 the game that runs in the browser
    index.html
    src/
      main.ts             starts the physics engine and the game
      game/
        Game.ts           main loop: fixed 60 Hz physics, then drawing
        Input.ts          keyboard
        KartController.ts how the kart drives (speed, steering, drift, boosts) on Rapier
        KartModel.ts      the placeholder 3D kart and driver (visual only)
        Track.ts          road, curbs, walls (with physics), boost pads, start line
        Environment.ts    sky, lights, trees, flowers, hills, clouds, start arch
        CameraRig.ts      chase camera
        RaceTracker.ts    countdown, laps, timing
      ui/                 title screen and race HUD
      net/Network.ts      "race session" interface; offline now, Colyseus in milestone 2
  shared/src/             rules and data used by both the game and the future server
    constants.ts          max players, laps, physics rate
    characters.ts         Bubbles, Taco, Nimbus, Peanut (stats and abilities)
    tracks/meadowLoop.ts  the track's centre line, width and boost pads
    trackMath.ts          lap and progress maths
  server/                 multiplayer server (milestone 2)
```

Design notes are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Useful commands

```powershell
npm run dev        # play locally
npm run build      # check types and make a production build in client/dist
npm run typecheck  # only check the TypeScript
```
