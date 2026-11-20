import * as THREE from 'three';
import { G, blob, part, group, vinyl, matte } from '../toy';

/**
 * A character model, separate from any kart. Origin is the seat point (bottom of
 * the body), facing +z. Named joints let the animator move it, both when sitting
 * in a kart and when standing on the character select podium.
 */
export interface CharacterRig {
  root: THREE.Group;
  torso: THREE.Group;       // breathes, leans
  head: THREE.Group;        // pivot at the neck
  armL: THREE.Group;        // pivot at the shoulder; hand at local (0, -ARM, 0)
  armR: THREE.Group;
  eyes: THREE.Object3D[];   // scale.y blinks
  ears: THREE.Object3D[];   // twitch
  tail: THREE.Group | null; // sways
  /** Extra character-specific idle motion (sweat drop, tongue wiggle…). */
  idle?: (t: number, dt: number, excited: number) => void;
}

export const ARM = 0.36;

export interface BodyStyle {
  outfit: number;           // jacket / suit colour
  trim: number;             // collar and stripes
  chest?: number;           // fur showing at the chest
  hands: number;            // paws or gloves
  handsMatte?: boolean;     // gloves are fabric
  feet: number;
  /** Two racing stripes down the front (otherwise a zip). */
  stripes?: boolean;
}

/** The shared toy body: round torso, stubby arms, little feet and a neck pivot. */
export function toyBody(style: BodyStyle): CharacterRig {
  const root = new THREE.Group();
  const torso = group([0, 0, 0]);
  root.add(torso);
  const suit = vinyl(style.outfit, 0.55);
  torso.add(blob(suit, [0, 0.28, 0], [0.33, 0.34, 0.29]));
  torso.add(part(G.torus(0.2, 0.05), vinyl(style.trim, 0.5), [0, 0.55, 0.0], [1, 1, 1], [Math.PI / 2, 0, 0]));   // collar
  if (style.chest !== undefined) torso.add(blob(vinyl(style.chest), [0, 0.36, 0.2], [0.17, 0.17, 0.12]));
  // racing stripes down the front
  if (style.stripes) for (const x of [-0.12, 0.12]) torso.add(blob(vinyl(style.trim, 0.5), [x, 0.3, 0.255], [0.035, 0.2, 0.04]));
  else torso.add(blob(vinyl(style.trim, 0.4), [0, 0.3, 0.285], [0.014, 0.2, 0.02]));
  for (const x of [-0.15, 0.15]) root.add(blob(vinyl(style.feet), [x, 0.04, 0.16], [0.11, 0.08, 0.15]));

  const handMat = style.handsMatte ? matte(style.hands) : vinyl(style.hands);
  const arm = (side: 1 | -1) => {
    const a = group([side * 0.3, 0.46, 0.02]);
    a.add(part(G.capsule(0.08, 0.2), suit, [0, -0.16, 0]));
    a.add(blob(handMat, [0, -ARM, 0], [0.1, 0.1, 0.1]));
    torso.add(a);
    return a;
  };
  const head = group([0, 0.56, 0.02]);
  torso.add(head);
  return { root, torso, head, armL: arm(1), armR: arm(-1), eyes: [], ears: [], tail: null };
}
