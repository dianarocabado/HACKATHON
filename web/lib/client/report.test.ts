import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeFromH3, sensorSentence } from './report.ts';

test('placeFromH3 accepts valid cells and rejects junk', () => {
  const p = placeFromH3('891faa02ac7ffff', 'Marktplatz');
  assert.ok(p && Math.abs(p.lat - 49.14) < 0.02 && Math.abs(p.lng - 9.22) < 0.02);
  assert.equal(p?.label, 'Marktplatz');
  assert.equal(placeFromH3('nope'), null);
  assert.equal(placeFromH3(null), null);
});

test('sensor sentences for each status', () => {
  assert.equal(
    sensorSentence({ status: 'confirmed', value: 33.1, unit: '°C', distM: 140 }),
    'Der Sensor bestätigt das: 33,1 °C, 140 m entfernt.',
  );
  assert.match(sensorSentence({ status: 'not_confirmed', value: 8.4, unit: 'µg/m³', distM: 60 }), /misst gerade 8,4 µg\/m³, 60 m entfernt\. Deine Meldung zählt trotzdem/);
  assert.equal(sensorSentence({ status: 'no_sensor' }), 'Kein Sensor in der Nähe. Magst du einen aufhängen?');
});
