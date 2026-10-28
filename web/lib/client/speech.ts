'use client';
// Speech input for the report flow. Live Web Speech API where it works (Chrome, Edge, Safari); otherwise
// record with MediaRecorder and transcribe on the server (/api/transcribe). The microphone is only
// requested when the user taps. Problems are reported as a SpeechProblem for a plain-language message.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import {
  chooseMode, isIOS, mediaProblem, recognitionProblem, recorderMime, type SpeechMode, type SpeechProblem,
} from './speechSupport';

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

const MAX_RECORDING_MS = 60_000;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
const canRecord = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export type SpeechPhase = 'idle' | 'listening' | 'recording' | 'transcribing';

export function useSpeech(lang: 'de' | 'en' = 'de') {
  const [mode, setMode] = useState<SpeechMode>('none');
  const [phase, setPhase] = useState<SpeechPhase>('idle');
  const [problem, setProblem] = useState<SpeechProblem | null>(null);
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const sttRef = useRef(false);
  const rec = useRef<Recognition | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);

  // Feature detection runs on the client after hydration; the server speech-to-text check is a cheap GET.
  useEffect(() => {
    const detect = () => {
      const r = chooseMode({
        secure: window.isSecureContext, hasRecognition: recognitionCtor() !== null,
        hasRecorder: canRecord(), sttAvailable: sttRef.current,
        preferRecord: isIOS(navigator.userAgent, navigator.maxTouchPoints),
      });
      setMode(r.mode);
      setProblem(r.problem === 'unsupported' ? null : r.problem); // only say "unsupported" once the user tries
    };
    detect();
    api.sttAvailable().then((ok) => { sttRef.current = ok; detect(); }).catch(() => {});
  }, []);

  const append = useCallback((t: string) => { if (t.trim()) setFinalText((prev) => `${prev} ${t.trim()}`.trim()); }, []);

  const startLive = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = lang === 'de' ? 'de-DE' : 'en-GB';
    r.continuous = true;
    r.interimResults = true;
    // Some engines end without marking the last words final; keep them instead of dropping them on end.
    let pending = '';
    r.onresult = (e) => {
      let fin = '';
      let tmp = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript; else tmp += res[0].transcript;
      }
      append(fin);
      pending = tmp;
      setInterim(tmp);
    };
    r.onerror = (e) => {
      const { problem: p, fallback } = recognitionProblem(e.error);
      if (fallback && canRecord() && sttRef.current) { setMode('record'); setProblem('live-unavailable'); }
      else setProblem(p === 'live-unavailable' ? 'network' : p);
    };
    r.onend = () => { append(pending); pending = ''; setPhase('idle'); setInterim(''); };
    try {
      r.start();
      rec.current = r;
      setPhase('listening');
    } catch {
      setProblem('failed');
    }
  }, [lang, append]);

  const startRecording = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setProblem(mediaProblem((err as DOMException).name));
      return;
    }
    const mimeType = recorderMime((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    r.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      recorder.current = null;
      const blob = new Blob(chunks, { type: r.mimeType || mimeType || 'audio/webm' });
      if (!blob.size) { setPhase('idle'); setProblem('no-speech'); return; }
      setPhase('transcribing');
      try {
        const text = await api.transcribe(blob, lang);
        if (text) append(text); else setProblem('no-speech');
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 503) { setMode('none'); setProblem('unsupported'); }
        else setProblem(navigator.onLine ? 'network' : 'offline');
      } finally {
        setPhase('idle');
      }
    };
    r.start();
    recorder.current = r;
    setPhase('recording');
    setTimeout(() => { if (r.state === 'recording') r.stop(); }, MAX_RECORDING_MS);
  }, [lang, append]);

  const start = useCallback(() => {
    setProblem(null);
    if (!navigator.onLine) { setProblem('offline'); return; }
    if (mode === 'live') startLive();
    else if (mode === 'record') void startRecording();
    else setProblem(window.isSecureContext ? 'unsupported' : 'insecure');
  }, [mode, startLive, startRecording]);

  const stop = useCallback(() => {
    rec.current?.stop();
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }, []);
  useEffect(() => () => {
    rec.current?.stop();
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }, []);

  return {
    mode, phase, problem, busy: phase !== 'idle',
    text: `${finalText} ${interim}`.trim(), finalText, setFinalText, start, stop,
  };
}
