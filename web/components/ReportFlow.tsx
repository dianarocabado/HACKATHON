'use client';
// Voice report: mic → live transcript (editable) → location (QR ?lat=&lng=, map ?h3=, GPS or typed) → send → result.
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { Report } from '@contracts/types';
import { api } from '@/lib/client/api';
import { findDemoPlace } from '@/lib/client/places';
import { placeFromGps, placeFromParams, type Place } from '@/lib/client/report';
import { useSpeech } from '@/lib/client/speech';
import ReportResult from './ReportResult';
import { useLang } from './LangProvider';

const MAX_CHARS = 1000; // matches the API limit

export default function ReportFlow() {
  const { t } = useLang();
  const params = useSearchParams();
  const speech = useSpeech('de-DE');
  const [place, setPlace] = useState<Place | null>(() => placeFromParams(params));
  // At a demo place (QR poster) the hint shows that place's example sentence.
  const demo = findDemoPlace(place?.label);
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
      <h1 className="text-2xl font-semibold">{t('report.title')}</h1>

      <div className="flex flex-col items-center gap-2 py-2">
        <button
          type="button"
          onClick={speech.listening ? speech.stop : speech.start}
          disabled={!speech.supported}
          aria-pressed={speech.listening}
          aria-label={t(speech.listening ? 'report.stop' : 'report.start')}
          className={`flex h-[72px] w-[72px] items-center justify-center rounded-full text-3xl shadow-md disabled:opacity-40 ${speech.listening ? 'animate-pulse' : ''}`}
          style={{ background: speech.listening ? 'var(--warn)' : 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          <span aria-hidden>{speech.listening ? '■' : '🎤'}</span>
        </button>
        <p className="text-[0.8125rem]" style={{ color: 'var(--muted)' }} aria-live="polite">
          {t(speech.listening ? 'report.listening' : micBroken ? 'report.noMic' : 'report.tapMic')}
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>{t('report.yours')}</span>
        <textarea
          value={text}
          readOnly={speech.listening}
          onChange={(e) => speech.setFinalText(e.target.value.slice(0, MAX_CHARS))}
          rows={4}
          placeholder={t('report.example', { text: demo?.example ?? t('report.defaultExample') })}
          className="rounded-xl border p-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        />
      </label>

      <section aria-label={t('report.place')} className="flex flex-col gap-2">
        <span className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>{t('report.where')}</span>
        {place ? (
          <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
            <span>📍 {place.label}</span>
            <button type="button" onClick={() => setPlace(null)} className="min-h-11 px-2 underline" style={{ color: 'var(--brand)' }}>{t('report.change')}</button>
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
              {t(gpsState === 'busy' ? 'report.locating' : 'report.useGps')}
            </button>
            {gpsState === 'failed' && <p className="text-[0.8125rem]">{t('report.gpsFailed')}</p>}
            <input
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value.slice(0, 100))}
              placeholder={t('report.placeHint')}
              aria-label={t('report.describePlace')}
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
        {t(sending ? 'report.sending' : 'report.send')}
      </button>
      {sendError && <p role="alert">{t('report.sendError')}</p>}
    </div>
  );
}
