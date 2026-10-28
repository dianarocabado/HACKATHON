// Number formatting and sentences for the impact view (evidence cards, mission before/after).
import type { ImpactResult } from '@contracts/types';
import { locale, type Lang } from './i18n.ts';

const NBSP = String.fromCharCode(160); // keeps number and unit on one line

export const fmt = (v: number, digits = 1, lang: Lang = 'de') =>
  new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(v);

const UNIT: Record<ImpactResult['metric'], string> = { temperatureC: '°C', pm25: 'µg/m³' };
export const metricUnit = (m: ImpactResult['metric']) => UNIT[m];

/** Bar widths in percent of the largest value, so the longest bar fills the track. */
export function barWidths(values: number[]): number[] {
  const max = Math.max(...values.map(Math.abs), 0);
  return values.map((v) => (max ? Math.round((Math.abs(v) / max) * 100) : 0));
}

/** "+1,2" / "−0,4" for table cells. */
export const signedFmt = (v: number, lang: Lang = 'de') => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt(Math.abs(v), 1, lang)}`;

/**
 * Plain sentence for a mission's measured effect. The effect is the change at the station minus the
 * change across the city, so a city-wide cool spell doesn't count as the mission's success.
 */
export function effectSentence(i: ImpactResult, lang: Lang = 'de'): string {
  const de = lang === 'de';
  const unit = UNIT[i.metric];
  const v = (x: number) => `${fmt(x, 1, lang)}${NBSP}${unit}`;
  const change = (d: number) => (Math.abs(d) < 0.05 ? (de ? 'gleich geblieben' : 'unchanged')
    : de ? `um ${v(Math.abs(d))} ${d < 0 ? 'gesunken' : 'gestiegen'}` : `${d < 0 ? 'down' : 'up'} ${v(Math.abs(d))}`);
  if (i.after == null || i.cityAfter == null) {
    return de ? `Vorher: ${v(i.before)} hier, ${v(i.cityBefore)} im Stadtschnitt. Der Nachher-Wert wird noch gemessen.`
      : `Before: ${v(i.before)} here, ${v(i.cityBefore)} city average. The after value is still being measured.`;
  }
  const effect = i.effect ?? (i.after - i.before) - (i.cityAfter - i.cityBefore);
  if (Math.abs(effect) < 0.1) {
    return de ? 'Kein messbarer Unterschied zur Entwicklung in der ganzen Stadt.' : 'No measurable difference from the trend across the city.';
  }
  return de ? `Hier ${change(i.after - i.before)}, in der ganzen Stadt ${change(i.cityAfter - i.cityBefore)}. Unterschied: ${signedFmt(effect, lang)}${NBSP}${unit}.`
    : `Here ${change(i.after - i.before)}, across the city ${change(i.cityAfter - i.cityBefore)}. Difference: ${signedFmt(effect, lang)}${NBSP}${unit}.`;
}
