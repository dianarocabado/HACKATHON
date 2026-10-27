import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate } from './i18n.ts';

test('translate fills placeholders in both languages', () => {
  assert.equal(translate('de', 'mission.support', { n: 3 }), '+1 Unterstützen (3)');
  assert.equal(translate('en', 'mission.support', { n: 3 }), '+1 Support (3)');
  assert.equal(translate('en', 'missions.supporters', {}), '{n} supporters');
});
