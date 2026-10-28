// Turns a hexagon's raw facts into short sentences with a source line (see DESIGN.md "Plain German"),
// in German (default) or English.
import type { HexCell, LayersFile, Station } from '@contracts/types';
import { locale, type Lang } from './i18n.ts';

export interface Fact { key: string; text: string; source: string }

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * City-wide medians the facts compare against. Compute once per layers file. The temperature is the
 * pipeline's median over the outdoor stations (the same one the heat score uses), not over cells.
 */
export function cityMedians(cells: HexCell[], city: Pick<LayersFile, 'cityTempAfternoonC' | 'cityTempStations'> = {}) {
  const pick = (f: (c: HexCell) => number | undefined) =>
    median(cells.map(f).filter((v): v is number => typeof v === 'number'));
  return {
    tempAfternoonC: city.cityTempAfternoonC ?? pick((c) => c.facts.tempAfternoonC),
    tempStations: city.cityTempAfternoonC != null ? city.cityTempStations : undefined,
    pm25: pick((c) => c.facts.pm25),
    surfaceRoughness: pick((c) => c.facts.surfaceRoughness),
  };
}

/** '17.07.–31.08.2026' / '17 Jul–31 Aug 2026' for two YYYY-MM-DD dates. */
export function period(from: string, to: string, lang: Lang = 'de'): string {
  const a = new Date(`${from}T00:00:00Z`), b = new Date(`${to}T00:00:00Z`);
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  const day = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
    timeZone: 'UTC', day: lang === 'de' ? '2-digit' : 'numeric', month: lang === 'de' ? '2-digit' : 'short',
  });
  const full = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
    timeZone: 'UTC', day: lang === 'de' ? '2-digit' : 'numeric', month: lang === 'de' ? '2-digit' : 'short', year: 'numeric',
  });
  return `${(sameYear ? day : full).format(a)}–${full.format(b)}`;
}

const WHO_PM25_DAILY = 15; // µg/m³, WHO 2021 24-hour guideline

