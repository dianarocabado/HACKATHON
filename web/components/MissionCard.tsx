'use client';
import Link from 'next/link';
import type { MissionWithState } from '@contracts/types';
import { CATEGORY, EFFORT, missionText } from '@/lib/client/missions';
import { SimBadge, StatusChip, UrgencyDots } from './Badges';
import { CategoryTile } from './Icons';
import { useLang } from './LangProvider';

export default function MissionCard({ mission: m }: { mission: MissionWithState }) {
  const { t, lang } = useLang();
  const cat = CATEGORY[m.category];
  const text = missionText(m, lang);
  return (
    <Link
      href={`/missions/${m.id}`}
      className="block rounded-2xl border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start gap-3">
        <CategoryTile category={m.category} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[1.125rem] font-semibold leading-tight">{text.title}</h2>
            {m.simulated && <SimBadge />}
          </div>
          <p className="mt-1 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
            {t(cat.label)}{text.placeName ? ` · ${text.placeName}` : ''} · {t(EFFORT[m.effort])}
          </p>
          <div className="mt-2 flex items-center gap-3 text-[0.8125rem]">
            <StatusChip status={m.state.status} />
            <UrgencyDots urgency={m.urgency} />
            <span style={{ color: 'var(--muted)' }}>{t('missions.supporters', { n: m.state.supporters })}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
