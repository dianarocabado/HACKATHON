import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseMode, isIOS, mediaProblem, recognitionProblem, recorderMime } from './speechSupport.ts';

const env = { secure: true, hasRecognition: true, hasRecorder: true, sttAvailable: true };

test('mode: http blocks everything, live preferred, recording as fallback', () => {
  assert.deepEqual(chooseMode({ ...env, secure: false }), { mode: 'none', problem: 'insecure' });
  assert.deepEqual(chooseMode(env), { mode: 'live', problem: null });
  assert.deepEqual(chooseMode({ ...env, hasRecognition: false }), { mode: 'record', problem: null });
  assert.deepEqual(chooseMode({ ...env, hasRecognition: false, sttAvailable: false }), { mode: 'none', problem: 'unsupported' });
});

test('iOS prefers recording + server speech-to-text, falls back to live without it', () => {
  assert.deepEqual(chooseMode({ ...env, preferRecord: true }), { mode: 'record', problem: null });
  assert.deepEqual(chooseMode({ ...env, preferRecord: true, sttAvailable: false }), { mode: 'live', problem: null });
  assert.deepEqual(chooseMode({ ...env, preferRecord: true, secure: false }), { mode: 'none', problem: 'insecure' });
});

test('iOS detection: iPhone, iPad as Mac with touch, not Android or desktop Mac', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
  const ipadAsMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
  assert.equal(isIOS(iphone), true);
  assert.equal(isIOS(iphone.replace('Version/18.5', 'CriOS/130.0')), true);
  assert.equal(isIOS(ipadAsMac, 5), true);
  assert.equal(isIOS(ipadAsMac, 0), false);
  assert.equal(isIOS(android, 5), false);
});

test('recognition errors: denied is final, service errors fall back to recording', () => {
  assert.deepEqual(recognitionProblem('not-allowed'), { problem: 'denied', fallback: false });
  assert.deepEqual(recognitionProblem('service-not-allowed'), { problem: 'live-unavailable', fallback: true });
  assert.deepEqual(recognitionProblem('network'), { problem: 'live-unavailable', fallback: true });
  assert.deepEqual(recognitionProblem('aborted'), { problem: null, fallback: false });
});

test('media errors and recorder format', () => {
  assert.equal(mediaProblem('NotAllowedError'), 'denied');
  assert.equal(mediaProblem('NotFoundError'), 'no-mic');
  assert.equal(recorderMime((t) => t === 'audio/mp4'), 'audio/mp4');
  assert.equal(recorderMime(() => false), undefined);
});
