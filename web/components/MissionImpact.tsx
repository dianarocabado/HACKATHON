import type { ImpactResult } from '@contracts/types';
import { effectSentence, fmt, metricUnit, signedFmt } from '@/lib/client/impact';
import { SimBadge } from './Badges';

/** Before/after for one finished mission: the place vs. the whole city, as a small table. */
export default function MissionImpact({ impact }: { impact: ImpactResult }) {
  const unit = metricUnit(impact.metric);
  const rows = [
    { label: 'Hier', before: impact.before, after: impact.after },
    { label: 'Ganze Stadt', before: impact.cityBefore, after: impact.cityAfter },
  ];
  const cell = (v?: number) => (v == null ? '–' : `${fmt(v)}\u00a0${unit}`);
  return (
    <section className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-semibold">Hat es etwas gebracht?</h2>
        {impact.simulated && <SimBadge />}
      </div>
      <table className="w-full text-[0.9375rem] tabular-nums">
        <thead>
          <tr className="text-left text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
            <th className="font-normal" scope="col"><span className="sr-only">Ort</span></th>
            <th className="font-normal" scope="col">Vorher</th>
            <th className="font-normal" scope="col">Nachher</th>
            <th className="font-normal" scope="col">Änderung</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="py-1 text-left font-medium">{r.label}</th>
              <td>{cell(r.before)}</td>
              <td>{cell(r.after)}</td>
              <td>{r.after == null ? '–' : signedFmt(r.after - r.before)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3">{effectSentence(impact)}</p>
      <p className="mt-1 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
        Gemessen am Sensor „{impact.stationId}“, verglichen mit allen Sensoren der Stadt.
      </p>
    </section>
  );
}
