'use client';
// Bottom sheet (phone) / side card (desktop) for one hexagon: plain-language facts, missions here, report button.
import Link from 'next/link';
import type { HexCell, MissionWithState, Station } from '@contracts/types';
import { describeCell, type cityMedians } from '@/lib/client/facts';

const MAX_FACTS = 4;

export default function HexPanel({
  cell, medians, stations, missions, onClose,
}: {
  cell: HexCell;
  medians: ReturnType<typeof cityMedians>;
  stations: Station[];
  missions: MissionWithState[];
  onClose: () => void;
}) {
  const facts = describeCell(cell, medians, stations).slice(0, MAX_FACTS);
  const here = missions.filter((m) => m.h3 === cell.h3);

  return (
    <section
      aria-label="Details zu diesem Ort"
      className="absolute inset-x-0 bottom-0 z-10 max-h-[60%] overflow-y-auto rounded-t-2xl border px-4 pt-4 shadow-lg md:inset-x-auto md:right-4 md:top-20 md:bottom-auto md:max-h-[calc(100%-7rem)] md:w-96 md:rounded-2xl"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold">Dieser Ort</h2>
        <button
          onClick={onClose}
          aria-label="Schließen"
          className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-xl text-xl"
          style={{ color: 'var(--muted)' }}
        >
          ×
        </button>
      </div>

      {facts.length ? (
        <ul className="space-y-3">
          {facts.map((f) => (
            <li key={f.key}>
              <p>{f.text}</p>
              <p className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>Quelle: {f.source}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: 'var(--muted)' }}>Für diesen Ort haben wir noch keine Daten.</p>
      )}

      {here.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 font-medium">Missionen hier</h3>
          <ul className="space-y-2">
            {here.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/missions/${m.id}`}
                  className="block rounded-xl border px-3 py-2"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {m.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sticky so the main action stays visible when the facts scroll */}
      <div className="sticky bottom-0 -mx-4 mt-4 px-4 pb-4 pt-2" style={{ background: 'var(--surface)' }}>
        <Link
          href={`/report?h3=${cell.h3}`}
          className="flex min-h-11 items-center justify-center rounded-xl font-medium"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          Hier etwas melden
        </Link>
      </div>
    </section>
  );
}
