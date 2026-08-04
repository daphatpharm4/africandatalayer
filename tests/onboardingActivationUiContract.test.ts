import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const splashPath = new URL('../components/Screens/Splash.tsx', import.meta.url);
const wizardPath = new URL('../components/Console/OnboardingWizard.tsx', import.meta.url);
const appPath = new URL('../App.tsx', import.meta.url);
const fieldFlowPath = new URL('../components/Screens/PlatformCollectionFlow.tsx', import.meta.url);

test('field onboarding leads with a real map action and defers authentication', async () => {
  const source = await readFile(splashPath, 'utf8');
  assert.match(source, /id: 'mission'/);
  assert.match(source, /onStart\(Screen\.HOME\)/);
  assert.match(source, /How verification works/);
  assert.doesNotMatch(source, /id: 'rewards'|id: 'verticals'/);
});

test('console onboarding ends with a launch result and authorized field handoff', async () => {
  const source = await readFile(wizardPath, 'utf8');
  assert.match(source, /state\.step === 'launch'/);
  assert.match(source, /buildFieldLaunchHref/);
  assert.match(source, /Run a test capture/);
  assert.match(source, /dispatch\(\{ type: 'COMPLETE' \}\)/);
});

test('field handoff routes through authorized platform context and explains unavailable targets', async () => {
  const [app, fieldFlow] = await Promise.all([
    readFile(appPath, 'utf8'),
    readFile(fieldFlowPath, 'utf8'),
  ]);
  assert.match(app, /parseFieldLaunchIntent/);
  assert.match(app, /fieldLaunchChoiceKey/);
  assert.match(app, /Boolean\(platformContributionTarget\)/);
  assert.match(fieldFlow, /That field form is not available to this account/);
});
