'use client';
// Map page body: loads layers, shows toggles + legend + hexagon panel + first-visit intro, handles loading and retry.
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayersFile, MissionState, MissionWithState, Report, Station } from '@contracts/types';
import { api } from '@/lib/client/api';
import { cityMedians } from '@/lib/client/facts';
import { locale } from '@/lib/client/i18n';
import { CATEGORY } from '@/lib/client/missions';
import { MAP_LAYERS, type MapLayer } from '@/lib/client/scale';
import type { MapMarker, MapPick, MissionPin } from './HexMap';
import HexPanel from './HexPanel';
import { AppIcon, Icon } from './Icons';
import MissionSheet from './MissionSheet';
import ReportPopup from './ReportPopup';
import LayerToggle from './LayerToggle';
import Legend from './Legend';
import Welcome, { WELCOME_KEY } from './Welcome';
import { useLang } from './LangProvider';

const HexMap = dynamic(() => import('./HexMap'), { ssr: false });

export default function MapView() {
  const { t, lang } = useLang();
  const [data, setData] = useState<LayersFile | null>(null);
  const [error, setError] = useState(false);
  const [layer, setLayer] = useState<MapLayer>('need');
  const [selected, setSelected] = useState<MapPick | null>(null);
  const [openReport, setOpenReport] = useState<string | null>(null);

  const fetchLayers = useCallback(() => api.layers().then(setData).catch(() => setError(true)), []);
  useEffect(() => { fetchLayers(); }, [fetchLayers]);
  const retry = () => { setError(false); fetchLayers(); };

  // Secondary data for the panel; the map works without it.
  const [stations, setStations] = useState<Station[]>([]);
  useEffect(() => { api.stations().then(setStations).catch(() => {}); }, []);

  // Missions as pins; polled so missions created from new voice reports (A12) appear without a reload.
  const [missions, setMissions] = useState<MissionWithState[]>([]);
  const [showMissions, setShowMissions] = useState(true);
  const [openMission, setOpenMission] = useState<string | null>(null);
  useEffect(() => {
    const load = () => api.missions().then(setMissions).catch(() => {});
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, []);
  const pins = useMemo<MissionPin[]>(() => (showMissions ? missions : [])
    .filter((m) => m.state.status !== 'verified')
    .map((m) => ({ id: m.id, lat: m.lat, lng: m.lng, colour: CATEGORY[m.category].colour })), [missions, showMissions]);
  const mission = missions.find((m) => m.id === openMission) ?? null;
  const updateMission = (state: MissionState) =>
    setMissions((all) => all.map((m) => (m.id === state.missionId ? { ...m, state } : m)));

  // Reports at their exact coordinates; refreshed so a report sent from this phone shows on return.
  const [reports, setReports] = useState<Report[]>([]);
  useEffect(() => {
    const load = () => api.reports().then(setReports).catch(() => {});
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, []);
  const markers = useMemo<MapMarker[]>(() => [
    ...reports.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, colour: CATEGORY[r.category].colour, label: r.summary })),
    ...(selected ? [{ id: 'tap', lat: selected.lat, lng: selected.lng, colour: '', kind: 'tap' as const }] : []),
  ], [reports, selected]);
  const report = reports.find((r) => r.id === openReport) ?? null;
  // One sheet at a time: hexagon panel, report popup or mission sheet.
  const pick = (p: MapPick | null) => { setOpenReport(null); setOpenMission(null); setSelected(p); };
  const showReport = (id: string) => { setSelected(null); setOpenMission(null); setOpenReport(id); };
  const showMission = (id: string) => { setSelected(null); setOpenReport(null); setOpenMission(id); };

  const medians = useMemo(() => cityMedians(data?.cells ?? [], data ?? {}), [data]);
  const cell = useMemo(() => data?.cells.find((c) => c.h3 === selected?.h3) ?? null, [data, selected]);

  const current = MAP_LAYERS.find((l) => l.id === layer)!;
  const label = t(current.label);
  // "Bedarf" lists its ingredients with the weights the pipeline used.
  const info = useMemo(() => {
    if (layer !== 'need') return t(current.info);
    const pct = new Intl.NumberFormat(locale(lang), { style: 'percent' });
    const list = Object.entries(data?.weights ?? {})
      .filter(([, w]) => w > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id, w]) => `${t(MAP_LAYERS.find((l) => l.id === id)?.label ?? 'layer.need')} ${pct.format(w)}`)
      .join(', ');
    return t(current.info, { list });
  }, [layer, current, data, lang, t]);

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
      <h1 className="sr-only">{t('map.title')}</h1>
      {data && (
        <HexMap
          data={data} layer={layer} selected={selected?.h3 ?? null} onSelect={pick}
          markers={markers} onMarkerClick={showReport} missions={pins} onMissionClick={showMission} label={t('map.aria')}
        />
      )}

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
        <button
          aria-pressed={showMissions}
          onClick={() => setShowMissions((v) => !v)}
          className="pointer-events-auto mt-1 inline-flex min-h-11 items-center gap-1 rounded-full border px-4 text-[0.9375rem] shadow-sm"
          style={{
            background: showMissions ? 'var(--brand)' : 'var(--surface)',
            color: showMissions ? 'var(--brand-ink)' : 'var(--text)',
            borderColor: showMissions ? 'var(--brand)' : 'var(--border)',
          }}
        >
          <Icon icon={AppIcon.place} size={18} /> {t('map.missions')}
        </button>
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
          <Legend title={label} info={info} missions={showMissions} />
        </div>
      </div>

      {cell && selected && (
        <HexPanel
          cell={cell} point={selected} medians={medians} stations={stations} missions={missions}
          onClose={() => setSelected(null)}
        />
      )}
      {report && <ReportPopup report={report} onClose={() => setOpenReport(null)} />}
      {mission && <MissionSheet mission={mission} onState={updateMission} onClose={() => setOpenMission(null)} />}
      {welcome && <Welcome onClose={closeWelcome} />}
    </div>
  );
}
