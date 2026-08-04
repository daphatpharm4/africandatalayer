import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFieldLaunchHref,
  fieldLaunchChoiceKey,
  parseFieldLaunchIntent,
} from '../lib/client/fieldLaunch.ts';

const intent = {
  organizationId: 'org_123',
  projectId: 'project-456',
  recordTypeKey: 'waste_point',
};

test('field launch href round-trips a valid collection target', () => {
  const href = buildFieldLaunchHref(intent);
  assert.deepEqual(parseFieldLaunchIntent(href), intent);
  assert.equal(fieldLaunchChoiceKey(intent), 'project-456:waste_point');
});

test('field launch parser rejects missing, malformed, and unsafe targets', () => {
  assert.equal(parseFieldLaunchIntent('/'), null);
  assert.equal(parseFieldLaunchIntent('/?fieldLaunch=1&organizationId=org&projectId=project&recordTypeKey=Bad-Key'), null);
  assert.equal(parseFieldLaunchIntent('/?fieldLaunch=1&organizationId=../org&projectId=project&recordTypeKey=site'), null);
  assert.equal(buildFieldLaunchHref({ ...intent, recordTypeKey: 'Bad-Key' }), '/');
});
