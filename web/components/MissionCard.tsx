'use client';
import Link from 'next/link';
import type { MissionWithState } from '@contracts/types';
import { CATEGORY, EFFORT } from '@/lib/client/missions';
import { SimBadge, StatusChip, UrgencyDots } from './Badges';
import { useLang } from './LangProvider';

export default function MissionCard({ mission: m }: { mission: MissionWithState }) {
  const { t } = useLang();
  const cat = CATEGORY[m.category];
  return (
    <Link
      href={`/missions/${m.id}`}
      className="block rounded-2xl border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-xl">{cat.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[1.125rem] font-semibold leading-tight">{m.title}</h2>
            {m.simulated && <SimBadge />}
          </div>
          <p className="mt-1 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
            {t(cat.label)}{m.placeName ? ` · ${m.placeName}` : ''} · {t(EFFORT[m.effort])}
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
