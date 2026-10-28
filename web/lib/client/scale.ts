// Colour scale and labels for the map layers (see web/DESIGN.md).
import type { LayerId } from '@contracts/types';
import type { MessageKey } from './i18n';

export type MapLayer = 'need' | LayerId;

/** Layers offered on the map; `info` says what it shows and which data it comes from (legend). */
export const MAP_LAYERS: { id: MapLayer; label: MessageKey; info: MessageKey }[] = [
  { id: 'need', label: 'layer.need', info: 'info.need' },
  { id: 'heat', label: 'layer.heat', info: 'info.heat' },
  { id: 'air', label: 'layer.air', info: 'info.air' },
  { id: 'bike', label: 'layer.bike', info: 'info.bike' },
  { id: 'green', label: 'layer.green', info: 'info.green' },
  { id: 'risk', label: 'layer.risk', info: 'info.risk' },
  // 'felt' (from voice reports) is hidden until it is computed; the report dots show reports meanwhile.
];

// Six steps at 0, .2, .4, .6, .8, 1 — sequential, colour-blind safe.
export const NEED_STEPS = ['#FFF5D6', '#FDD98A', '#F9A94B', '#E8702A', '#C2410C', '#8A1C04'];

