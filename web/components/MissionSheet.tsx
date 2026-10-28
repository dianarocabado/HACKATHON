'use client';
// Bottom sheet for a mission pin on the map: why, claim/support, link to the full mission page.
import Link from 'next/link';
import { useEffect } from 'react';
import type { MissionState, MissionWithState } from '@contracts/types';
import { CATEGORY, EFFORT, evidenceText, missionText } from '@/lib/client/missions';
import { SimBadge, StatusChip, UrgencyDots } from './Badges';
import { CategoryIcon } from './Icons';
import MissionActions from './MissionActions';
import { useLang } from './LangProvider';

export default function MissionSheet({ mission, onState, onClose }: {
  mission: MissionWithState;
  onState: (state: MissionState) => void;
  onClose: () => void;
}) {
  const { t, lang } = useLang();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const cat = CATEGORY[mission.category];
  const text = missionText(mission, lang);

  return (
    <section
      aria-label={t('missionSheet.aria')}
      className="absolute inset-x-0 bottom-0 z-10 max-h-[75%] space-y-3 overflow-y-auto rounded-t-2xl border p-4 shadow-lg md:inset-x-auto md:right-4 md:top-20 md:bottom-auto md:w-96 md:rounded-2xl"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[0.8125rem] font-medium"
          style={{ background: cat.colour, color: cat.ink }}
        >
          <CategoryIcon category={mission.category} /> {t(cat.label)}
        </span>
        <button
          onClick={onClose}
          aria-label={t('common.close')}
          className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-xl text-xl"
          style={{ color: 'var(--muted)' }}
        >
          ×
        </button>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">{text.title}</h2>
          {mission.simulated && <SimBadge />}
        </div>
        {text.placeName && <p className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>{text.placeName}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.8125rem]">
          <StatusChip status={mission.state.status} />
          <UrgencyDots urgency={mission.urgency} />
          <span>{t(EFFORT[mission.effort])}</span>
        </div>
      </div>

      <div>
        <h3 className="mb-1 font-medium">{t('mission.why')}</h3>
        <ul className="list-disc space-y-1 pl-5">
          {evidenceText(mission.reason.evidence, lang).map((e) => <li key={e}>{e}</li>)}
        </ul>
      </div>

      <MissionActions mission={mission} onState={onState} />

      <Link href={`/missions/${mission.id}`} className="inline-flex min-h-11 items-center underline" style={{ color: 'var(--brand)' }}>
        {t('missionSheet.more')}
      </Link>
    </section>
  );
}
