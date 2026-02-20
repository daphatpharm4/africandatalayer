import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canViewEventDetail,
  filterEventsForViewer,
  redactEventUserIds,
  resolveAdminViewAccess,
  toSubmissionAuthContext,
} from '../lib/server/submissionAccess.js';
import type { PointEvent } from '../shared/types.js';

function makeEvent(id: string, userId: string): PointEvent {
  return {
    id,
    pointId: `point-${id}`,
    eventType: 'CREATE_EVENT',
    userId,
    category: 'pharmacy',
    location: { latitude: 4.0864, longitude: 9.7402 },
    details: { name: `Site ${id}` },
    createdAt: '2026-02-20T10:00:00.000Z',
  };
}

const events: PointEvent[] = [
  makeEvent('event-1', 'alice@example.com'),
  makeEvent('event-2', 'bob@example.com'),
];

test('view=events unauthenticated redacts userId', () => {
  const redacted = redactEventUserIds(events);
  assert.equal(redacted.length, 2);
  assert.equal('userId' in redacted[0], false);
});

test('view=events non-admin only sees own events', () => {
  const viewer = toSubmissionAuthContext({ id: 'alice@example.com', token: { isAdmin: false } });
  assert.ok(viewer);
  const visible = filterEventsForViewer(events, viewer!);
  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.id, 'event-1');
});

test('view=events admin sees all events', () => {
  const viewer = toSubmissionAuthContext({ id: 'admin@example.com', token: { isAdmin: true } });
  assert.ok(viewer);
  const visible = filterEventsForViewer(events, viewer!);
  assert.equal(visible.length, events.length);
});

test('view=admin_events rejects non-admin users', () => {
  const viewer = toSubmissionAuthContext({ id: 'alice@example.com', token: { isAdmin: false } });
  const access = resolveAdminViewAccess(viewer);
  assert.equal(access, 'forbidden');
});

test('single event details are restricted to owner unless admin', () => {
  const owner = toSubmissionAuthContext({ id: 'alice@example.com', token: { isAdmin: false } });
  const stranger = toSubmissionAuthContext({ id: 'charlie@example.com', token: { isAdmin: false } });
  const admin = toSubmissionAuthContext({ id: 'admin@example.com', token: { isAdmin: true } });

  assert.ok(owner);
  assert.ok(stranger);
  assert.ok(admin);

  assert.equal(canViewEventDetail(events[0]!, owner!), true);
  assert.equal(canViewEventDetail(events[0]!, stranger!), false);
  assert.equal(canViewEventDetail(events[0]!, admin!), true);
});
