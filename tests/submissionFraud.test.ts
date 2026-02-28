import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhotoFraudMetadata,
  buildSubmissionFraudCheck,
  isFraudCheckEffectivelyEmpty,
  isPhotoMetadataEffectivelyEmpty,
  parseSubmissionFraudCheck
} from '../lib/server/submissionFraud.js';

test('photo metadata marks submission GPS as match within 1km', () => {
  const metadata = buildPhotoFraudMetadata({
    extracted: {
      gps: { latitude: 4.0866, longitude: 9.7403 },
      capturedAt: '2026-02-20T10:00:00.000Z',
      deviceMake: 'Apple',
      deviceModel: 'iPhone 14',
      exifStatus: 'ok',
      exifReason: 'EXIF metadata parsed successfully',
      exifSource: 'upload_buffer',
    },
    submissionLocation: { latitude: 4.0864, longitude: 9.7402 },
    ipLocation: null,
    submissionMatchThresholdKm: 1,
    ipMatchThresholdKm: 50,
  });

  assert.equal(metadata?.submissionGpsMatch, true);
  assert.ok((metadata?.submissionDistanceKm ?? 99) < 1);
  assert.equal(metadata?.exifStatus, 'ok');
  assert.equal(metadata?.exifSource, 'upload_buffer');
});

test('photo metadata marks submission GPS as mismatch when beyond threshold', () => {
  const metadata = buildPhotoFraudMetadata({
    extracted: {
      gps: { latitude: 4.12, longitude: 9.79 },
      capturedAt: '2026-02-20T10:00:00.000Z',
      deviceMake: 'Samsung',
      deviceModel: 'S23',
      exifStatus: 'ok',
      exifReason: 'EXIF metadata parsed successfully',
      exifSource: 'upload_buffer',
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
      exifStatus: 'missing',
      exifReason: 'No EXIF metadata found in uploaded file',
      exifSource: 'upload_buffer',
    },
    submissionLocation: { latitude: 4.0864, longitude: 9.7402 },
    ipLocation: { latitude: 4.09, longitude: 9.74 },
    submissionMatchThresholdKm: 1,
    ipMatchThresholdKm: 50,
  });

  assert.equal(metadata?.submissionGpsMatch, null);
  assert.equal(metadata?.ipGpsMatch, null);
  assert.equal(metadata?.submissionDistanceKm, null);
  assert.equal(metadata?.exifStatus, 'missing');
});

test('fraud check stores secondary photo metadata when provided', () => {
  const primaryPhoto = buildPhotoFraudMetadata({
    extracted: {
      gps: { latitude: 4.0866, longitude: 9.7403 },
      capturedAt: '2026-02-20T10:00:00.000Z',
      deviceMake: 'Apple',
      deviceModel: 'iPhone 14',
      exifStatus: 'ok',
      exifReason: 'EXIF metadata parsed successfully',
      exifSource: 'upload_buffer',
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
      exifStatus: 'fallback_recovered',
      exifReason: 'Recovered EXIF metadata from stored photo URL',
      exifSource: 'remote_url',
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
  assert.equal(fraudCheck.secondaryPhoto?.exifStatus, 'fallback_recovered');
  assert.equal(fraudCheck.secondaryPhoto?.exifSource, 'remote_url');
});

test('photo metadata emptiness detection follows null-field rule', () => {
  const emptyMetadata = buildPhotoFraudMetadata({
    extracted: {
      gps: null,
      capturedAt: null,
      deviceMake: null,
      deviceModel: null,
      exifStatus: 'parse_error',
      exifReason: 'Unable to parse EXIF metadata from image bytes',
      exifSource: 'remote_url',
    },
    submissionLocation: { latitude: 4.0864, longitude: 9.7402 },
    ipLocation: null,
    submissionMatchThresholdKm: 1,
    ipMatchThresholdKm: 50,
  });

  assert.equal(isPhotoMetadataEffectivelyEmpty(emptyMetadata), true);
});

test('fraud check emptiness detection returns false when any metadata is available', () => {
  const primaryPhoto = buildPhotoFraudMetadata({
    extracted: {
      gps: { latitude: 4.0866, longitude: 9.7403 },
      capturedAt: null,
      deviceMake: null,
      deviceModel: null,
      exifStatus: 'ok',
      exifReason: 'EXIF metadata parsed successfully',
      exifSource: 'upload_buffer',
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
    secondaryPhoto: null,
    submissionMatchThresholdKm: 1,
    ipMatchThresholdKm: 50,
  });

  assert.equal(isFraudCheckEffectivelyEmpty(fraudCheck), false);
});

test('legacy fraud check without EXIF status fields still parses', () => {
  const parsed = parseSubmissionFraudCheck({
    submissionLocation: { latitude: 4.0864, longitude: 9.7402 },
    effectiveLocation: { latitude: 4.0864, longitude: 9.7402 },
    ipLocation: null,
    primaryPhoto: {
      gps: { latitude: 4.0866, longitude: 9.7403 },
      capturedAt: '2026-02-20T10:00:00.000Z',
      deviceMake: 'Apple',
      deviceModel: 'iPhone 14',
      submissionDistanceKm: 0.02,
      submissionGpsMatch: true,
      ipDistanceKm: null,
      ipGpsMatch: null
    },
    secondaryPhoto: null,
    submissionMatchThresholdKm: 1,
    ipMatchThresholdKm: 50
  });

  assert.ok(parsed);
  assert.equal(parsed?.primaryPhoto?.exifStatus, 'ok');
  assert.equal(parsed?.primaryPhoto?.exifSource, 'none');
});
