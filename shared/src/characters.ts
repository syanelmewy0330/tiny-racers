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
    description: 'Energetic, reckless and thrilled about absolutely everything. Bubbles has never once braked on purpose.',
    ability: 'Turbo Sneeze', abilityText: 'A huge sneeze that blasts you forward.',
    color: 0xffc84a, accent: 0x3b2e55, fur: 0xa9a7b8,
    stats: { speed: 3, acceleration: 5, handling: 3 },
  },
  {
    id: 'taco', name: 'Taco', title: 'The Snack Strategist', species: 'Pug',
    description: 'Lazy and always hungry, until the countdown starts. Then Taco is unexpectedly, terrifyingly competitive.',
    ability: 'Taco Trap', abilityText: 'Drops a slippery taco behind you.',
    color: 0xff5c8a, accent: 0x3b2e55, fur: 0xe8c59a,
    stats: { speed: 5, acceleration: 2, handling: 3 },
  },
  {
    id: 'nimbus', name: 'Nimbus', title: 'The Overthinker', species: 'Fluffy sheep',
    description: 'Brilliant, anxious and analytical. Nimbus has calculated the perfect racing line, and is worried about it.',
    ability: 'Predictive Drift', abilityText: 'Drifts charge twice as fast for a while.',
    color: 0x6ccff6, accent: 0x8b7cff, fur: 0xfbf7f0,
    stats: { speed: 3, acceleration: 3, handling: 5 },
  },
  {
    id: 'peanut', name: 'Peanut', title: 'The Chaos Agent', species: 'Red panda',
    description: 'Mischievous and completely unpredictable. Nobody knows what Peanut will do next, including Peanut.',
    ability: 'Chaos Bomb', abilityText: 'Throws a bomb that spins out racers ahead.',
    color: 0xff9a3c, accent: 0x2fb5a3, fur: 0xe06a2c,
    stats: { speed: 4, acceleration: 4, handling: 2 },
  },
];

export const characterById = (id: string): CharacterDef =>
  CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

/** True when `id` names one of the four racers (used to check what players send the server). */
export const isCharacterId = (id: unknown): id is CharacterDef['id'] =>
  typeof id === 'string' && CHARACTERS.some((c) => c.id === id);
