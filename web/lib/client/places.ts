// The three real demo places from demo-places.md (H3): QR posters, report-flow defaults, pitch.
import type { MissionType } from '@contracts/types';

export interface DemoPlace {
  id: string;
  name: string;
  type: 'bus_stop' | 'school';
  lat: number;
  lng: number;
  mission: MissionType;
  address: string;
  /** Example sentence for the demo, also used as the report hint text. */
  example: string;
}

export const DEMO_PLACES: DemoPlace[] = [
  {
    id: 'etzelstrasse', name: 'Etzelstraße', type: 'bus_stop', lat: 49.151351, lng: 9.21565,
    mission: 'pollinator_gap', address: '74076 Heilbronn, neben dem OpenSpace',
    example: 'An der Haltestelle Etzelstraße gibt es nur Asphalt und keine Blumen, hier könnte man was für Wildbienen pflanzen.',
  },
  {
    id: 'harmonie', name: 'Harmonie/Hafenmarktpassage', type: 'bus_stop', lat: 49.14229, lng: 9.22227,
    mission: 'shade_bus_stop', address: '74072 Heilbronn',
    example: 'An der Haltestelle Harmonie ist es mittags total heiß und es gibt keinen Schatten.',
  },
  {
    id: 'thg', name: 'Theodor-Heuss-Gymnasium', type: 'school', lat: 49.14256, lng: 9.22696,
    mission: 'green_schoolyard', address: 'Gymnasiumstraße 70, 74072 Heilbronn',
    example: 'Der Schulhof am Theodor-Heuss-Gymnasium ist komplett zubetoniert, im Sommer kann man da nicht sein.',
  },
];

/** Relative report URL as printed on the QR posters (same format as demo-places.md). */
export function reportPath(p: DemoPlace): string {
  return `/report?lat=${p.lat}&lng=${p.lng}&place=${encodeURIComponent(p.name)}`;
}

export function findDemoPlace(name: string | null | undefined): DemoPlace | undefined {
  return name ? DEMO_PLACES.find((p) => p.name === name || p.id === name) : undefined;
}
