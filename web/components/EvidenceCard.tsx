'use client';
import type { EvidenceItem } from '@contracts/types';
import { fmt } from '@/lib/client/impact';
import Bars from './Bars';
import { useLang } from './LangProvider';

// Evidence from real data (A13): never badged as simulated; caveats and inconclusive results are shown openly.
export default function EvidenceCard({ item }: { item: EvidenceItem }) {
  const { t } = useLang();
  return (
    <article className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <h2 className="font-semibold">{item.title}</h2>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-[2rem] font-bold leading-none tabular-nums" style={{ color: item.conclusive ? 'var(--text)' : 'var(--muted)' }}>
          {item.value > 0 && item.unit === '°C' ? '+' : ''}{fmt(item.value)}
        </span>
        <span style={{ color: 'var(--muted)' }}>{item.unit}</span>
        {!item.conclusive && (
          <span className="rounded-full border px-2 text-[0.75rem]" style={{ borderColor: 'var(--muted)', color: 'var(--muted)' }}>
            {t('evidence.noEffect')}
          </span>
        )}
      </p>
      <p className="mt-2">{item.finding}</p>

      {item.compare && item.compare.length > 1 && (
        <div className="mt-3"><Bars items={item.compare} unit={item.unit} label={item.title} /></div>
      )}

      <p className="mt-3 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
        {item.ci95 && <>{t('evidence.ci')} {fmt(item.ci95[0])}–{fmt(item.ci95[1])}&nbsp;{item.unit} · </>}
        n = {fmt(item.n, 0)} {item.nLabel}
      </p>
      {item.caveat && (
        <p className="mt-2 border-l-4 pl-3 text-[0.8125rem]" style={{ borderColor: 'var(--warn)' }}>
          {t('evidence.caveat')}: {item.caveat}
        </p>
      )}
      <details className="mt-2 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
        <summary className="cursor-pointer">{t('evidence.sourceMethod')}</summary>
        <p className="mt-1">{item.source}</p>
        <p className="mt-1">{item.method}</p>
      </details>
    </article>
  );
}
