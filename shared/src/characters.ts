/** The four starter racers. Stats are 1..5 and are turned into physics numbers by the kart. */
export interface CharacterDef {
  id: 'bubbles' | 'taco' | 'nimbus' | 'peanut';
  name: string;
  title: string;
  /** One or two sentences for the character select screen. */
  description: string;
  species: string;
  ability: string;
  abilityText: string;
  color: number;      // main kart colour
  accent: number;     // trim colour
  fur: number;        // placeholder driver colour
  stats: { speed: number; acceleration: number; handling: number };
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'bubbles', name: 'Bubbles', title: 'The Overexcited Rookie', species: 'Gray and white cat',
    description: 'The energetic speed demon. Always chasing the next lead.',
    ability: 'Turbo Sneeze', abilityText: 'A huge sneeze that blasts you forward.',
    color: 0xe5a94b, accent: 0x252638, fur: 0xb9b9c4,
    stats: { speed: 3, acceleration: 5, handling: 3 },
  },
  {
    id: 'taco', name: 'Taco', title: 'The Snack Strategist', species: 'Pug',
    description: 'The laid-back foodie with a surprisingly competitive streak.',
    ability: 'Taco Trap', abilityText: 'Drops a slippery taco behind you.',
    color: 0xf05b65, accent: 0x252638, fur: 0xd9b48a,
    stats: { speed: 5, acceleration: 2, handling: 3 },
  },
  {
    id: 'nimbus', name: 'Nimbus', title: 'The Overthinker', species: 'Fluffy sheep',
    description: 'The clever analyst who turns strategy into speed.',
    ability: 'Predictive Drift', abilityText: 'Drifts charge twice as fast for a while.',
    color: 0x4f8fe8, accent: 0xffffff, fur: 0xf4efe6,
    stats: { speed: 3, acceleration: 3, handling: 5 },
  },
  {
    id: 'peanut', name: 'Peanut', title: 'The Chaos Agent', species: 'Red panda',
    description: 'The chaotic wildcard. Unpredictable, bold and always up to something.',
    ability: 'Chaos Bomb', abilityText: 'Throws a bomb that spins out racers ahead.',
    color: 0xe8843a, accent: 0x252638, fur: 0xd2653a,
    stats: { speed: 4, acceleration: 4, handling: 2 },
  },
];

export const characterById = (id: string): CharacterDef =>
  CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

/** True when `id` names one of the four racers (used to check what players send the server). */
export const isCharacterId = (id: unknown): id is CharacterDef['id'] =>
  typeof id === 'string' && CHARACTERS.some((c) => c.id === id);
