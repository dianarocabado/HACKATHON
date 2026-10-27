'use client';
// /screen: full-screen need map, live report dots (new ones pulse), counters, latest report and a QR code.
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import type { LayersFile, MissionWithState, Report } from '@contracts/types';
import { api } from '@/lib/client/api';
import { CATEGORY } from '@/lib/client/missions';
import type { MapMarker } from './HexMap';
import { useLang } from './LangProvider';
import Legend from './Legend';
import QrCode from './QrCode';

const HexMap = dynamic(() => import('./HexMap'), { ssr: false });

const POLL_REPORTS_MS = 5000;
const POLL_MISSIONS_MS = 15000;
const FRESH_MS = 60_000;

export default function BigScreen() {
  const { t } = useLang();
  const [layers, setLayers] = useState<LayersFile | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [missions, setMissions] = useState<MissionWithState[]>([]);
  // When each report first reached this screen, so only genuinely new ones pulse.
  const [arrived, setArrived] = useState<Record<string, number>>({});
  const [now, setNow] = useState(0); // set by the 1 s tick; Date.now() is not allowed during prerender
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    // window is only available after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
    api.layers().then(setLayers).catch(() => {});

    let since: string | undefined;
    // Reports from the first successful poll are history and don't pulse, even if that poll was empty.
    let first = true;
    const pollReports = () => api.reports(since).then((fresh) => {
      const t = first ? 0 : Date.now();
      first = false;
      if (!fresh.length) return;
      since = fresh.reduce((max, r) => (r.createdAt > max ? r.createdAt : max), since ?? '');
      setReports((prev) => {
        const known = new Set(prev.map((r) => r.id));
        return [...prev, ...fresh.filter((r) => !known.has(r.id))];
      });
      setArrived((prev) => ({ ...Object.fromEntries(fresh.map((r) => [r.id, t])), ...prev }));
    }).catch(() => {});
    const pollMissions = () => api.missions().then(setMissions).catch(() => {});
    pollReports();
    pollMissions();
    const ids = [
      setInterval(pollReports, POLL_REPORTS_MS),
      setInterval(pollMissions, POLL_MISSIONS_MS),
      setInterval(() => setNow(Date.now()), 1000),
    ];
    return () => ids.forEach(clearInterval);
  }, []);

  const markers = useMemo<MapMarker[]>(() => reports.map((r) => ({
    id: r.id, lat: r.lat, lng: r.lng, colour: CATEGORY[r.category].colour, label: r.summary,
    fresh: now - (arrived[r.id] ?? 0) < FRESH_MS,
  })), [reports, arrived, now]);

  const latest = useMemo(() => [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3), [reports]);
  const active = missions.filter((m) => m.state.status !== 'open').length;
  const reportUrl = `${origin}/report`;

  return (
    <div className="flex h-dvh w-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div className="relative min-w-0 flex-1">
        {layers && <HexMap data={layers} layer="need" markers={markers} zoom={13.5} controls={false} label={t('map.aria')} />}
        <div className="absolute bottom-0 left-0 p-6 pb-10"><Legend title={t('layer.need')} /></div>
      </div>

      <aside className="flex w-[22rem] shrink-0 flex-col gap-6 border-l p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h1 className="text-3xl font-bold leading-tight">Heilbronn wirkt</h1>

        <dl className="grid grid-cols-2 gap-4">
          {[
            [t('screen.reports'), reports.length],
            [t('screen.activeMissions'), active],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)' }}>
              <dd className="text-[2.5rem] font-bold leading-none tabular-nums">{value}</dd>
              <dt className="mt-1 text-[0.9375rem]" style={{ color: 'var(--muted)' }}>{label}</dt>
            </div>
          ))}
        </dl>

        <section aria-live="polite" className="min-h-0 flex-1 overflow-hidden">
          <h2 className="mb-2 font-semibold">{t('screen.latest')}</h2>
          <ul className="space-y-3">
            {latest.map((r) => (
              <li key={r.id} className="flex gap-2">
                <span aria-hidden>{CATEGORY[r.category].icon}</span>
                <span>„{r.summary}“</span>
              </li>
            ))}
          </ul>
        </section>

        {origin && (
          <div className="flex flex-col items-center gap-2 text-center">
            <QrCode value={reportUrl} size={200} label={t('screen.qr')} />
            <p className="text-lg font-semibold">{t('screen.scan')}</p>
            <p className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>{reportUrl.replace(/^https?:\/\//, '')}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
