import { Suspense } from 'react';
import MissionDetail from '@/components/MissionDetail';

// Cache Components: params are runtime data, so read them inside Suspense.
export default function MissionPage({ params }: PageProps<'/missions/[id]'>) {
  return (
    <Suspense fallback={<p className="p-4">Lade Mission …</p>}>
      {params.then(({ id }) => <MissionDetail id={id} />)}
    </Suspense>
  );
}
