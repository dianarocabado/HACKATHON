// Turns a hexagon's raw facts into short German sentences with a source line (see DESIGN.md "Plain German").
import type { HexCell, Station } from '@contracts/types';

export interface Fact { key: string; text: string; source: string }

const num = (v: number, digits = 1) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
const metres = (m: number) => (m >= 1000 ? `${num(m / 1000)} km` : `${Math.round(m / 10) * 10} m`);

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** City-wide medians the facts compare against. Compute once per layers file. */
export function cityMedians(cells: HexCell[]) {
  const pick = (f: (c: HexCell) => number | undefined) =>
    median(cells.map(f).filter((v): v is number => typeof v === 'number'));
  return { tempAfternoonC: pick((c) => c.facts.tempAfternoonC), pm25: pick((c) => c.facts.pm25) };
}

const WHO_PM25_DAILY = 15; // µg/m³, WHO 2021 24-hour guideline

export function describeCell(
  cell: HexCell,
  medians: ReturnType<typeof cityMedians>,
  stations: Station[],
): Fact[] {
  const f = cell.facts;
  const station = stations.find((s) => s.id === f.nearestStationId);
  const sensorSource = station
    ? `Sensor „${station.name}“${f.nearestStationDistM != null ? `, ${metres(f.nearestStationDistM)} entfernt` : ''}`
    : 'senseBox-Messnetz';
  const facts: Fact[] = [];

  if (f.tempAfternoonC != null) {
    const diff = medians.tempAfternoonC != null ? f.tempAfternoonC - medians.tempAfternoonC : 0;
    const cmp = Math.abs(diff) < 0.3 ? 'etwa so warm wie im Stadtschnitt'
      : `${num(Math.abs(diff))} °C ${diff > 0 ? 'über' : 'unter'} dem Stadtmedian`;
    facts.push({ key: 'temp', text: `Nachmittags hier im Schnitt ${num(f.tempAfternoonC)} °C, ${cmp}.`, source: sensorSource });
  }
  if (f.pm25 != null) {
    const who = f.pm25 > WHO_PM25_DAILY ? `über dem WHO-Tagesrichtwert von ${WHO_PM25_DAILY} µg/m³` : `unter dem WHO-Tagesrichtwert von ${WHO_PM25_DAILY} µg/m³`;
    facts.push({ key: 'pm25', text: `Feinstaub (PM2,5) im Schnitt ${num(f.pm25)} µg/m³, ${who}.`, source: sensorSource });
  }
  if (f.overtakeUnder150Pct != null) {
    facts.push({
      key: 'bike',
      text: `${Math.round(f.overtakeUnder150Pct)} % der Überholungen von Radfahrenden waren enger als die erlaubten 1,5 m.`,
      source: 'senseBox:bike, Messfahrten 2025–2026',
    });
  }
  if (f.distToGreenM != null) {
    facts.push({
      key: 'green',
      text: f.distToGreenM < 150 ? 'Eine Grünfläche ist gleich um die Ecke.' : `Die nächste Grünfläche ist ${metres(f.distToGreenM)} entfernt.`,
      source: 'OpenStreetMap',
    });
  }
  if (f.sensitivePlaces) {
    facts.push({
      key: 'sensitive',
      text: `${f.sensitivePlaces} ${f.sensitivePlaces === 1 ? 'sensibler Ort' : 'sensible Orte'} (Schule, Kita, Pflegeheim oder Spielplatz) liegen hier.`,
      source: 'OpenStreetMap',
    });
  }
  if (f.trees != null) {
    facts.push({ key: 'trees', text: f.trees ? `${f.trees} Straßenbäume stehen in diesem Feld.` : 'Hier steht kein erfasster Straßenbaum.', source: 'OpenStreetMap' });
  }
  if (f.nearestStationDistM != null && f.nearestStationDistM > 1000) {
    facts.push({ key: 'nosensor', text: `Kein Sensor in der Nähe – der nächste ist ${metres(f.nearestStationDistM)} weg.`, source: 'senseBox-Messnetz' });
  }
  return facts;
}
