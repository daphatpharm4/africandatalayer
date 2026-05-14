import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIgCaption } from '../scripts/caption.mjs';

test('builds caption with hashtags appended via IG separator', () => {
  const out = buildIgCaption({
    caption: { en: 'Hello', fr: 'Bonjour' },
    captionLang: 'en',
    hashtags: ['#A', '#B'],
  });
  assert.ok(out.startsWith('Hello'));
  assert.ok(out.includes('\n\n.\n.\n.\n'));
  assert.ok(out.endsWith('#A #B'));
});

test('selects FR caption when langOverride=fr', () => {
  const out = buildIgCaption({
    caption: { en: 'Hello', fr: 'Bonjour' },
    captionLang: 'en',
    hashtags: [],
    langOverride: 'fr',
  });
  assert.ok(out.startsWith('Bonjour'));
});

test('throws when combined length exceeds 2200', () => {
  assert.throws(
    () =>
      buildIgCaption({
        caption: { en: 'x'.repeat(2200), fr: 'x'.repeat(2200) },
        captionLang: 'en',
        hashtags: ['#A'],
      }),
    /2200/
  );
});

test('produces caption with no hashtag tail when hashtags empty', () => {
  const out = buildIgCaption({
    caption: { en: 'Hello', fr: 'Bonjour' },
    captionLang: 'en',
    hashtags: [],
  });
  assert.equal(out, 'Hello');
});
