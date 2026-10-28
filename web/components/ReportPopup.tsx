'use client';
// Card for one report marker on the map: category, summary, sensor check, when.
import { useEffect } from 'react';
import type { Report } from '@contracts/types';
import { locale } from '@/lib/client/i18n';
import { CATEGORY } from '@/lib/client/missions';
import { sensorSentence } from '@/lib/client/report';
import { useLang } from './LangProvider';

export default function ReportPopup({ report, onClose }: { report: Report; onClose: () => void }) {
  const { t, lang } = useLang();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const cat = CATEGORY[report.category];
  const when = new Intl.DateTimeFormat(locale(lang), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.createdAt));

  return (
    <section
      aria-label={t('reportPopup.aria')}
      className="absolute inset-x-0 bottom-0 z-10 rounded-t-2xl border p-4 shadow-lg md:inset-x-auto md:right-4 md:top-20 md:bottom-auto md:w-96 md:rounded-2xl"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[0.8125rem] font-medium"
          style={{ background: cat.colour, color: cat.ink }}
        >
          <span aria-hidden>{cat.icon}</span> {t(cat.label)}
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
      <p className="text-[1.0625rem]">{report.summary}</p>
      <p className="mt-2 border-l-4 pl-3 text-[0.9375rem]" style={{ borderColor: 'var(--border)' }}>
        {sensorSentence(report.sensorCheck, lang)}
      </p>
      <p className="mt-2 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
        {when}{report.placeHint ? ` · ${report.placeHint}` : ''}
      </p>
    </section>
  );
}
