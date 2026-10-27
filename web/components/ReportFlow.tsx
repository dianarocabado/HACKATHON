'use client';
// Voice report: mic → live transcript (editable) → location (QR/map ?h3=, GPS or typed) → send → result.
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { Report } from '@contracts/types';
import { api } from '@/lib/client/api';
import { placeFromGps, placeFromH3, type Place } from '@/lib/client/report';
import { useSpeech } from '@/lib/client/speech';
import ReportResult from './ReportResult';

const MAX_CHARS = 1000; // matches the API limit

export default function ReportFlow() {
  const params = useSearchParams();
  const speech = useSpeech('de-DE');
  const [place, setPlace] = useState<Place | null>(() => placeFromH3(params.get('h3'), params.get('place')));
  const [placeName, setPlaceName] = useState('');
  const [gpsState, setGpsState] = useState<'idle' | 'busy' | 'failed'>('idle');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [result, setResult] = useState<Report | null>(null);

  const text = speech.listening ? speech.text : speech.finalText;
  const micBroken = !speech.supported || speech.error != null;

  const locate = async () => {
    setGpsState('busy');
    try { setPlace(await placeFromGps()); setGpsState('idle'); } catch { setGpsState('failed'); }
  };

  const send = async () => {
    if (speech.listening) speech.stop();
    setSending(true);
    setSendError(false);
    try {
      setResult(await api.createReport({
        transcript: text.trim(),
        ...(place ? { lat: place.lat, lng: place.lng } : {}),
        placeName: place?.source === 'qr' ? place.label : placeName.trim() || undefined,
      }));
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  };

  const restart = () => { setResult(null); speech.setFinalText(''); };
  if (result) return <ReportResult report={result} onAnother={restart} />;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4">
      <h1 className="text-2xl font-semibold">Was fällt dir auf?</h1>

      <div className="flex flex-col items-center gap-2 py-2">
        <button
          type="button"
          onClick={speech.listening ? speech.stop : speech.start}
          disabled={!speech.supported}
          aria-pressed={speech.listening}
          aria-label={speech.listening ? 'Aufnahme stoppen' : 'Aufnahme starten'}
          className={`flex h-[72px] w-[72px] items-center justify-center rounded-full text-3xl shadow-md disabled:opacity-40 ${speech.listening ? 'animate-pulse' : ''}`}
          style={{ background: speech.listening ? 'var(--warn)' : 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          <span aria-hidden>{speech.listening ? '■' : '🎤'}</span>
        </button>
        <p className="text-[0.8125rem]" style={{ color: 'var(--muted)' }} aria-live="polite">
          {speech.listening ? 'Ich höre zu … tippe zum Beenden.'
            : micBroken ? 'Spracheingabe geht hier gerade nicht. Schreib es einfach auf.'
            : 'Tippe aufs Mikro und erzähl, was dir auffällt.'}
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>Deine Meldung</span>
        <textarea
          value={text}
          readOnly={speech.listening}
          onChange={(e) => speech.setFinalText(e.target.value.slice(0, MAX_CHARS))}
          rows={4}
          placeholder="z. B. „An der Haltestelle ist es mittags total heiß, kein Schatten.“"
          className="rounded-xl border p-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        />
      </label>

      <section aria-label="Ort" className="flex flex-col gap-2">
        <span className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>Wo?</span>
        {place ? (
          <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
            <span>📍 {place.label}</span>
            <button type="button" onClick={() => setPlace(null)} className="min-h-11 px-2 underline" style={{ color: 'var(--brand)' }}>ändern</button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={locate}
              disabled={gpsState === 'busy'}
              className="min-h-11 rounded-xl border px-3 font-medium disabled:opacity-50"
              style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}
            >
              {gpsState === 'busy' ? 'Suche Standort …' : '📍 Meinen Standort verwenden'}
            </button>
            {gpsState === 'failed' && <p className="text-[0.8125rem]">Standort nicht verfügbar. Beschreib den Ort einfach:</p>}
            <input
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value.slice(0, 100))}
              placeholder="oder Ort beschreiben, z. B. „Kiliansplatz“"
              aria-label="Ort beschreiben"
              className="min-h-11 rounded-xl border px-3"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            />
          </>
        )}
      </section>

      <button
        type="button"
        onClick={send}
        disabled={sending || text.trim().length < 3}
        className="min-h-12 rounded-xl font-semibold disabled:opacity-50"
        style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
      >
        {sending ? 'Wird gesendet …' : 'Meldung senden'}
      </button>
      {sendError && <p role="alert">Senden hat nicht geklappt. Deine Meldung ist noch da – bitte nochmal versuchen.</p>}
    </div>
  );
}
