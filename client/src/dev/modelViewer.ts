/**
 * Developer page (npm run dev, then open /models.html): look at any character and kart.
 * ?c=bubbles&k=zoomie&p=0&show=both|character|kart&yaw=0.6&mood=race|win|lose
 */
import { characterById, CHARACTERS } from '@shared/characters';
import { KARTS, kartById } from '@shared/karts';
import { Preview3D } from '../ui/Preview3D';
import { KartModel } from '../game/KartModel';
import { buildCharacter } from '../models/characters';
import { buildKart } from '../models/karts';
import { CharacterAnimator } from '../models/animator';
import { shadows } from '../models/karts/base';

const q = new URLSearchParams(location.search);
const c = q.get('c') ?? 'bubbles', k = q.get('k') ?? kartById('').id, p = Number(q.get('p') ?? 0), show = q.get('show') ?? 'both';
const pv = new Preview3D(document.getElementById('c') as HTMLCanvasElement, characterById(c).color);
if (q.has('yaw')) pv.setYaw(Number(q.get('yaw')));
if (q.has('dist')) pv.distance = Number(q.get('dist'));
if (q.has('h')) pv.height = Number(q.get('h'));
if (q.has('ty')) pv.target.y = Number(q.get('ty'));
const steer = Number(q.get('steer') ?? 0), drift = Number(q.get('drift') ?? 0), boost = q.has('boost');
const mood = (q.get('mood') ?? 'race') as 'race' | 'win' | 'lose';

if (show === 'character') {
  const rig = buildCharacter(c); shadows(rig.root);
  const anim = new CharacterAnimator(rig); anim.setMood(mood);
  pv.target.y = q.has('ty') ? pv.target.y : 0.75; pv.distance = q.has('dist') ? pv.distance : 4.2;
  pv.setSubject({ object: rig.root, update: (dt, t) => anim.update(dt, t, { speed: 0, steer: 0, drift: 0, boosting: false }) });
} else if (show === 'kart') {
  const kd = kartById(k), rig = buildKart(kd.id, kd.paints[p] ?? kd.paints[0]); shadows(rig.root);
  pv.setSubject({ object: rig.root, update: (dt, t) => rig.idle?.(t, dt, 0) });
} else {
  const m = new KartModel(characterById(c), k, p); m.setMood(mood);
  pv.setSubject({ object: m.root, update: (dt, t) => m.animate(dt, Number(q.get('speed') ?? 0), steer, drift, drift ? 2 : 0, boost, t) });
}
const nav = document.getElementById('nav')!;
for (const ch of CHARACTERS) nav.insertAdjacentHTML('beforeend', `<a href="?c=${ch.id}&show=character">${ch.name}</a>`);
for (const kd of KARTS) nav.insertAdjacentHTML('beforeend', `<a href="?k=${kd.id}&show=kart">${kd.name}</a>`);
for (const ch of CHARACTERS) nav.insertAdjacentHTML('beforeend', `<a href="?c=${ch.id}&k=${KARTS.find((x) => x.owner === ch.id)!.id}">${ch.name} + kart</a>`);
if (q.has('clean')) nav.remove();
(window as unknown as { ready: boolean }).ready = true;