export function describeCell(
  cell: HexCell,
  medians: ReturnType<typeof cityMedians>,
  stations: Station[],
  lang: Lang = 'de',
): Fact[] {
  const de = lang === 'de';
  const num = (v: number, digits = 1) =>
    new Intl.NumberFormat(locale(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
  const metres = (m: number) => (m >= 1000 ? `${num(m / 1000)} km` : `${Math.round(m / 10) * 10} m`);

  const f = cell.facts;
  const station = stations.find((s) => s.id === f.nearestStationId);
  const dist = f.nearestStationDistM != null ? `, ${metres(f.nearestStationDistM)} ${de ? 'entfernt' : 'away'}` : '';
  const network = de ? 'senseBox-Messnetz' : 'senseBox network';
  const sensorSource = station ? (de ? `Sensor „${station.name}“${dist}` : `Sensor “${station.name}”${dist}`) : network;
  const facts: Fact[] = [];

  if (f.tempAfternoonC != null) {
    const diff = medians.tempAfternoonC != null ? f.tempAfternoonC - medians.tempAfternoonC : 0;
    const n = medians.tempStations;
    const city = n ? (de ? `dem Median der ${n} Stadtsensoren` : `the median of the city's ${n} sensors`)
      : de ? 'dem Stadtmedian' : 'the city median';
    const cmp = Math.abs(diff) < 0.3
      ? de ? (n ? `etwa so warm wie der Median der ${n} Stadtsensoren` : 'etwa so warm wie im Stadtschnitt')
        : n ? `about as warm as ${city}` : 'about as warm as the city average'
      : de ? `${num(Math.abs(diff))} °C ${diff > 0 ? 'über' : 'unter'} ${city}`
        : `${num(Math.abs(diff))} °C ${diff > 0 ? 'above' : 'below'} ${city}`;
    // Stations started at different times, so the mean is only meaningful with its period.
    const when = f.tempFrom && f.tempTo ? ` · ${period(f.tempFrom, f.tempTo, lang)}` : '';
    facts.push({
      key: 'temp',
      text: de ? `Sommernachmittags hier im Schnitt ${num(f.tempAfternoonC)} °C, ${cmp}.`
        : `Summer afternoons here average ${num(f.tempAfternoonC)} °C, ${cmp}.`,
      source: sensorSource + when,
    });
  }
  // Measured on foot right here, so it comes before the station-based facts that follow.
  if (f.heatWalkAnomalyC != null) {
    const a = f.heatWalkAnomalyC;
    const cmp = Math.abs(a) < 0.1
      ? (de ? 'etwa so warm wie der Rest der Route' : 'about as warm as the rest of the route')
      : de ? `${num(Math.abs(a))} °C ${a > 0 ? 'wärmer' : 'kühler'} als der Rest der Route`
        : `${num(Math.abs(a))} °C ${a > 0 ? 'warmer' : 'cooler'} than the rest of the route`;
    facts.push({
      key: 'heatwalk',
      text: de ? `Auf dem Hitzespaziergang im September gemessen: ${cmp}.` : `Measured on the heat walk in September: ${cmp}.`,
      source: de ? 'Hitzespaziergang Green City Summerschool, 1.–3. September 2026'
        : 'Green City Summer School heat walk, 1–3 September 2026',
    });
  }
  if (f.pm25 != null) {
    const above = f.pm25 > WHO_PM25_DAILY;
    const who = de ? `${above ? 'über' : 'unter'} dem WHO-Tagesrichtwert von ${WHO_PM25_DAILY} µg/m³`
      : `${above ? 'above' : 'below'} the WHO daily guideline of ${WHO_PM25_DAILY} µg/m³`;
    facts.push({
      key: 'pm25',
      text: de ? `Feinstaub (PM2,5) im Schnitt ${num(f.pm25)} µg/m³, ${who}.` : `Fine dust (PM2.5) averages ${num(f.pm25)} µg/m³, ${who}.`,
      source: sensorSource,
    });
  }
  if (f.overtakeUnder150Pct != null) {
    const pct = Math.round(f.overtakeUnder150Pct);
    facts.push({
      key: 'bike',
      text: de ? `${pct} % der Überholungen von Radfahrenden waren enger als die erlaubten 1,5 m.`
        : `${pct}% of cars overtaking cyclists passed closer than the legal 1.5 m.`,
      source: de ? 'senseBox:bike, Messfahrten 2025–2026' : 'senseBox:bike, test rides 2025–2026',
    });
  }
  if (f.surfaceRoughness != null) {
    const r = f.surfaceRoughness;
    const m = medians.surfaceRoughness;
    const ratio = m ? r / m : 1;
    const cmp = ratio >= 1.25 ? (de ? 'holpriger als im Stadtschnitt' : 'bumpier than the city average')
      : ratio <= 0.8 ? (de ? 'glatter als im Stadtschnitt' : 'smoother than the city average')
        : (de ? 'etwa wie im Stadtschnitt' : 'about the city average');
    facts.push({
      key: 'rough',
      text: de ? `Die Wege sind hier ${cmp} (Rauheit ${r} von 100${m != null ? `, Stadtmedian ${Math.round(m)}` : ''}).`
        : `Paths here are ${cmp} (roughness ${r} of 100${m != null ? `, city median ${Math.round(m)}` : ''}).`,
      source: de ? 'senseBox:bike, Erschütterungen bei Messfahrten' : 'senseBox:bike, vibration on test rides',
    });
  }
  if (f.distToGreenM != null) {
    const near = f.distToGreenM < 150;
    facts.push({
      key: 'green',
      text: de ? (near ? 'Eine Grünfläche ist gleich um die Ecke.' : `Die nächste Grünfläche ist ${metres(f.distToGreenM)} entfernt.`)
        : (near ? 'There is a green space just around the corner.' : `The nearest green space is ${metres(f.distToGreenM)} away.`),
      source: 'OpenStreetMap',
    });
  }
  if (f.sensitivePlaces) {
    const n = f.sensitivePlaces;
    facts.push({
      key: 'sensitive',
      text: de ? `${n} ${n === 1 ? 'sensibler Ort' : 'sensible Orte'} (Schule, Kita, Pflegeheim oder Spielplatz) liegen hier.`
        : `${n} sensitive ${n === 1 ? 'place' : 'places'} (school, nursery, care home or playground) ${n === 1 ? 'is' : 'are'} here.`,
      source: 'OpenStreetMap',
    });
  }
  if (f.trees != null) {
    facts.push({
      key: 'trees',
      text: de
        ? (f.trees === 1 ? '1 Straßenbaum steht in diesem Feld.'
          : f.trees ? `${f.trees} Straßenbäume stehen in diesem Feld.` : 'Hier steht kein erfasster Straßenbaum.')
        : (f.trees === 1 ? '1 street tree stands in this area.'
          : f.trees ? `${f.trees} street trees stand in this area.` : 'No recorded street tree here.'),
      source: 'OpenStreetMap',
    });
  }
  if (f.nearestStationDistM != null && f.nearestStationDistM > 1000) {
    facts.push({
      key: 'nosensor',
      text: de ? `Kein Sensor in der Nähe – der nächste ist ${metres(f.nearestStationDistM)} weg.`
        : `No sensor nearby – the closest one is ${metres(f.nearestStationDistM)} away.`,
      source: network,
    });
  }
  return facts;
}
