import { defaultServerUrl } from './ColyseusSession';

/**
 * The race servers you can pick on the title screen. A private room lives on one
 * server, and its code says which: codes made in Europe start with "E".
 */
export interface RaceServer { id: 'us' | 'eu'; name: string; url: string }

const onRender = location.hostname.endsWith('onrender.com');
const EU_URL = (import.meta.env.VITE_EU_SERVER as string | undefined) || 'wss://tiny-racers-eu.onrender.com';

export const SERVERS: RaceServer[] = [
  { id: 'us', name: 'US West', url: onRender ? 'wss://tiny-racers.onrender.com' : defaultServerUrl() },
  // while developing, the Europe server is a second copy on port 2568
  { id: 'eu', name: 'Europe', url: onRender ? EU_URL : defaultServerUrl().replace(/:\d+$/, ':2568') },
];

/** Which server a room code belongs to. */
export const serverForCode = (code: string) => SERVERS[code.trim().toUpperCase().startsWith('E') ? 1 : 0];

/**
 * How long a round trip to the server takes, in ms (the lower the better).
 * A sleeping free server can take up to a minute to answer the first time, which also wakes it.
 */
export async function measurePing(s: RaceServer): Promise<number | null> {
  const http = s.url.replace(/^ws/, 'http') + '/health';
  try {
    await fetch(http, { cache: 'no-store' });   // first call also wakes it up and opens the connection
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const t = performance.now();
      await fetch(http, { cache: 'no-store' });
      best = Math.min(best, performance.now() - t);
    }
    return Math.round(best);
  } catch { return null; }
}
