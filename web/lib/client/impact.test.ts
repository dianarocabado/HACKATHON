import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barWidths, effectSentence } from './impact.ts';

test('bar widths scale to the largest value', () => {
  assert.deepEqual(barWidths([25, 7]), [100, 28]);
  assert.deepEqual(barWidths([0, 0]), [0, 0]);
});

test('effect sentence: baseline only, no effect, improvement', () => {
  const base = { metric: 'temperatureC' as const, stationId: 's', before: 31.4, cityBefore: 29.8 };
  assert.match(effectSentence(base), /Vorher: 31,4\u00a0°C hier, 29,8\u00a0°C im Stadtschnitt\. Der Nachher-Wert wird noch gemessen\./);
  assert.equal(effectSentence({ ...base, after: 31, cityAfter: 29.4, effect: 0 }), 'Kein messbarer Unterschied zur Entwicklung in der ganzen Stadt.');
  assert.equal(effectSentence({ ...base, after: 30.2, cityAfter: 29.6, effect: -1 }),
    'Hier um 1,2\u00a0°C gesunken, in der ganzen Stadt um 0,2\u00a0°C gesunken. Unterschied: −1\u00a0°C.');
});

test('English effect sentence', () => {
  const nb = String.fromCharCode(160);
  const i = { metric: 'temperatureC' as const, stationId: 's', before: 31.4, cityBefore: 29.8, after: 30.2, cityAfter: 29.6, effect: -1 };
  assert.equal(effectSentence(i, 'en'), `Here down 1.2${nb}°C, across the city down 0.2${nb}°C. Difference: −1${nb}°C.`);
});
