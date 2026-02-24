import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLowEndFromHints } from '../lib/client/deviceProfile.js';

test('detects low-end device from memory/CPU hints', () => {
  const isLowEnd = detectLowEndFromHints({
    userAgent: 'Mozilla/5.0 (Linux; Android 13)',
    platform: 'Linux armv8l',
    deviceMemoryGb: 2,
    hardwareConcurrency: 4,
    effectiveType: '4g',
    saveData: false,
  });
  assert.equal(isLowEnd, true);
});

test('detects low-end device from itel user-agent hint', () => {
  const isLowEnd = detectLowEndFromHints({
    userAgent: 'Mozilla/5.0 (Linux; Android 12; itel A661L)',
    platform: 'Linux armv8l',
    deviceMemoryGb: 4,
    hardwareConcurrency: 8,
    effectiveType: '4g',
    saveData: false,
  });
  assert.equal(isLowEnd, true);
});

test('keeps normal modern device out of low-end mode', () => {
  const isLowEnd = detectLowEndFromHints({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
    platform: 'Linux armv8l',
    deviceMemoryGb: 8,
    hardwareConcurrency: 8,
    effectiveType: '4g',
    saveData: false,
  });
  assert.equal(isLowEnd, false);
});
