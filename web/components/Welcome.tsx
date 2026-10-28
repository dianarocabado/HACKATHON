'use client';
// First-visit intro over the map: the idea in one sentence and three steps.
import Link from 'next/link';
import { useEffect } from 'react';
import type { MessageKey } from '@/lib/client/i18n';
import { useLang } from './LangProvider';

export const WELCOME_KEY = 'hw-welcome-seen';

const STEPS: { icon: string; title: MessageKey; text: MessageKey }[] = [
  { icon: '🗺️', title: 'welcome.step1', text: 'welcome.step1Text' },
  { icon: '🎤', title: 'welcome.step2', text: 'welcome.step2Text' },
  { icon: '✅', title: 'welcome.step3', text: 'welcome.step3Text' },
];

export default function Welcome({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center p-4 md:items-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl p-6 shadow-xl"
        style={{ background: 'var(--surface)' }}
      >
        <h2 id="welcome-title" className="text-2xl font-bold">HN Reacts</h2>
        <p className="mt-2 text-[1.0625rem]">{t('welcome.lead')}</p>
        <ol className="mt-5 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                style={{ background: 'var(--bg)' }}
              >
                {s.icon}
              </span>
              <div>
                <h3 className="font-semibold">{i + 1}. {t(s.title)}</h3>
                <p className="text-[0.9375rem]" style={{ color: 'var(--muted)' }}>{t(s.text)}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={onClose}
            autoFocus
            className="min-h-12 rounded-xl font-semibold"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            {t('welcome.go')}
          </button>
          <Link
            href="/report"
            onClick={onClose}
            className="flex min-h-11 items-center justify-center rounded-xl border font-medium"
            style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}
          >
            {t('welcome.report')}
          </Link>
        </div>
      </section>
    </div>
  );
}
