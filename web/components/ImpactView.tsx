'use client';
// /wirkung: what the data says about heat, nights and cycling in Heilbronn.
import { useEffect, useState } from 'react';
import type { EvidenceFile } from '@contracts/types';
import { api } from '@/lib/client/api';
import EvidenceCard from './EvidenceCard';
import { useLang } from './LangProvider';

export default function ImpactView() {
  const { t } = useLang();
  const [data, setData] = useState<EvidenceFile | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { api.evidence().then(setData).catch(() => setError(true)); }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4">
      <h1 className="text-2xl font-semibold">{t('impact.title')}</h1>
      <p className="mt-1" style={{ color: 'var(--muted)' }}>{t('impact.lead')}</p>
      {error && <p className="mt-4">{t('impact.loadError')}</p>}
      {!data && !error && <p className="mt-4" aria-busy style={{ color: 'var(--muted)' }}>{t('impact.loading')}</p>}
      <ul className="mt-4 space-y-3">
        {data?.items.map((it) => <li key={it.id}><EvidenceCard item={it} /></li>)}
      </ul>
    </div>
  );
}
