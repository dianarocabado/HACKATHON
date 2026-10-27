// Colour scale and labels for the map layers (see web/DESIGN.md).
import type { LayerId } from '@contracts/types';
import type { MessageKey } from './i18n';

export type MapLayer = 'need' | LayerId;

export const MAP_LAYERS: { id: MapLayer; label: MessageKey }[] = [
  { id: 'need', label: 'layer.need' },
  { id: 'heat', label: 'layer.heat' },
  { id: 'air', label: 'layer.air' },
  { id: 'bike', label: 'layer.bike' },
  { id: 'green', label: 'layer.green' },
  { id: 'risk', label: 'layer.risk' },
  { id: 'felt', label: 'layer.felt' },
];

// Six steps at 0, .2, .4, .6, .8, 1 — sequential, colour-blind safe.
export const NEED_STEPS = ['#FFF5D6', '#FDD98A', '#F9A94B', '#E8702A', '#C2410C', '#8A1C04'];

