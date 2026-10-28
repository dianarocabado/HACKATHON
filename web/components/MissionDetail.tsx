'use client';
// One mission: "why this mission", claim (with name), support, mark as done and before/after impact.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MissionWithState } from '@contracts/types';
import { api } from '@/lib/client/api';
import { CATEGORY, EFFORT, WHO, evidenceText } from '@/lib/client/missions';
import { SimBadge, StatusChip, UrgencyDots } from './Badges';
import MissionActions from './MissionActions';
import { useLang } from './LangProvider';

export default function MissionDetail({ id }: { id: string }) {
  const { t, lang } = useLang();
  const [mission, setMission] = useState<MissionWithState | null | undefined>(undefined);

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

      <MissionActions mission={mission} onState={(s) => setMission({ ...mission, state: s })} />
    </article>
  );
}
