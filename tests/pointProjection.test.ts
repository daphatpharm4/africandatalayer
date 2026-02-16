import test from 'node:test';
import assert from 'node:assert/strict';
import { legacySubmissionToCreateEvent, projectPointsFromEvents } from '../lib/server/pointProjection.js';
import type { PointEvent } from '../shared/types.js';

test('projectPointsFromEvents merges CREATE and ENRICH events', () => {
  const createEvent: PointEvent = {
    id: 'evt-1',
    pointId: 'point-1',
    eventType: 'CREATE_EVENT',
    userId: 'u-1',
    category: 'fuel_station',
    location: { latitude: 4.0864, longitude: 9.7346 },
    details: {
      name: 'TOTAL Bonamoussadi 1',
      hasFuelAvailable: true
    },
    createdAt: '2026-02-16T10:00:00.000Z'
  };

  const enrichEvent: PointEvent = {
    id: 'evt-2',
    pointId: 'point-1',
    eventType: 'ENRICH_EVENT',
    userId: 'u-2',
    category: 'fuel_station',
    location: { latitude: 4.0864, longitude: 9.7346 },
    details: {
      fuelTypes: ['Super'],
      pricesByFuel: { Super: 845 },
      quality: 'Standard'
    },
    createdAt: '2026-02-16T11:00:00.000Z'
  };

  const projected = projectPointsFromEvents([createEvent, enrichEvent]);
  assert.equal(projected.length, 1);
  assert.equal(projected[0]?.pointId, 'point-1');
  assert.deepEqual(projected[0]?.details.fuelTypes, ['Super']);
  assert.deepEqual(projected[0]?.details.pricesByFuel, { Super: 845 });
  assert.equal(projected[0]?.eventsCount, 2);
});

test('legacySubmissionToCreateEvent preserves location and category', () => {
  const event = legacySubmissionToCreateEvent({
    id: 'legacy-1',
    userId: 'legacy-user',
    category: 'mobile_money',
    location: { latitude: 4.086, longitude: 9.7402 },
    details: { siteName: 'MTN Express Kiosk - Bonamoussadi', provider: 'MTN' },
    createdAt: '2026-02-16T09:00:00.000Z'
  });

  assert.equal(event.eventType, 'CREATE_EVENT');
  assert.equal(event.pointId, 'legacy-1');
  assert.equal(event.category, 'mobile_money');
  assert.equal(event.location.latitude, 4.086);
});
