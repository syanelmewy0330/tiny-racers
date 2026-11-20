/** The four starter racers. Stats are 1..5 and are turned into physics numbers by the kart. */
export interface CharacterDef {
  id: 'bubbles' | 'taco' | 'nimbus' | 'peanut';
  name: string;
  title: string;
  ability: string;
  abilityText: string;
  color: number;      // main kart colour
  accent: number;     // trim colour
  fur: number;        // placeholder driver colour
  stats: { speed: number; acceleration: number; handling: number };
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'bubbles', name: 'Bubbles', title: 'The Overexcited Rookie',
    ability: 'Turbo Sneeze', abilityText: 'A huge sneeze that blasts you forward.',
    color: 0xf2b632, accent: 0x3a3550, fur: 0xb9b9c4,
    stats: { speed: 3, acceleration: 5, handling: 3 },
  },
  {
    id: 'taco', name: 'Taco', title: 'The Snack Strategist',
    ability: 'Taco Trap', abilityText: 'Drops a slippery taco behind you.',
    color: 0xe2534a, accent: 0x2f2b3d, fur: 0xd9b48a,
    stats: { speed: 5, acceleration: 2, handling: 3 },
  },
  {
    id: 'nimbus', name: 'Nimbus', title: 'The Overthinker',
    ability: 'Predictive Drift', abilityText: 'Drifts charge twice as fast for a while.',
    color: 0xa58cf0, accent: 0xffffff, fur: 0xf4efe6,
    stats: { speed: 3, acceleration: 3, handling: 5 },
  },
  {
    id: 'peanut', name: 'Peanut', title: 'The Chaos Agent',
    ability: 'Chaos Bomb', abilityText: 'Throws a bomb that spins out racers ahead.',
    color: 0x3fb5a3, accent: 0xe0773a, fur: 0xd2653a,
    stats: { speed: 4, acceleration: 4, handling: 2 },
  },
];

export const characterById = (id: string): CharacterDef =>
  CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
