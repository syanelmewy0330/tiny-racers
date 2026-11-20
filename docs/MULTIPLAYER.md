# Multiplayer guide

How online racing works in Tiny Racers, how to run it, and how to test it.

## How it works

```
 Browser (player 1)                Race server (Node + Colyseus)              Browser (player 2)
 ─────────────────                 ─────────────────────────────              ─────────────────
 drives own kart locally   ──snap──▶  RaceRoom (one per room code)  ◀──snap──  drives own kart locally
 (Rapier physics, 60 Hz)    20/s     · checks every position (speed limit)     20/s
                                     · counts laps, decides places + results
 draws other karts smoothly ◀─world─ · sends everyone's positions 20/s ─world─▶ draws other karts smoothly
```

- **Your own kart** is simulated in your browser, so the controls react instantly (client-side prediction). It sends a small position update 20 times a second.
- **The server is the referee.** It runs the countdown, so everyone starts together. It counts laps from the positions it receives and decides places and results, so a player can't simply claim they won. If a kart jumps further than any legal boost could take it, the server sends it back (reconciliation).
- **Other karts** are drawn between the last positions received, with a small prediction ahead (interpolation), and have physics bodies so karts can bump.
- **Rooms:** a private room's code is 5 letters. Rooms hold up to 8 players. *Quick race* is the public room type and starts by itself.
- **Waiting room:** each guest presses **I'm ready**. The host's **Start race** button unlocks when every guest is ready. The server checks this too.
- **Connection drops:** if a player's connection drops without pressing Leave, the server keeps their place for **20 seconds**. Their game reconnects by itself. Everyone sees "X lost connection" and then "X is back". During a race, a chip in the top-left shows `Online · 45 ms` or `Reconnecting…`.
- **Host leaves:** the next player becomes host, and everyone is told who that is.

## Files

| Where | What |
| --- | --- |
| `server/src/index.ts` | Starts the server, Colyseus plus the built game, on one port |
| `server/src/RaceRoom.ts` | One room: join, ready, start, countdown, positions, cheat checks, laps, results, drop/reconnect, host hand-over |
| `shared/src/protocol.ts` | The messages the game and server exchange |
| `shared/src/trackMath.ts` | Lap and progress maths, used by both sides |
| `client/src/net/ColyseusSession.ts` | Talks to the server: create/join, ready, ping, reconnect events |
| `client/src/ui/TitleScreen.ts`, `client/src/ui/Lobby.ts` | Name, create/join, room code, player list, Ready, Start |
| `client/src/game/RemoteKarts.ts` | Other players' karts, name tags, smoothing |
| `client/src/game/Game.ts` | Connects room events to the race; connection chip and notices |

## Start it on your computer (PowerShell)

```powershell
cd $HOME\Documents\tiny-racers
git pull
npm install
npm run play          # server (port 2567) + game (port 5173) together
```

You can also run them separately, in two PowerShell windows:

```powershell
npm run server        # window 1: the race server
npm run dev           # window 2: the game, at http://localhost:5173
```

## Create and join a room

1. Open the game, type your name, pick a racer, and click **Create private room**. A 5-letter code appears.
2. Send the code to your partner.
3. They open the same game address, type their name, enter the code next to **Join**, and click **Join**.
4. They click **I'm ready**. You click **Start race**. After the race, **Rematch** starts the next one.

## Test procedure

| Test | Steps | Pass when |
| --- | --- | --- |
| A | `npm run play`, open http://localhost:5173 and create a private room | A code appears and you are listed as Host |
| B | Open a **second browser window** (for example an InPrivate/Incognito window) at the same address and join with the code | Both windows list both players. The guest shows "Not ready". |
| C | Click Ready in window 2, then Start in window 1. Drive in window 1. | Window 2 shows window 1's kart moving smoothly, with a name tag |
| D | Drive in window 2 | Window 1 sees it |
| E | Drive in both at once for a full race | Both karts move smoothly, places update, and both see the same results |
| Drop | During a race, turn Wi-Fi off on one computer for about 5 s, then back on | The other player sees "lost connection", then "is back". The race continues. |
| Long drop | Wi-Fi off for 30 s or more | The dropped player goes back to the title screen with a message. The others carry on. |
| Host leaves | The host clicks **Leave room** | The other player becomes host and is told so |

Only one window at a time gets your keyboard, so in a single computer test drive one window, then the other.

## Testing across different internet connections

Localhost only proves it works on one machine. To test across networks, use the **public server**, which is already set up:

- **https://tiny-racers.onrender.com**. Both people open this link from anywhere. It's served over HTTPS/WSS (encrypted). Every push to `main` deploys automatically.
- On the free plan the server sleeps after 15 minutes without players, so the first visit can take about a minute.

Avoid opening ports on your home router for this. If you ever need to test an unreleased version from your own PC across the internet, use a temporary HTTPS tunnel such as **Cloudflare Tunnel** (`cloudflared tunnel --url http://localhost:2567` after `npm run build` and `npm start`). It gives a random https address, needs no router changes, and stops when you close it. Only share that link with your partner, and close it when you are done. Never expose the Vite dev server (port 5173) to the internet.

## Known issues and limits

- **Positions come from the players' browsers.** The server rejects impossible jumps and decides laps and results, but a modified browser could still drive slightly faster than allowed. Full server-side physics would fix this, but it isn't needed for friends and couples.
- **Reconnection** works within 20 seconds. If the whole browser tab is closed, it counts as leaving.
- **Free hosting:** the first visit after a quiet period is slow, and there is one server region (US). Players far away may see 150 to 250 ms ping. This is still raceable because your own kart never waits for the network.
- **Late joiners** can't join a room mid-race. They can join once it is on the results screen, and they race in the next one.
- **Rematch** from the results screen doesn't ask guests to press Ready again.
