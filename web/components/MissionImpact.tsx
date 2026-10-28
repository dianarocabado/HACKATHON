'use client';
import type { ImpactResult } from '@contracts/types';
import { effectSentence, fmt, metricUnit, signedFmt } from '@/lib/client/impact';
import { SimBadge } from './Badges';
import { useLang } from './LangProvider';

/** Before/after for one finished mission: the place vs. the whole city, as a small table. */
export default function MissionImpact({ impact }: { impact: ImpactResult }) {
  const { t, lang } = useLang();
  const unit = metricUnit(impact.metric);
  const rows = [
    { label: t('missionImpact.here'), before: impact.before, after: impact.after },
    { label: t('missionImpact.city'), before: impact.cityBefore, after: impact.cityAfter },
  ];
  const cell = (v?: number) => (v == null ? '–' : `${fmt(v, 1, lang)}\u00a0${unit}`);
  return (
    <section className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-semibold">{t('missionImpact.title')}</h2>
        {impact.simulated && <SimBadge />}
      </div>
      <table className="w-full text-[0.9375rem] tabular-nums">
        <thead>
          <tr className="text-left text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
            <th className="font-normal" scope="col"><span className="sr-only">{t('missionImpact.place')}</span></th>
            <th className="font-normal" scope="col">{t('missionImpact.before')}</th>
            <th className="font-normal" scope="col">{t('missionImpact.after')}</th>
            <th className="font-normal" scope="col">{t('missionImpact.change')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="py-1 text-left font-medium">{r.label}</th>
              <td>{cell(r.before)}</td>
              <td>{cell(r.after)}</td>
              <td>{r.after == null ? '–' : signedFmt(r.after - r.before, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3">{effectSentence(impact, lang)}</p>
      <p className="mt-1 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
        {t('missionImpact.measured', { id: impact.stationId })}
      </p>
    </section>
  );
}
