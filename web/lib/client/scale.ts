// Colour scale and labels for the map layers (see web/DESIGN.md).
import type { LayerId } from '@contracts/types';

export type MapLayer = 'need' | LayerId;

export const MAP_LAYERS: { id: MapLayer; label: string }[] = [
  { id: 'need', label: 'Bedarf' },
  { id: 'heat', label: 'Hitze' },
  { id: 'air', label: 'Luft' },
  { id: 'bike', label: 'Rad' },
  { id: 'green', label: 'Grün' },
  { id: 'risk', label: 'Risiko' },
  { id: 'felt', label: 'Gefühlt' },
];

// Six steps at 0, .2, .4, .6, .8, 1 — sequential, colour-blind safe.
export const NEED_STEPS = ['#FFF5D6', '#FDD98A', '#F9A94B', '#E8702A', '#C2410C', '#8A1C04'];

export const NO_DATA_LABEL = 'keine Daten';
