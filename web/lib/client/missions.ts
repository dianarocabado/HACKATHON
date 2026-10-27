// Labels, filters and "why this mission" sentences for the missions UI.
import type { Category, Mission, MissionStatus, MissionWithState } from '@contracts/types';

export const CATEGORY: Record<Category, { label: string; icon: string; colour: string }> = {
  heat: { label: 'Hitze', icon: '☀️', colour: '#E8702A' },
  air: { label: 'Luft', icon: '💨', colour: '#6172F3' },
  noise: { label: 'Lärm', icon: '🔊', colour: '#9E77ED' },
  water: { label: 'Wasser', icon: '💧', colour: '#2E90FA' },
  biodiversity: { label: 'Natur', icon: '🐝', colour: '#1F7A4D' },
  waste: { label: 'Müll', icon: '🗑️', colour: '#7A5C3E' },
  mobility: { label: 'Verkehr', icon: '🚲', colour: '#DD2590' },
  other: { label: 'Sonstiges', icon: '📍', colour: '#5F675F' },
};

export const EFFORT: Record<Mission['effort'], string> = {
  hour: '1 Stunde',
  afternoon: 'Ein Nachmittag',
  project: 'Projekt',
};

export type Who = Mission['suitedFor'][number];
export const WHO: Record<Who, string> = {
  resident: 'Anwohnende',
  school: 'Schulen',
  company: 'Firmen',
  club: 'Vereine',
  city: 'Stadt',
};

export const STATUS: Record<MissionStatus, string> = {
  open: 'Offen',
  claimed: 'Übernommen',
  done: 'Erledigt',
  verified: 'Bestätigt',
};

export interface MissionFilter { category?: Category; who?: Who; effort?: Mission['effort'] }

const STATUS_ORDER: MissionStatus[] = ['open', 'claimed', 'done', 'verified'];

/** Matching missions, open ones first, then by urgency (high first). */
export function filterMissions(missions: MissionWithState[], f: MissionFilter): MissionWithState[] {
  return missions
    .filter((m) => (!f.category || m.category === f.category)
      && (!f.who || m.suitedFor.includes(f.who))
      && (!f.effort || m.effort === f.effort))
    .sort((a, b) => STATUS_ORDER.indexOf(a.state.status) - STATUS_ORDER.indexOf(b.state.status) || b.urgency - a.urgency);
}

const fmt = (v: number, digits = 0) =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits }).format(v);

// Known evidence keys from pipeline/build_missions.py and report-created missions.
const EVIDENCE: Record<string, (v: number) => string> = {
  heat: (v) => `Hitzewert ${fmt(v, 2)} von 1`,
  tempAfternoonC: (v) => `nachmittags im Schnitt ${fmt(v, 1)} °C`,
  dryDays: (v) => `${fmt(v)} Tage ohne Regen`,
  trees: (v) => `${fmt(v)} Straßenbäume`,
  busStops: (v) => `${fmt(v)} ${v === 1 ? 'Haltestelle' : 'Haltestellen'}`,
  sensitivePlaces: (v) => `${fmt(v)} sensible Orte (Schule, Kita, Pflegeheim)`,
  distToGreenM: (v) => `nächstes Grün ${fmt(v)} m entfernt`,
  overtakeUnder150Pct: (v) => `${fmt(v)} % der Überholungen unter 1,5 m`,
  rides: (v) => `${fmt(v)} Messfahrten`,
  nearestStationDistM: (v) => `nächster Sensor ${fmt(v)} m entfernt`,
  reports: (v) => `${fmt(v)} Meldungen aus der Nachbarschaft`,
};

/** Evidence as short German phrases; unknown keys fall back to "key: value". */
export function evidenceText(evidence: Record<string, number | string>): string[] {
  return Object.entries(evidence).map(([k, v]) =>
    typeof v === 'number' && EVIDENCE[k] ? EVIDENCE[k](v) : `${k}: ${v}`);
}
