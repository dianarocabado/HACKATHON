import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseMode, mediaProblem, recognitionProblem, recorderMime } from './speechSupport.ts';

const env = { secure: true, hasRecognition: true, hasRecorder: true, sttAvailable: true };

test('mode: http blocks everything, live preferred, recording as fallback', () => {
  assert.deepEqual(chooseMode({ ...env, secure: false }), { mode: 'none', problem: 'insecure' });
  assert.deepEqual(chooseMode(env), { mode: 'live', problem: null });
  assert.deepEqual(chooseMode({ ...env, hasRecognition: false }), { mode: 'record', problem: null });
  assert.deepEqual(chooseMode({ ...env, hasRecognition: false, sttAvailable: false }), { mode: 'none', problem: 'unsupported' });
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
