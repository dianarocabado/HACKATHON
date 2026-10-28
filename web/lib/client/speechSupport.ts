// Which speech input a browser can do, and why not, in plain terms the UI can show (no React here, unit-tested).

/** live = Web Speech API in the browser; record = MediaRecorder + /api/transcribe; none = type only. */
export type SpeechMode = 'live' | 'record' | 'none';

export type SpeechProblem =
  | 'insecure'          // page not on https (or localhost): browsers block the microphone
  | 'unsupported'       // neither live recognition nor recording + server speech-to-text available
  | 'denied'            // microphone permission refused
  | 'no-mic'            // no usable microphone
  | 'offline'           // device has no network
  | 'network'           // recognition / transcription service unreachable
  | 'no-speech'         // nothing was heard
  | 'live-unavailable'  // live recognition failed here; switched to recording, tap again
  | 'failed';

export interface SpeechEnv {
  secure: boolean;
  hasRecognition: boolean;
  hasRecorder: boolean;
  sttAvailable: boolean;
  /** Recording is more reliable than live recognition here (iOS), use it when the server can transcribe. */
  preferRecord?: boolean;
}

export function chooseMode(env: SpeechEnv): { mode: SpeechMode; problem: SpeechProblem | null } {
  if (!env.secure) return { mode: 'none', problem: 'insecure' };
  if (env.preferRecord && env.hasRecorder && env.sttAvailable) return { mode: 'record', problem: null };
  if (env.hasRecognition) return { mode: 'live', problem: null };
  if (env.hasRecorder && env.sttAvailable) return { mode: 'record', problem: null };
  return { mode: 'none', problem: 'unsupported' };
}

/**
 * iPhone/iPad, any browser (all use WebKit). iOS exposes webkitSpeechRecognition, but on web pages it often
 * never marks results final, fails when Siri/Dictation is off, and stops after short pauses.
 * iPadOS reports itself as a Mac, so touch support tells them apart.
 */
export function isIOS(userAgent: string, maxTouchPoints = 0): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/**
 * Web Speech API error code → problem. `fallback` means recording may still work here: iPhone browsers
 * other than Safari and many in-app browsers expose the API but its service is blocked or offline.
 */
export function recognitionProblem(code: string): { problem: SpeechProblem | null; fallback: boolean } {
  switch (code) {
    case 'aborted': return { problem: null, fallback: false };
    case 'not-allowed': return { problem: 'denied', fallback: false };
    case 'audio-capture': return { problem: 'no-mic', fallback: false };
    case 'no-speech': return { problem: 'no-speech', fallback: false };
    case 'network':
    case 'service-not-allowed':
    case 'language-not-supported':
      return { problem: 'live-unavailable', fallback: true };
    default: return { problem: 'failed', fallback: true };
  }
}

/** getUserMedia / MediaRecorder DOMException name → problem. */
export function mediaProblem(name: string): SpeechProblem {
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError') return 'no-mic';
  return 'failed';
}

/** First recording format the browser supports (Chrome/Firefox: webm, Safari: mp4). */
export function recorderMime(isTypeSupported: (t: string) => boolean): string | undefined {
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(isTypeSupported);
}

/** Problems after which typing is the only way forward, so the text field should get focus. */
export const TYPE_INSTEAD: ReadonlySet<SpeechProblem> = new Set(['insecure', 'unsupported', 'denied', 'no-mic', 'offline']);
