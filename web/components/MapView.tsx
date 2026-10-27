'use client';
// Map page body: loads layers, shows toggles + legend + hexagon panel, handles loading, timeout and retry.
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayersFile, MissionWithState, Station } from '@contracts/types';
import { api } from '@/lib/client/api';
import { cityMedians } from '@/lib/client/facts';
import { MAP_LAYERS, type MapLayer } from '@/lib/client/scale';
import HexPanel from './HexPanel';
import LayerToggle from './LayerToggle';
import Legend from './Legend';

const HexMap = dynamic(() => import('./HexMap'), { ssr: false });

export default function MapView() {
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

  const label = MAP_LAYERS.find((l) => l.id === layer)!.label;

  return (
    <div className="relative min-h-0 flex-1">
      {data && <HexMap data={data} layer={layer} selected={selected} onSelect={setSelected} />}

      {!data && !error && (
        <div className="absolute inset-0 animate-pulse" style={{ background: 'var(--border)' }} aria-busy />
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
          <p>Die Karte lädt gerade nicht.</p>
          <button
            onClick={retry}
            className="min-h-11 rounded-xl px-4"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            Nochmal versuchen
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
        <div className="pointer-events-auto">
          <Legend title={label} />
        </div>
      </div>

      {cell && (
        <HexPanel cell={cell} medians={medians} stations={stations} missions={missions} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
