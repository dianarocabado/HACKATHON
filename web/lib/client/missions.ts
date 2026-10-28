// Label keys (see i18n.ts), filters and "why this mission" phrases for the missions UI.
import type { Category, Mission, MissionStatus, MissionWithState } from '@contracts/types';
import { locale, type Lang, type MessageKey } from './i18n.ts';

// `ink` is the text colour on `colour` with the higher WCAG contrast (all >= 4.5:1).
export const CATEGORY: Record<Category, { label: MessageKey; icon: string; colour: string; ink: string }> = {
  heat: { label: 'cat.heat', icon: '☀️', colour: '#E8702A', ink: '#000' },
  air: { label: 'cat.air', icon: '💨', colour: '#6172F3', ink: '#000' },
  noise: { label: 'cat.noise', icon: '🔊', colour: '#9E77ED', ink: '#000' },
  water: { label: 'cat.water', icon: '💧', colour: '#2E90FA', ink: '#000' },
  biodiversity: { label: 'cat.biodiversity', icon: '🐝', colour: '#1F7A4D', ink: '#fff' },
  waste: { label: 'cat.waste', icon: '🗑️', colour: '#7A5C3E', ink: '#fff' },
  mobility: { label: 'cat.mobility', icon: '🚲', colour: '#DD2590', ink: '#000' },
  other: { label: 'cat.other', icon: '📍', colour: '#5F675F', ink: '#fff' },
};

export const EFFORT: Record<Mission['effort'], MessageKey> = {
  hour: 'effort.hour',
  afternoon: 'effort.afternoon',
  project: 'effort.project',
};

export type Who = Mission['suitedFor'][number];
export const WHO: Record<Who, MessageKey> = {
  resident: 'who.resident',
  school: 'who.school',
  company: 'who.company',
  club: 'who.club',
  city: 'who.city',
};

export const STATUS: Record<MissionStatus, MessageKey> = {
  open: 'status.open',
  claimed: 'status.claimed',
  done: 'status.done',
  verified: 'status.verified',
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

type Phrase = (v: number, n: (x: number, digits?: number) => string) => string;

// Known evidence keys from pipeline/build_missions.py and report-created missions.
const EVIDENCE: Record<Lang, Record<string, Phrase>> = {
  de: {
    heat: (v, n) => `Hitzewert ${n(v, 2)} von 1`,
    tempAfternoonC: (v, n) => `nachmittags im Schnitt ${n(v, 1)} °C`,
    dryDays: (v, n) => `${n(v)} Tage ohne Regen`,
    trees: (v, n) => `${n(v)} Straßenbäume`,
    busStops: (v, n) => `${n(v)} ${v === 1 ? 'Haltestelle' : 'Haltestellen'}`,
    sensitivePlaces: (v, n) => `${n(v)} sensible Orte (Schule, Kita, Pflegeheim)`,
    distToGreenM: (v, n) => `nächstes Grün ${n(v)} m entfernt`,
    overtakeUnder150Pct: (v, n) => `${n(v)} % der Überholungen unter 1,5 m`,
    rides: (v, n) => `${n(v)} Messfahrten`,
    nearestStationDistM: (v, n) => `nächster Sensor ${n(v)} m entfernt`,
    reports: (v, n) => `${n(v)} Meldungen aus der Nachbarschaft`,
  },
  en: {
    heat: (v, n) => `heat score ${n(v, 2)} of 1`,
    tempAfternoonC: (v, n) => `afternoons average ${n(v, 1)} °C`,
    dryDays: (v, n) => `${n(v)} days without rain`,
    trees: (v, n) => `${n(v)} street trees`,
    busStops: (v, n) => `${n(v)} bus ${v === 1 ? 'stop' : 'stops'}`,
    sensitivePlaces: (v, n) => `${n(v)} sensitive places (school, nursery, care home)`,
    distToGreenM: (v, n) => `nearest green space ${n(v)} m away`,
    overtakeUnder150Pct: (v, n) => `${n(v)}% of overtakings closer than 1.5 m`,
    rides: (v, n) => `${n(v)} test rides`,
    nearestStationDistM: (v, n) => `nearest sensor ${n(v)} m away`,
    reports: (v, n) => `${n(v)} reports from the neighbourhood`,
  },
};

/** Evidence as short phrases; unknown keys fall back to "key: value". */
export function evidenceText(evidence: Record<string, number | string>, lang: Lang = 'de'): string[] {
  const n = (x: number, digits = 0) => new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(x);
  return Object.entries(evidence).map(([k, v]) =>
    typeof v === 'number' && EVIDENCE[lang][k] ? EVIDENCE[lang][k](v, n) : `${k}: ${v}`);
}
