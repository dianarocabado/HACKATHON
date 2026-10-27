'use client';
// /qr: one printable A4 poster per demo place. The QR points at the live app, never at localhost.
import { useEffect, useState } from 'react';
import { DEMO_PLACES, reportPath } from '@/lib/client/places';
import QrCode from './QrCode';

// Set NEXT_PUBLIC_SITE_URL to the deployed URL so posters printed from a laptop still point to the live app.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');

const STEPS = ['QR-Code scannen', 'Sagen, was dir hier auffällt', 'Sehen, was der Sensor misst'];

export default function QrPosters() {
  const [origin, setOrigin] = useState(SITE_URL ?? '');
  // window is only available after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!SITE_URL) setOrigin(window.location.origin); }, []);
  const local = /localhost|127\.0\.0\.1/.test(origin);

  return (
    <div className="qr-sheet">
      <div className="qr-toolbar mx-auto flex max-w-[210mm] flex-wrap items-center gap-3 p-4">
        <button
          onClick={() => window.print()}
          className="min-h-11 rounded-xl px-4 font-semibold"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          Plakate drucken
        </button>
        {local && (
          <p role="alert" className="text-[0.9375rem]" style={{ color: 'var(--warn)' }}>
            Die QR-Codes zeigen auf {origin}. Zum Drucken die Live-URL öffnen oder NEXT_PUBLIC_SITE_URL setzen.
          </p>
        )}
      </div>

      {origin && DEMO_PLACES.map((p) => {
        const url = origin + reportPath(p);
        return (
          <section key={p.id} className="qr-poster mx-auto mb-6 flex max-w-[210mm] flex-col items-center gap-6 border bg-white p-12 text-center text-black">
            <p className="text-xl font-semibold" style={{ color: '#1F7A4D' }}>Heilbronn wirkt</p>
            <h1 className="text-5xl font-bold leading-tight">Was fällt dir hier auf?</h1>
            <p className="text-3xl">📍 {p.name}</p>
            <QrCode value={url} size={340} label={`QR-Code zum Melden an ${p.name}`} />
            <ol className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-xl">
              {STEPS.map((s, i) => <li key={s}><strong>{i + 1}.</strong> {s}</li>)}
            </ol>
            <p className="text-lg">Hitze, Luft, Lärm, Müll oder zu knapp überholende Autos – per Stimme, in einer Minute.</p>
            <p className="break-all text-sm text-gray-600">{url}</p>
          </section>
        );
      })}
    </div>
  );
}
