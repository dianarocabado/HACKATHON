'use client';
// MapLibre map with the H3 hexagon layer. Colours by the selected layer; null scores get a hatch pattern.
import { useEffect, useRef } from 'react';
import {
  Map as MapLibre, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource, type ExpressionSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cellToBoundary } from 'h3-js';
import type { HexCell, LayersFile } from '@contracts/types';
import { NEED_STEPS, type MapLayer } from '@/lib/client/scale';

// MapLibre derives the worker URL from its own chunk URL, which breaks after bundling. Point it at the emitted asset.
setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);

const CENTER: [number, number] = [9.215, 49.1425];
const HATCH = 'hatch';

function toGeoJSON(cells: HexCell[], layer: MapLayer): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cells.map((c) => {
      const ring = cellToBoundary(c.h3, true);
      ring.push(ring[0]);
      const value = layer === 'need' ? c.need : c.scores[layer] ?? null;
      return {
        type: 'Feature',
        properties: { h3: c.h3, value: value ?? -1 },
        geometry: { type: 'Polygon', coordinates: [ring] },
      };
    }),
  };
}

const fillColor: ExpressionSpecification = [
  'interpolate', ['linear'], ['get', 'value'],
  ...NEED_STEPS.flatMap((colour, i) => [i / (NEED_STEPS.length - 1), colour]),
] as unknown as ExpressionSpecification;

function hatchImage(): ImageData {
  const size = 8;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = 'rgba(95, 103, 95, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size, 0);
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

/**
 * DOM marker at an exact position. `report` = coloured dot (`fresh` ones pulse on the big screen),
 * `tap` = 📍 pin on the spot the user tapped. Clickable when `onMarkerClick` is given.
 */
export interface MapMarker {
  id: string; lat: number; lng: number; colour: string; fresh?: boolean; label?: string; kind?: 'report' | 'tap';
}

/** A map tap on a hexagon: the cell plus the exact tapped coordinates. */
export interface MapPick { h3: string; lat: number; lng: number }

export default function HexMap({
  data, layer, selected, onSelect, markers, onMarkerClick, zoom = 13, controls = true, label,
}: {
  data: LayersFile;
  layer: MapLayer;
  selected?: string | null;
  onSelect?: (pick: MapPick | null) => void;
  markers?: MapMarker[];
  onMarkerClick?: (id: string) => void;
  zoom?: number;
  controls?: boolean;
  label?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  const onMarkerClickRef = useRef(onMarkerClick);
  useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);

  useEffect(() => {
    const m = new MapLibre({
      container: container.current!,
      center: CENTER,
      zoom,
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: {
          base: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'base', type: 'raster', source: 'base' }],
      },
    });
    if (controls) m.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    m.on('error', (e) => console.error('map error', e.error));
    m.on('load', () => {
      m.addImage(HATCH, hatchImage());
      m.addSource('hex', { type: 'geojson', data: toGeoJSON(data.cells, layer), promoteId: 'h3' });
      m.addLayer({
        id: 'hex-fill', type: 'fill', source: 'hex',
        filter: ['>=', ['get', 'value'], 0],
        paint: { 'fill-color': fillColor, 'fill-opacity': 0.55 },
      });
      m.addLayer({
        id: 'hex-nodata', type: 'fill', source: 'hex',
        filter: ['<', ['get', 'value'], 0],
        paint: { 'fill-pattern': HATCH },
      });
      m.addLayer({
        id: 'hex-line', type: 'line', source: 'hex',
        paint: {
          'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#1F7A4D', '#FFFFFF'],
          'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.5, 0.5],
        },
      });
      m.on('click', (e) => {
        const hit = m.queryRenderedFeatures(e.point, { layers: ['hex-fill', 'hex-nodata'] })[0];
        const h3 = hit?.properties?.h3 as string | undefined;
        onSelectRef.current?.(h3 ? { h3, lat: e.lngLat.lat, lng: e.lngLat.lng } : null);
      });
      m.on('mouseenter', 'hex-fill', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'hex-fill', () => { m.getCanvas().style.cursor = ''; });
    });
    map.current = m;
    return () => { m.remove(); map.current = null; };
    // Map is created once; data and layer changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    const src = m?.getSource('hex') as GeoJSONSource | undefined;
    src?.setData(toGeoJSON(data.cells, layer));
  }, [data, layer]);

  useEffect(() => {
    const m = map.current;
    if (!m?.getSource('hex') || !selected) return;
    m.setFeatureState({ source: 'hex', id: selected }, { selected: true });
    return () => { if (m.getSource('hex')) m.setFeatureState({ source: 'hex', id: selected }, { selected: false }); };
  }, [selected]);

  const placed = useRef(new Map<string, Marker>());
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const want = new Map((markers ?? []).map((mk) => [mk.id, mk]));
    for (const [id, marker] of placed.current) {
      if (!want.has(id)) { marker.remove(); placed.current.delete(id); }
    }
    for (const mk of want.values()) {
      let marker = placed.current.get(mk.id);
      if (!marker) {
        const el = document.createElement('div');
        const tap = mk.kind === 'tap';
        el.className = tap ? 'tap-pin' : 'report-dot';
        if (tap) el.textContent = '📍'; else el.style.background = mk.colour;
        if (mk.label) { el.title = mk.label; el.setAttribute('aria-label', mk.label); }
        if (!tap && onMarkerClickRef.current) {
          el.setAttribute('role', 'button');
          el.tabIndex = 0;
          const open = (ev: Event) => { ev.stopPropagation(); onMarkerClickRef.current?.(mk.id); };
          el.addEventListener('click', open);
          el.addEventListener('keydown', (ev) => { if ((ev as KeyboardEvent).key === 'Enter') open(ev); });
        }
        // The pin's tip marks the spot; dots are centred on it.
        marker = new Marker({ element: el, anchor: tap ? 'bottom' : 'center' }).setLngLat([mk.lng, mk.lat]).addTo(m);
        placed.current.set(mk.id, marker);
      }
      marker.setLngLat([mk.lng, mk.lat]);
      marker.getElement().classList.toggle('report-dot--fresh', !!mk.fresh);
    }
  }, [markers]);

  // MapLibre's CSS sets position: relative on the container, so the absolute positioning lives on a wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" aria-label={label} />
    </div>
  );
}
