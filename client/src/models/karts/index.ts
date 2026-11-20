import type { PaintDef } from '@shared/karts';
import type { KartRig } from './base';
import { buildZoomie } from './zoomie';
import { buildSnackMobile } from './snackMobile';
import { buildCalculatron } from './calculatron';
import { buildLittleDisaster } from './littleDisaster';

const builders: Record<string, (p: PaintDef) => KartRig> = {
  zoomie: buildZoomie,
  'snack-mobile': buildSnackMobile,
  calculatron: buildCalculatron,
  'little-disaster': buildLittleDisaster,
};

/** Build a fresh kart model by id with a paint job (falls back to Zoomie). */
export function buildKart(id: string, paint: PaintDef): KartRig {
  return (builders[id] ?? buildZoomie)(paint);
}
export type { KartRig } from './base';
