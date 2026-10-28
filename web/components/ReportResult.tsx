'use client';
import Link from 'next/link';
import type { Report } from '@contracts/types';
import { CATEGORY } from '@/lib/client/missions';
import { sensorSentence } from '@/lib/client/report';
import { useSession } from '@/lib/client/session';
import { CategoryIcon } from './Icons';
import { useLang } from './LangProvider';

export default function ReportResult({ report, onAnother }: { report: Report; onAnother: () => void }) {
  const { t, lang } = useLang();
  const user = useSession();
  const cat = CATEGORY[report.category];
  const check = report.sensorCheck;
  const tone = check.status === 'confirmed' ? 'var(--ok)' : check.status === 'not_confirmed' ? 'var(--warn)' : 'var(--muted)';

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4" role="status">
      <h1 className="text-2xl font-semibold">{t('report.thanks')}</h1>

      <div className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <span
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[0.8125rem] font-medium"
          style={{ background: cat.colour, color: cat.ink }}
        >
          <CategoryIcon category={report.category} /> {t(cat.label)}
        </span>
        <p className="mt-3 text-[1.125rem]">{report.summary}</p>
        <p className="mt-3 border-l-4 pl-3" style={{ borderColor: tone }}>{sensorSentence(check, lang)}</p>
      </div>

      {user ? (
        <p className="text-[0.9375rem]" style={{ color: 'var(--muted)' }}>{t('account.saved')}</p>
      ) : user === null ? (
        <p className="text-[0.9375rem]" style={{ color: 'var(--muted)' }}>
          <Link href="/profil" className="underline" style={{ color: 'var(--brand)' }}>{t('account.tip')}</Link>
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href="/"
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl font-medium"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          {t('report.toMap')}
        </Link>
        {check.status === 'no_sensor' && (
          <Link
            href="/missions"
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl border font-medium"
            style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}
          >
            {t('report.sensorMissions')}
          </Link>
        )}
        <button
          onClick={onAnother}
          className="min-h-11 flex-1 rounded-xl border font-medium"
          style={{ borderColor: 'var(--border)' }}
        >
          {t('report.another')}
        </button>
      </div>
    </div>
  );
}
