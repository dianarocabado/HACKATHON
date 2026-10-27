'use client';
// One mission: "why this mission", claim (with name) and support.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MissionWithState } from '@contracts/types';
import { api } from '@/lib/client/api';
import { CATEGORY, EFFORT, WHO, evidenceText } from '@/lib/client/missions';
import { SimBadge, StatusChip, UrgencyDots } from './Badges';

export default function MissionDetail({ id }: { id: string }) {
  const [mission, setMission] = useState<MissionWithState | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.missions().then((all) => setMission(all.find((m) => m.id === id) ?? null)).catch(() => setMission(null));
  }, [id]);

  if (mission === undefined) return <p className="p-4" aria-busy style={{ color: 'var(--muted)' }}>Lade Mission …</p>;
  if (mission === null) {
    return (
      <div className="p-4">
        <p>Diese Mission gibt es nicht (mehr).</p>
        <Link href="/missions" className="underline" style={{ color: 'var(--brand)' }}>Zu allen Missionen</Link>
      </div>
    );
  }

  const act = async (fn: () => ReturnType<typeof api.supportMission>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const state = await fn();
      setMission({ ...mission, state });
      setMessage(done);
    } catch {
      setMessage('Das hat nicht geklappt. Bitte nochmal versuchen.');
    } finally {
      setBusy(false);
    }
  };

  const cat = CATEGORY[mission.category];
  const { state } = mission;

  return (
    <article className="mx-auto w-full max-w-2xl space-y-4 px-4 py-4">
      <Link href="/missions" className="text-[0.8125rem]" style={{ color: 'var(--brand)' }}>← Alle Missionen</Link>
      <header>
        <p className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
          <span aria-hidden>{cat.icon}</span> {cat.label}{mission.placeName ? ` · ${mission.placeName}` : ''}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{mission.title}</h1>
          {mission.simulated && <SimBadge />}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.8125rem]">
          <StatusChip status={state.status} />
          <UrgencyDots urgency={mission.urgency} />
          <span>{EFFORT[mission.effort]}</span>
          <span style={{ color: 'var(--muted)' }}>Für {mission.suitedFor.map((w) => WHO[w]).join(', ')}</span>
        </div>
      </header>

      <p>{mission.description}</p>

      <section className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h2 className="mb-2 font-semibold">Warum diese Mission?</h2>
        <ul className="list-disc space-y-1 pl-5">
          {evidenceText(mission.reason.evidence).map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p className="mt-2 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
          Regel: {mission.reason.rule} · {mission.source === 'report' ? 'aus Meldungen' : 'aus Sensordaten'}
        </p>
      </section>

      {state.claimedBy && <p>Übernommen von <strong>{state.claimedBy}</strong>.</p>}

      {state.status === 'open' && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) act(() => api.claimMission(mission.id, name.trim()), 'Danke! Die Mission ist jetzt deine.'); }}
        >
          <label className="sr-only" htmlFor="claim-name">Dein Name oder Verein</label>
          <input
            id="claim-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dein Name oder Verein"
            className="min-h-11 flex-1 rounded-xl border px-3"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          />
          <button
            disabled={busy || !name.trim()}
            className="min-h-11 rounded-xl px-4 font-medium disabled:opacity-50"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            Mission übernehmen
          </button>
        </form>
      )}

      <button
        onClick={() => act(() => api.supportMission(mission.id), 'Danke für deine Unterstützung!')}
        disabled={busy}
        className="min-h-11 w-full rounded-xl border px-4 font-medium disabled:opacity-50"
        style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}
      >
        +1 Unterstützen ({state.supporters})
      </button>

      {message && <p role="status">{message}</p>}
    </article>
  );
}
