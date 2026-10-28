'use client';
import Link from 'next/link';
import { LangToggle, useLang } from './LangProvider';

export default function AppHeader() {
  const { t } = useLang();
  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <Link href="/" className="flex min-h-11 items-center text-lg font-semibold">HN Reacts</Link>
      <div className="flex items-center gap-1">
        <Link href="/wirkung" className="flex min-h-11 items-center px-2 font-medium" style={{ color: 'var(--brand)' }}>
          {t('header.impact')}
        </Link>
        <LangToggle />
      </div>
    </header>
  );
}
