import Link from 'next/link';
import { Suspense } from 'react';
import BottomNav, { NavShell } from '@/components/BottomNav';

// App shell for phone screens: header, page, bottom navigation. /screen and /qr live outside this group.
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex h-dvh flex-col">
      <header
        className="flex h-14 shrink-0 items-center justify-between border-b px-4"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <Link href="/" className="text-lg font-semibold">Heilbronn wirkt</Link>
        <Link href="/wirkung" className="flex min-h-11 items-center px-2 font-medium" style={{ color: 'var(--brand)' }}>
          Wirkung
        </Link>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
      <Suspense fallback={<NavShell path={null} />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
