'use client';
import type { MissionStatus } from '@contracts/types';
import { STATUS } from '@/lib/client/missions';
import { useLang } from './LangProvider';

/** Required on anything with `simulated: true` (CLAUDE.md non-negotiable). */
export function SimBadge() {
  const { t } = useLang();
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 text-[0.75rem] font-medium"
      style={{ borderColor: 'var(--sim)', color: 'var(--sim)' }}
      title={t('common.simulatedTitle')}
    >
      {t('common.simulated')}
    </span>
  );
}

export function StatusChip({ status }: { status: MissionStatus }) {
  const { t } = useLang();
  const filled = status === 'verified';
  const colour = status === 'open' ? 'var(--muted)' : status === 'claimed' ? 'var(--brand)' : 'var(--ok)';
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 text-[0.75rem] font-medium"
      style={{ borderColor: colour, color: filled ? 'var(--surface)' : colour, background: filled ? colour : 'transparent' }}
    >
      {t(STATUS[status])}
    </span>
  );
}

export function UrgencyDots({ urgency }: { urgency: 1 | 2 | 3 }) {
  const { t } = useLang();
  return (
    <span className="inline-flex gap-0.5" aria-label={t('common.urgency', { n: urgency })} role="img">
      {[1, 2, 3].map((i) => (
        <span key={i} className="h-2 w-2 rounded-full" style={{ background: i <= urgency ? 'var(--warn)' : 'var(--border)' }} />
      ))}
    </span>
  );
}
