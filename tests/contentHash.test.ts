import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEventContentHash, computeExifTrustScore, computeImageSha256, hashIpIdentifier } from '../lib/server/submissionRisk.js';

test('computeImageSha256 returns deterministic hash', () => {
  const hashA = computeImageSha256(Buffer.from('abc123'));
  const hashB = computeImageSha256(Buffer.from('abc123'));
  const hashC = computeImageSha256(Buffer.from('abc124'));

  assert.equal(hashA, hashB);
  assert.notEqual(hashA, hashC);
  assert.equal(hashA.length, 64);
});

test('computeEventContentHash ignores volatile detail fields', () => {
  const base = computeEventContentHash({
    pointId: 'pharmacy-s16gdp-aaaa1111',
    category: 'pharmacy',
    eventType: 'CREATE_EVENT',
    location: { latitude: 4.0862, longitude: 9.7354 },
    details: {
      name: 'Pharmacie Bonamoussadi',
      openingHours: '08:00-20:00',
      reviewStatus: 'pending_review',
      riskScore: 81,
      fraudCheck: {
        submissionLocation: { latitude: 4.0862, longitude: 9.7354 },
        effectiveLocation: { latitude: 4.0862, longitude: 9.7354 },
        ipLocation: null,
        primaryPhoto: null,
        secondaryPhoto: null,
        submissionMatchThresholdKm: 1,
        ipMatchThresholdKm: 50,
      },
    },
  });

  const withoutVolatile = computeEventContentHash({
    pointId: 'pharmacy-s16gdp-aaaa1111',
    category: 'pharmacy',
    eventType: 'CREATE_EVENT',
    location: { latitude: 4.0862, longitude: 9.7354 },
    details: {
      name: 'Pharmacie Bonamoussadi',
      openingHours: '08:00-20:00',
    },
  });

  assert.equal(base, withoutVolatile);
});

test('computeExifTrustScore penalizes missing metadata and mitigates low-end device', () => {
  const fullScore = computeExifTrustScore({
    gps: { latitude: 4.0862, longitude: 9.7354 },
    capturedAt: '2026-03-04T08:30:00.000Z',
    deviceMake: 'Samsung',
    deviceModel: 'A15',
    isLowEnd: false,
  });
  const missingOnLowEnd = computeExifTrustScore({
    gps: null,
    capturedAt: null,
    deviceMake: null,
    deviceModel: null,
    isLowEnd: true,
  });

  assert.equal(fullScore, 100);
  assert.ok(missingOnLowEnd >= 20);
  assert.ok(missingOnLowEnd <= 50);
});

test('hashIpIdentifier returns stable non-raw identifier', () => {
  const ipHash = hashIpIdentifier('102.89.4.22');
  assert.equal(ipHash.length, 32);
  assert.equal(ipHash, hashIpIdentifier('102.89.4.22'));
  assert.notEqual(ipHash, hashIpIdentifier('102.89.4.23'));
});
