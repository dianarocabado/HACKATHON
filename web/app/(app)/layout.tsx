import { Suspense } from 'react';
import AppHeader from '@/components/AppHeader';
import BottomNav, { NavShell } from '@/components/BottomNav';

// App shell for phone screens: header, page, bottom navigation. /screen and /qr live outside this group.
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex h-dvh flex-col">
      <AppHeader />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
      <Suspense fallback={<NavShell path={null} />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
