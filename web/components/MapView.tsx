'use client';
// Map page body: loads layers, shows toggles + legend + hexagon panel + first-visit intro, handles loading and retry.
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayersFile, MissionWithState, Station } from '@contracts/types';
import { api } from '@/lib/client/api';
import { cityMedians } from '@/lib/client/facts';
import { MAP_LAYERS, type MapLayer } from '@/lib/client/scale';
import HexPanel from './HexPanel';
import LayerToggle from './LayerToggle';
import Legend from './Legend';
import Welcome, { WELCOME_KEY } from './Welcome';
import { useLang } from './LangProvider';

const HexMap = dynamic(() => import('./HexMap'), { ssr: false });

export default function MapView() {
  const { t } = useLang();
  const [data, setData] = useState<LayersFile | null>(null);
  const [error, setError] = useState(false);
  const [layer, setLayer] = useState<MapLayer>('need');
  const [selected, setSelected] = useState<string | null>(null);

  const fetchLayers = useCallback(() => api.layers().then(setData).catch(() => setError(true)), []);
  useEffect(() => { fetchLayers(); }, [fetchLayers]);
  const retry = () => { setError(false); fetchLayers(); };

  // Secondary data for the panel; the map works without it.
  const [stations, setStations] = useState<Station[]>([]);
  const [missions, setMissions] = useState<MissionWithState[]>([]);
  useEffect(() => {
    api.stations().then(setStations).catch(() => {});
    api.missions().then(setMissions).catch(() => {});
  }, []);

  const medians = useMemo(() => cityMedians(data?.cells ?? []), [data]);
  const cell = useMemo(() => data?.cells.find((c) => c.h3 === selected) ?? null, [data, selected]);

  const label = t(MAP_LAYERS.find((l) => l.id === layer)!.label);

  // Intro shows once per browser; storage can be blocked (private mode), then it simply shows again next time.
  const [welcome, setWelcome] = useState(false);
  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(WELCOME_KEY) === '1'; } catch {}
    // localStorage is only readable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen) setWelcome(true);
  }, []);
  const closeWelcome = () => {
    setWelcome(false);
    try { localStorage.setItem(WELCOME_KEY, '1'); } catch {}
  };

  return (
    <div className="relative min-h-0 flex-1">
      {data && <HexMap data={data} layer={layer} selected={selected} onSelect={setSelected} label={t('map.aria')} />}

      {!data && !error && (
        <div className="absolute inset-0 animate-pulse" style={{ background: 'var(--border)' }} aria-busy />
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
          <p>{t('map.loadError')}</p>
          <button
            onClick={retry}
            className="min-h-11 rounded-xl px-4"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 p-4">
        <div className="pointer-events-auto">
          <LayerToggle value={layer} onChange={setLayer} />
        </div>
      </div>
      {/* pb-10 keeps the legend above the OSM attribution line */}
      <div className="pointer-events-none absolute bottom-0 left-0 p-4 pb-10">
        {/* Stacked: side by side would run under the zoom buttons on 400 px phones */}
        <div className="pointer-events-auto flex flex-col items-start gap-2">
          <button
            onClick={() => setWelcome(true)}
            aria-label={t('map.help')}
            className="flex h-11 w-11 items-center justify-center rounded-full border text-lg font-semibold shadow-sm"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            ?
          </button>
          <Legend title={label} />
        </div>
      </div>

      {cell && (
        <HexPanel cell={cell} medians={medians} stations={stations} missions={missions} onClose={() => setSelected(null)} />
      )}
      {welcome && <Welcome onClose={closeWelcome} />}
    </div>
  );
}
