import type { MissionStatus } from '@contracts/types';
import { STATUS } from '@/lib/client/missions';

/** Required on anything with `simulated: true` (CLAUDE.md non-negotiable). */
export function SimBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 text-[0.75rem] font-medium"
      style={{ borderColor: 'var(--sim)', color: 'var(--sim)' }}
      title="Beispielwert, nicht gemessen"
    >
      simuliert
    </span>
  );
}

export function StatusChip({ status }: { status: MissionStatus }) {
  const filled = status === 'verified';
  const colour = status === 'open' ? 'var(--muted)' : status === 'claimed' ? 'var(--brand)' : 'var(--ok)';
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 text-[0.75rem] font-medium"
      style={{ borderColor: colour, color: filled ? 'var(--surface)' : colour, background: filled ? colour : 'transparent' }}
    >
      {STATUS[status]}
    </span>
  );
}

export function UrgencyDots({ urgency }: { urgency: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Dringlichkeit ${urgency} von 3`} role="img">
      {[1, 2, 3].map((i) => (
        <span key={i} className="h-2 w-2 rounded-full" style={{ background: i <= urgency ? 'var(--warn)' : 'var(--border)' }} />
      ))}
    </span>
  );
}
