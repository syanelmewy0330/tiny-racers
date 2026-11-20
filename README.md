# Tiny Racers

A cute 3D arcade kart racing game for the browser, built with Vite, TypeScript, Three.js and Rapier physics.

**Current milestone: 4, the four characters.** Pick Bubbles, Taco, Nimbus or Peanut on the title screen. Each has their own kart, driver and stats (speed, acceleration, handling), and cheers or droops at the finish. Online, everyone sees each other's racer and can switch racers in the lobby. Up to 8 racers: press **Quick race** to race anyone online, or **Create private room** and share its code.

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

## Put it online (free, on Render)

The repo includes `render.yaml`, so Render knows how to build and run everything as one free web service.
The server also hands out the game, so there is a single web address to share.

1. Sign up at https://render.com with your GitHub account, and allow Render to see the `tiny-racers` repo.
2. In Render: **New** → **Blueprint** → pick `tiny-racers` → **Deploy Blueprint**.
3. When it says **Live**, open its address (like `https://tiny-racers.onrender.com`). Send that link to friends.

Every time new code is pushed to `main`, Render updates the game by itself. On the free plan the server sleeps after 15 minutes without players, so the first visit after a break takes about a minute to wake up.

## Race a friend on your own Wi-Fi (without Render)

On **your** computer (the host), in PowerShell:

```powershell
cd $HOME\Documents\tiny-racers
git pull
npm install
npm run play
```

This starts the race server and the game together, and prints two addresses. If Windows asks whether to allow Node.js on the network, click **Allow** (private networks).

1. On your computer, the game opens. Type your name and click **Create room**. You get a 5-letter code.
2. On the **other** computer, open a browser and go to the "another computer" address it printed, like `http://192.168.1.23:5173`. That computer doesn't need to install anything.
3. Your friend types their name and the code, then clicks **Join**. You both see each other in the room.
4. Your friend clicks **I'm ready**, then you (the host) click **Start race**. After the race, click **Rematch** to go again.


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
        KartModel.ts      each character's 3D kart and driver, win/lose poses (visual only)
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
      game/RemoteKarts.ts the other racers: smooth movement, name tags, bumping
      ui/TitleScreen.ts   practice, create room, join room
      ui/Lobby.ts         waiting room with the invite code and racer switcher
      ui/CharacterPicker.ts the character cards (portrait, stats, ability)
  client/public/characters/ the four character portraits
      net/ColyseusSession.ts talks to the race server
  server/src/
    index.ts              starts the Colyseus server (port 2567) and serves the built game
  render.yaml             free hosting setup for Render
    RaceRoom.ts           one race: players, countdown, laps, cheat checks, results
  shared/src/protocol.ts  the messages the game and server exchange
  scripts/play.mjs        npm run play: server + game in one window
```

Design notes are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Multiplayer details, the test procedure and cross-network testing are in [docs/MULTIPLAYER.md](docs/MULTIPLAYER.md).

## Useful commands

```powershell
npm run play       # race server + game together (use this for multiplayer)
npm run dev        # only the game (practice works without the server)
npm run server     # only the race server
npm start          # what Render runs: the server, also serving the built game
npm run build      # check types and make a production build in client/dist
npm run typecheck  # only check the TypeScript
```
