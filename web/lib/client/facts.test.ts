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

test('missing facts produce no sentences, far sensors are called out', () => {
  assert.deepEqual(describeCell(cell({}), cityMedians([]), []), []);
  const facts = describeCell(cell({ nearestStationDistM: 2300 }), cityMedians([]), []);
  assert.equal(facts[0].key, 'nosensor');
  assert.match(facts[0].text, /2,3 km/);
});
