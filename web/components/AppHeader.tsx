'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from '@/lib/client/session';
import { AppIcon, Icon } from './Icons';
import { LangToggle, useLang } from './LangProvider';

export default function AppHeader() {
  const { t } = useLang();
  const user = useSession();
  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <Link href="/" className="flex min-h-11 items-center gap-2 text-lg font-bold tracking-tight">
        <Image src="/logo.png" alt="" width={30} height={30} className="rounded-md" priority />
        HN Reacts
      </Link>
      <div className="flex items-center gap-1">
        <Link href="/wirkung" className="flex min-h-11 items-center px-2 font-medium" style={{ color: 'var(--brand)' }}>
          {t('header.impact')}
        </Link>
        <Link
          href="/profil"
          aria-label={user ? `${t('header.profile')}: ${user.name}` : t('header.profile')}
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={{ color: 'var(--brand)' }}
        >
          {user ? (
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full text-[0.9375rem] font-bold"
              style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          ) : (
            <Icon icon={AppIcon.profile} size={24} />
          )}
        </Link>
        <LangToggle />
      </div>
    </header>
  );
}
