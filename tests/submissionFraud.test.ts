import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhotoFraudMetadata, buildSubmissionFraudCheck } from '../lib/server/submissionFraud.js';

test('photo metadata marks submission GPS as match within 1km', () => {
  const metadata = buildPhotoFraudMetadata({
    extracted: {
      gps: { latitude: 4.0866, longitude: 9.7403 },
      capturedAt: '2026-02-20T10:00:00.000Z',
      deviceMake: 'Apple',
      deviceModel: 'iPhone 14',
    },
    submissionLocation: { latitude: 4.0864, longitude: 9.7402 },
    ipLocation: null,
    submissionMatchThresholdKm: 1,
    ipMatchThresholdKm: 50,
  });

  assert.equal(metadata?.submissionGpsMatch, true);
  assert.ok((metadata?.submissionDistanceKm ?? 99) < 1);
});

test('photo metadata marks submission GPS as mismatch when beyond threshold', () => {
  const metadata = buildPhotoFraudMetadata({
    extracted: {
      gps: { latitude: 4.12, longitude: 9.79 },
      capturedAt: '2026-02-20T10:00:00.000Z',
      deviceMake: 'Samsung',
      deviceModel: 'S23',
    },
    submissionLocation: { latitude: 4.0864, longitude: 9.7402 },
    ipLocation: null,
    submissionMatchThresholdKm: 1,
    ipMatchThresholdKm: 50,
  });

  assert.equal(metadata?.submissionGpsMatch, false);
  assert.ok((metadata?.submissionDistanceKm ?? 0) > 1);
});

test('missing EXIF GPS keeps match status unavailable', () => {
  const metadata = buildPhotoFraudMetadata({
    extracted: {
      gps: null,
      capturedAt: null,
      deviceMake: null,
      deviceModel: null,
    },
    submissionLocation: { latitude: 4.0864, longitude: 9.7402 },
    ipLocation: { latitude: 4.09, longitude: 9.74 },
    submissionMatchThresholdKm: 1,
    ipMatchThresholdKm: 50,
  });

  assert.equal(metadata?.submissionGpsMatch, null);
  assert.equal(metadata?.ipGpsMatch, null);
  assert.equal(metadata?.submissionDistanceKm, null);
});

test('fraud check stores secondary photo metadata when provided', () => {
  const primaryPhoto = buildPhotoFraudMetadata({
    extracted: {
      gps: { latitude: 4.0866, longitude: 9.7403 },
      capturedAt: '2026-02-20T10:00:00.000Z',
      deviceMake: 'Apple',
      deviceModel: 'iPhone 14',
    },
    submissionLocation: { latitude: 4.0864, longitude: 9.7402 },
    ipLocation: null,
    submissionMatchThresholdKm: 1,
    ipMatchThresholdKm: 50,
  });
  const secondaryPhoto = buildPhotoFraudMetadata({
    extracted: {
      gps: { latitude: 4.0869, longitude: 9.741 },
      capturedAt: '2026-02-20T10:02:00.000Z',
      deviceMake: 'Apple',
      deviceModel: 'iPhone 14',
    },
    submissionLocation: { latitude: 4.0864, longitude: 9.7402 },
    ipLocation: null,
    submissionMatchThresholdKm: 1,
    ipMatchThresholdKm: 50,
  });

  const fraudCheck = buildSubmissionFraudCheck({
    submissionLocation: { latitude: 4.0864, longitude: 9.7402 },
    effectiveLocation: { latitude: 4.0866, longitude: 9.7403 },
    ipLocation: null,
    primaryPhoto,
    secondaryPhoto,
    submissionMatchThresholdKm: 1,
    ipMatchThresholdKm: 50,
  });

  assert.ok(fraudCheck.secondaryPhoto);
  assert.equal(fraudCheck.secondaryPhoto?.gps?.latitude, 4.0869);
  assert.equal(fraudCheck.secondaryPhoto?.gps?.longitude, 9.741);
});
