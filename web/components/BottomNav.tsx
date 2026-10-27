'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MessageKey } from '@/lib/client/i18n';
import { useLang } from './LangProvider';

const ITEMS: { href: string; label: MessageKey; icon: string; primary?: boolean }[] = [
  { href: '/', label: 'nav.map', icon: '🗺️' },
  { href: '/report', label: 'nav.report', icon: '🎤', primary: true },
  { href: '/missions', label: 'nav.missions', icon: '✅' },
];

/** Static nav; `path` null renders without an active item (Suspense fallback on dynamic routes). */
export function NavShell({ path }: { path: string | null }) {
  const { t } = useLang();
  return (
    <nav
      aria-label={t('nav.main')}
      className="flex shrink-0 items-stretch justify-around border-t"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {ITEMS.map((it) => {
        const active = path != null && (it.href === '/' ? path === '/' : path.startsWith(it.href));
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? 'page' : undefined}
            className="flex min-h-14 flex-1 flex-col items-center justify-center text-[0.8125rem]"
            style={{ color: active ? 'var(--brand)' : 'var(--muted)', fontWeight: active ? 600 : 400 }}
          >
            {it.primary ? (
              <span
                aria-hidden
                className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-md"
                style={{ background: 'var(--brand)' }}
              >
                {it.icon}
              </span>
            ) : (
              <span aria-hidden className="text-lg">{it.icon}</span>
            )}
            {t(it.label)}
          </Link>
        );
      })}
    </nav>
  );
}

export default function BottomNav() {
  return <NavShell path={usePathname()} />;
}
