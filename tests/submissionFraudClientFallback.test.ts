import test from 'node:test';
import assert from 'node:assert/strict';
import { applyClientExifFallback } from '../lib/server/submissionFraud.js';

test('client EXIF fallback supplements missing GPS without overwriting server EXIF fields', () => {
  const merged = applyClientExifFallback(
    {
      gps: null,
      capturedAt: '2026-03-04T10:00:00.000Z',
      deviceMake: null,
      deviceModel: 'TECNO KH6',
      exifStatus: 'ok',
      exifReason: 'EXIF metadata parsed successfully',
      exifSource: 'upload_buffer',
    },
    {
      latitude: 4.08438,
      longitude: 9.73598,
      capturedAt: '2026-03-04T10:01:00.000Z',
      deviceMake: 'TECNO',
      deviceModel: 'TECNO KH6',
    },
  );

  assert.deepEqual(merged.gps, { latitude: 4.08438, longitude: 9.73598 });
  assert.equal(merged.capturedAt, '2026-03-04T10:00:00.000Z');
  assert.equal(merged.deviceMake, 'TECNO');
  assert.equal(merged.deviceModel, 'TECNO KH6');
  assert.equal(merged.exifStatus, 'fallback_recovered');
  assert.equal(merged.exifSource, 'client_fallback');
  assert.match(merged.exifReason ?? '', /gps/i);
});

test('client EXIF fallback does not overwrite complete server EXIF metadata', () => {
  const original = {
    gps: { latitude: 4.08, longitude: 9.73 },
    capturedAt: '2026-03-04T10:00:00.000Z',
    deviceMake: 'Samsung',
    deviceModel: 'S24',
    exifStatus: 'ok' as const,
    exifReason: 'EXIF metadata parsed successfully',
    exifSource: 'upload_buffer' as const,
  };

  const merged = applyClientExifFallback(original, {
    latitude: 4.01,
    longitude: 9.01,
    capturedAt: '2020-01-01T00:00:00.000Z',
    deviceMake: 'Other',
    deviceModel: 'Other',
  });

  assert.deepEqual(merged, original);
});

test('client EXIF fallback no-ops when client metadata is empty', () => {
  const original = {
    gps: null,
    capturedAt: null,
    deviceMake: null,
    deviceModel: null,
    exifStatus: 'missing' as const,
    exifReason: 'No EXIF metadata found in uploaded file',
    exifSource: 'upload_buffer' as const,
  };

  const merged = applyClientExifFallback(original, {
    latitude: null,
    longitude: null,
    capturedAt: null,
    deviceMake: null,
    deviceModel: null,
  });

  assert.deepEqual(merged, original);
});
