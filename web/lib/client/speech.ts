'use client';
// Live speech-to-text via the Web Speech API (Chrome, Edge, Safari). Callers must offer a typed fallback.
import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal types; the Web Speech API is not in TypeScript's DOM lib.
interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeech(lang = 'de-DE') {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);

  // Feature detection must run on the client after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSupported(recognitionCtor() !== null), []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) { setError('not-supported'); return; }
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let fin = '';
      let tmp = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript; else tmp += res[0].transcript;
      }
      if (fin) setFinalText((t) => `${t} ${fin}`.trim());
      setInterim(tmp);
    };
    r.onerror = (e) => { setError(e.error); setListening(false); };
    r.onend = () => { setListening(false); setInterim(''); };
    setError(null);
    try {
      r.start();
      rec.current = r;
      setListening(true);
    } catch {
      setError('start-failed');
    }
  }, [lang]);

  const stop = useCallback(() => { rec.current?.stop(); }, []);
  useEffect(() => () => rec.current?.stop(), []);

  return { supported, listening, text: `${finalText} ${interim}`.trim(), finalText, setFinalText, error, start, stop };
}
