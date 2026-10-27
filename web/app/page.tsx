import MapView from '@/components/MapView';

export default function Home() {
  return (
    <main className="flex h-dvh flex-col">
      <header
        className="flex h-14 shrink-0 items-center border-b px-4"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <h1 className="text-lg font-semibold">Heilbronn wirkt</h1>
      </header>
      <MapView />
    </main>
  );
}
