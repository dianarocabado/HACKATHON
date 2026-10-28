import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MissionWithState } from '@contracts/types';
import { evidenceText, filterMissions } from './missions.ts';

const m = (id: string, over: Partial<MissionWithState>): MissionWithState => ({
  id, type: 'water_trees', title: id, description: '', h3: 'x', lat: 0, lng: 0, category: 'heat', urgency: 1,
  effort: 'hour', suitedFor: ['resident'], reason: { rule: '', evidence: {} }, source: 'pipeline',
  state: { missionId: id, status: 'open', supporters: 0 }, ...over,
});

test('filters by category, who and effort', () => {
  const all = [
    m('a', { category: 'heat', suitedFor: ['school'] }),
    m('b', { category: 'air', suitedFor: ['school', 'resident'] }),
    m('c', { category: 'air', effort: 'project', suitedFor: ['city'] }),
  ];
  assert.deepEqual(filterMissions(all, { category: 'air' }).map((x) => x.id).sort(), ['b', 'c']);
  assert.deepEqual(filterMissions(all, { who: 'school', category: 'air' }).map((x) => x.id), ['b']);
  assert.deepEqual(filterMissions(all, { effort: 'project' }).map((x) => x.id), ['c']);
});

test('open missions first, then by urgency', () => {
  const all = [
    m('done', { urgency: 3, state: { missionId: 'done', status: 'done', supporters: 0 } }),
    m('low', { urgency: 1 }),
    m('high', { urgency: 3 }),
  ];
  assert.deepEqual(filterMissions(all, {}).map((x) => x.id), ['high', 'low', 'done']);
});

test('evidence becomes German phrases, unknown keys pass through', () => {
  assert.deepEqual(evidenceText({ dryDays: 6, tempAfternoonC: 33.4, foo: 'bar' }),
    ['6 Tage ohne Regen', 'nachmittags im Schnitt 33,4 °C', 'foo: bar']);
});

test('English evidence phrases', () => {
  assert.deepEqual(evidenceText({ dryDays: 6, tempAfternoonC: 33.4, busStops: 1 }, 'en'),
    ['6 days without rain', 'afternoons average 33.4 °C', '1 bus stop']);
});
