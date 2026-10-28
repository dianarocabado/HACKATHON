'use client';
// Claim (with name), mark as done, before/after impact and support. Shared by the mission page and the map sheet.
import { useId, useState } from 'react';
import type { MissionState, MissionWithState } from '@contracts/types';
import { api } from '@/lib/client/api';
import MissionImpact from './MissionImpact';
import { useLang } from './LangProvider';

export default function MissionActions({ mission, onState }: {
  mission: MissionWithState;
  onState: (state: MissionState) => void;
}) {
  const { t } = useLang();
  // Next keeps hidden pages mounted, so the mission page and the map sheet can both be in the DOM.
  const inputId = useId();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const act = async (fn: () => Promise<MissionState>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      onState(await fn());
      setMessage(done);
    } catch {
      setMessage(t('mission.failed'));
    } finally {
      setBusy(false);
    }
  };

  const { state } = mission;
  return (
    <>
      {state.claimedBy && <p>{t('mission.claimedBy')} <strong>{state.claimedBy}</strong>.</p>}

      {state.status === 'open' && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) act(() => api.claimMission(mission.id, name.trim()), t('mission.claimed')); }}
        >
          <label className="sr-only" htmlFor={inputId}>{t('mission.name')}</label>
          <input
            id={inputId}
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
    </>
  );
}
