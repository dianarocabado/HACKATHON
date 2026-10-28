'use client';
// One mission: "why this mission", claim (with name), support, mark as done and before/after impact.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MissionWithState } from '@contracts/types';
import { api } from '@/lib/client/api';
import { CATEGORY, EFFORT, WHO, evidenceText } from '@/lib/client/missions';
import { SimBadge, StatusChip, UrgencyDots } from './Badges';
import MissionImpact from './MissionImpact';
import { useLang } from './LangProvider';

export default function MissionDetail({ id }: { id: string }) {
  const { t, lang } = useLang();
  const [mission, setMission] = useState<MissionWithState | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.missions().then((all) => setMission(all.find((m) => m.id === id) ?? null)).catch(() => setMission(null));
  }, [id]);

  if (mission === undefined) return <p className="p-4" aria-busy style={{ color: 'var(--muted)' }}>{t('mission.loading')}</p>;
  if (mission === null) {
    return (
      <div className="p-4">
        <p>{t('mission.notFound')}</p>
        <Link href="/missions" className="underline" style={{ color: 'var(--brand)' }}>{t('mission.toAll')}</Link>
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
      setMessage(t('mission.failed'));
    } finally {
      setBusy(false);
    }
  };

  const cat = CATEGORY[mission.category];
  const { state } = mission;

  return (
    <article className="mx-auto w-full max-w-2xl space-y-4 px-4 py-4">
      <Link href="/missions" className="inline-flex min-h-11 items-center text-[0.8125rem]" style={{ color: 'var(--brand)' }}>{t('mission.back')}</Link>
      <header>
        <p className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
          <span aria-hidden>{cat.icon}</span> {t(cat.label)}{mission.placeName ? ` · ${mission.placeName}` : ''}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{mission.title}</h1>
          {mission.simulated && <SimBadge />}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.8125rem]">
          <StatusChip status={state.status} />
          <UrgencyDots urgency={mission.urgency} />
          <span>{t(EFFORT[mission.effort])}</span>
          <span style={{ color: 'var(--muted)' }}>{t('mission.for', { list: mission.suitedFor.map((w) => t(WHO[w])).join(', ') })}</span>
        </div>
      </header>

      <p>{mission.description}</p>

      <section className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h2 className="mb-2 font-semibold">{t('mission.why')}</h2>
        <ul className="list-disc space-y-1 pl-5">
          {evidenceText(mission.reason.evidence, lang).map((e) => <li key={e}>{e}</li>)}
        </ul>
        <p className="mt-2 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
          {t('mission.rule')}: {mission.reason.rule} · {t(mission.source === 'report' ? 'mission.fromReports' : 'mission.fromSensors')}
        </p>
      </section>

      {state.claimedBy && <p>{t('mission.claimedBy')} <strong>{state.claimedBy}</strong>.</p>}

      {state.status === 'open' && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) act(() => api.claimMission(mission.id, name.trim()), t('mission.claimed')); }}
        >
          <label className="sr-only" htmlFor="claim-name">{t('mission.name')}</label>
          <input
            id="claim-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('mission.name')}
            className="min-h-11 flex-1 rounded-xl border px-3"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          />
          <button
            disabled={busy || !name.trim()}
            className="min-h-11 rounded-xl px-4 font-medium disabled:opacity-50"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            {t('mission.claim')}
          </button>
        </form>
      )}

      {state.status === 'claimed' && (
        <button
          onClick={() => act(() => api.doneMission(mission.id), t('mission.doneMsg'))}
          disabled={busy}
          className="min-h-11 w-full rounded-xl px-4 font-medium disabled:opacity-50"
          style={{ background: 'var(--ok)', color: 'var(--surface)' }}
        >
          {t('mission.markDone')}
        </button>
      )}

      {state.impact && <MissionImpact impact={state.impact} />}

      <button
        onClick={() => act(() => api.supportMission(mission.id), t('mission.supported'))}
        disabled={busy}
        className="min-h-11 w-full rounded-xl border px-4 font-medium disabled:opacity-50"
        style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}
      >
        {t('mission.support', { n: state.supporters })}
      </button>

      {message && <p role="status">{message}</p>}
    </article>
  );
}
