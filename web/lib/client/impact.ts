// Number formatting and sentences for the impact view (evidence cards, mission before/after).
import type { ImpactResult } from '@contracts/types';

export const fmt = (v: number, digits = 1) =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits }).format(v);

const UNIT: Record<ImpactResult['metric'], string> = { temperatureC: '°C', pm25: 'µg/m³' };
export const metricUnit = (m: ImpactResult['metric']) => UNIT[m];

/** Bar widths in percent of the largest value, so the longest bar fills the track. */
export function barWidths(values: number[]): number[] {
  const max = Math.max(...values.map(Math.abs), 0);
  return values.map((v) => (max ? Math.round((Math.abs(v) / max) * 100) : 0));
}

const change = (d: number, unit: string) =>
  Math.abs(d) < 0.05 ? 'gleich geblieben' : `um ${fmt(Math.abs(d))}\u00a0${unit} ${d < 0 ? 'gesunken' : 'gestiegen'}`;
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt(Math.abs(v))}`;

/**
 * Plain sentence for a mission's measured effect. The effect is the change at the station minus the
 * change across the city, so a city-wide cool spell doesn't count as the mission's success.
 */
export function effectSentence(i: ImpactResult): string {
  const unit = UNIT[i.metric];
  if (i.after == null || i.cityAfter == null) {
    return `Vorher: ${fmt(i.before)}\u00a0${unit} hier, ${fmt(i.cityBefore)}\u00a0${unit} im Stadtschnitt. Der Nachher-Wert wird noch gemessen.`;
  }
  const effect = i.effect ?? (i.after - i.before) - (i.cityAfter - i.cityBefore);
  if (Math.abs(effect) < 0.1) return 'Kein messbarer Unterschied zur Entwicklung in der ganzen Stadt.';
  return `Hier ${change(i.after - i.before, unit)}, in der ganzen Stadt ${change(i.cityAfter - i.cityBefore, unit)}. `
    + `Unterschied: ${signed(effect)}\u00a0${unit}.`;
}

/** "+1,2" / "−0,4" for table cells. */
export const signedFmt = signed;
