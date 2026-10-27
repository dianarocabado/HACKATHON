'use client';
// First-visit intro over the map: the idea in one sentence and three steps.
import Link from 'next/link';

export const WELCOME_KEY = 'hw-welcome-seen';

const STEPS = [
  { icon: '🗺️', title: 'Schauen', text: 'Die Karte zeigt aus echten Sensordaten, wo es in Heilbronn zu heiß, zu staubig oder zu eng fürs Rad ist.' },
  { icon: '🎤', title: 'Melden', text: 'Sag einfach, was dir auffällt. Wir prüfen es mit dem nächsten Sensor.' },
  { icon: '✅', title: 'Anpacken', text: 'Übernimm eine Mission in deiner Nähe – Bäume gießen, Schatten schaffen – und sieh, was sie bewirkt.' },
];

export default function Welcome({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center p-4 md:items-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl p-6 shadow-xl"
        style={{ background: 'var(--surface)' }}
      >
        <h2 id="welcome-title" className="text-2xl font-bold">Heilbronn wirkt</h2>
        <p className="mt-2 text-[1.0625rem]">
          Wir machen aus Heilbronns Sensordaten kleine Aufgaben für deine Nachbarschaft – und zeigen, ob Hilfe etwas bewirkt.
        </p>
        <ol className="mt-5 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                style={{ background: 'var(--bg)' }}
              >
                {s.icon}
              </span>
              <div>
                <h3 className="font-semibold">{i + 1}. {s.title}</h3>
                <p className="text-[0.9375rem]" style={{ color: 'var(--muted)' }}>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={onClose}
            autoFocus
            className="min-h-12 rounded-xl font-semibold"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            Los geht&apos;s
          </button>
          <Link
            href="/report"
            onClick={onClose}
            className="flex min-h-11 items-center justify-center rounded-xl border font-medium"
            style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}
          >
            Gleich etwas melden
          </Link>
        </div>
      </section>
    </div>
  );
}
