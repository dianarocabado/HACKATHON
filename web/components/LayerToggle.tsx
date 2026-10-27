'use client';
import { MAP_LAYERS, type MapLayer } from '@/lib/client/scale';

export default function LayerToggle({ value, onChange }: { value: MapLayer; onChange: (l: MapLayer) => void }) {
  return (
    <div role="radiogroup" aria-label="Kartenebene" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {MAP_LAYERS.map((l) => {
        const active = l.id === value;
        return (
          <button
            key={l.id}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(l.id)}
            className="min-h-11 shrink-0 rounded-full border px-4 text-[0.9375rem] shadow-sm transition-colors"
            style={{
              background: active ? 'var(--brand)' : 'var(--surface)',
              color: active ? 'var(--brand-ink)' : 'var(--text)',
              borderColor: active ? 'var(--brand)' : 'var(--border)',
            }}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
