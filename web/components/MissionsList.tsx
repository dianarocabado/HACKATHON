'use client';
// Missions list with topic / who / effort filters.
import { useEffect, useMemo, useState } from 'react';
import type { Category, Mission, MissionWithState } from '@contracts/types';
import { api } from '@/lib/client/api';
import { CATEGORY, EFFORT, WHO, filterMissions, type MissionFilter, type Who } from '@/lib/client/missions';
import MissionCard from './MissionCard';

function FilterSelect<T extends string>({
  label, value, options, onChange,
}: { label: string; value?: T; options: Record<T, string>; onChange: (v?: T) => void }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
      {label}
      <select
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}
        className="mt-1 min-h-11 rounded-xl border px-2 text-[0.9375rem]"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
      >
        <option value="">Alle</option>
        {(Object.entries(options) as [T, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </label>
  );
}

const TOPICS = Object.fromEntries(Object.entries(CATEGORY).map(([k, v]) => [k, v.label])) as Record<Category, string>;

export default function MissionsList() {
  const [missions, setMissions] = useState<MissionWithState[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<MissionFilter>({});

  useEffect(() => { api.missions().then(setMissions).catch(() => setError(true)); }, []);
  const shown = useMemo(() => filterMissions(missions ?? [], filter), [missions, filter]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4">
      <h1 className="mb-3 text-2xl font-semibold">Missionen</h1>
      <div className="mb-4 flex gap-2">
        <FilterSelect label="Thema" value={filter.category} options={TOPICS} onChange={(category) => setFilter({ ...filter, category })} />
        <FilterSelect<Who> label="Für wen" value={filter.who} options={WHO} onChange={(who) => setFilter({ ...filter, who })} />
        <FilterSelect<Mission['effort']> label="Aufwand" value={filter.effort} options={EFFORT} onChange={(effort) => setFilter({ ...filter, effort })} />
      </div>

      {error && <p>Die Missionen laden gerade nicht. Bitte später nochmal versuchen.</p>}
      {!missions && !error && <p aria-busy style={{ color: 'var(--muted)' }}>Lade Missionen …</p>}
      {missions && shown.length === 0 && <p style={{ color: 'var(--muted)' }}>Keine Mission passt zu diesen Filtern.</p>}
      <ul className="space-y-3">
        {shown.map((m) => <li key={m.id}><MissionCard mission={m} /></li>)}
      </ul>
    </div>
  );
}
