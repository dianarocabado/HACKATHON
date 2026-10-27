import Link from 'next/link';
import type { Report } from '@contracts/types';
import { CATEGORY } from '@/lib/client/missions';
import { sensorSentence } from '@/lib/client/report';

export default function ReportResult({ report, onAnother }: { report: Report; onAnother: () => void }) {
  const cat = CATEGORY[report.category];
  const check = report.sensorCheck;
  const tone = check.status === 'confirmed' ? 'var(--ok)' : check.status === 'not_confirmed' ? 'var(--warn)' : 'var(--muted)';

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4" role="status">
      <h1 className="text-2xl font-semibold">Danke! Deine Meldung ist angekommen.</h1>

      <div className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <span
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[0.8125rem] font-medium"
          style={{ background: cat.colour, color: '#fff' }}
        >
          <span aria-hidden>{cat.icon}</span> {cat.label}
        </span>
        <p className="mt-3 text-[1.125rem]">{report.summary}</p>
        <p className="mt-3 border-l-4 pl-3" style={{ borderColor: tone }}>{sensorSentence(check)}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href="/"
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl font-medium"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          Zur Karte
        </Link>
        {check.status === 'no_sensor' && (
          <Link
            href="/missions"
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl border font-medium"
            style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}
          >
            Sensor-Missionen ansehen
          </Link>
        )}
        <button
          onClick={onAnother}
          className="min-h-11 flex-1 rounded-xl border font-medium"
          style={{ borderColor: 'var(--border)' }}
        >
          Noch etwas melden
        </button>
      </div>
    </div>
  );
}
