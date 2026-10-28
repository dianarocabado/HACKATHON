import { Suspense } from 'react';
import MissionDetail from '@/components/MissionDetail';

// Cache Components: params are runtime data, so read them inside Suspense.
export default function MissionPage({ params }: PageProps<'/missions/[id]'>) {
  return (
    <Suspense fallback={<div aria-busy className="m-4 h-40 animate-pulse rounded-2xl" style={{ background: 'var(--border)' }} />}>
      {params.then(({ id }) => <MissionDetail id={id} />)}
    </Suspense>
  );
}
