import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HexCell, Station } from '@contracts/types';
import { cityMedians, describeCell, median } from './facts.ts';

const station: Station = { id: 'sb-1', name: 'Marktplatz', lat: 49.14, lng: 9.21, lastSeen: '2026-10-27T12:00:00Z', latest: {} };
const cell = (facts: HexCell['facts']): HexCell => ({ h3: '891faa02ac7ffff', scores: {}, need: 0.5, facts });

test('median handles odd, even and empty', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
});

test('temperature is compared with the city median in German format', () => {
  const cells = [cell({ tempAfternoonC: 31 }), cell({ tempAfternoonC: 33.1 }), cell({ tempAfternoonC: 30 })];
  const facts = describeCell(cell({ tempAfternoonC: 33.1, nearestStationId: 'sb-1', nearestStationDistM: 140 }), cityMedians(cells), [station]);
  assert.equal(facts[0].text, 'Nachmittags hier im Schnitt 33,1 °C, 2,1 °C über dem Stadtmedian.');
  assert.equal(facts[0].source, 'Sensor „Marktplatz“, 140 m entfernt');
});

test('heat-walk anomaly follows the temperature fact, warmer and cooler', () => {
  const warm = describeCell(cell({ tempAfternoonC: 31, heatWalkAnomalyC: 1.4 }), cityMedians([]), []);
  assert.deepEqual(warm.map((f) => f.key), ['temp', 'heatwalk']);
  assert.equal(warm[1].text, 'Auf dem Hitzespaziergang im September gemessen: 1,4 °C wärmer als der Rest der Route.');
  const cool = describeCell(cell({ heatWalkAnomalyC: -0.86 }), cityMedians([]), []);
  assert.match(cool[0].text, /0,9 °C kühler als der Rest der Route/);
});

test('surface roughness is compared with the city median; one tree is singular', () => {
  const cells = [cell({ surfaceRoughness: 10 }), cell({ surfaceRoughness: 12 }), cell({ surfaceRoughness: 30 })];
  const [rough, tree] = describeCell(cell({ surfaceRoughness: 18, trees: 1 }), cityMedians(cells), []);
  assert.equal(rough.text, 'Die Wege sind hier holpriger als im Stadtschnitt (Rauheit 18 von 100, Stadtmedian 12).');
  assert.equal(rough.source, 'senseBox:bike, Erschütterungen bei Messfahrten');
  assert.equal(tree.text, '1 Straßenbaum steht in diesem Feld.');
  const [smooth] = describeCell(cell({ surfaceRoughness: 8 }), cityMedians(cells), [], 'en');
  assert.equal(smooth.text, 'Paths here are smoother than the city average (roughness 8 of 100, city median 12).');
});

test('missing facts produce no sentences, far sensors are called out', () => {
  assert.deepEqual(describeCell(cell({}), cityMedians([]), []), []);
  const facts = describeCell(cell({ nearestStationDistM: 2300 }), cityMedians([]), []);
  assert.equal(facts[0].key, 'nosensor');
  assert.match(facts[0].text, /2,3 km/);
});

test('English facts use English wording and number format', () => {
  const cells = [cell({ tempAfternoonC: 31 }), cell({ tempAfternoonC: 33.1 }), cell({ tempAfternoonC: 30 })];
  const facts = describeCell(cell({ tempAfternoonC: 33.1, heatWalkAnomalyC: -0.86, nearestStationId: 'sb-1', nearestStationDistM: 140 }),
    cityMedians(cells), [station], 'en');
  assert.equal(facts[0].text, 'Afternoons here average 33.1 °C, 2.1 °C above the city median.');
  assert.equal(facts[0].source, 'Sensor “Marktplatz”, 140 m away');
  assert.equal(facts[1].text, 'Measured on the heat walk in September: 0.9 °C cooler than the rest of the route.');
});
