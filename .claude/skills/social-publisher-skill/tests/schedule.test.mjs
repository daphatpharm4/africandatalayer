import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enqueue, listQueue, drainDue, cancelJob } from '../scripts/schedule.mjs';
import { createClock } from './helpers/mock-clock.mjs';

test('enqueue writes a JSON file named by scheduled time + slug', () => {
  const queueDir = mkdtempSync(join(tmpdir(), 'q-'));
  const clock = createClock('2026-05-14T10:00:00Z');
  const job = enqueue({
    queueDir,
    manifestPath: '/tmp/manifest.json',
    scheduledFor: '2026-05-15T08:30:00Z',
    options: { lang: 'en' },
    now: clock.now,
  });
  assert.match(job.id, /2026-05-15T08-30-00Z/);
  const files = readdirSync(queueDir);
  assert.equal(files.length, 1);
  rmSync(queueDir, { recursive: true });
});

test('listQueue returns all queued jobs sorted by scheduled time', () => {
  const queueDir = mkdtempSync(join(tmpdir(), 'q-'));
  const clock = createClock('2026-05-14T10:00:00Z');
  enqueue({
    queueDir,
    manifestPath: '/a.json',
    scheduledFor: '2026-05-16T08:00:00Z',
    options: {},
    now: clock.now,
  });
  enqueue({
    queueDir,
    manifestPath: '/b.json',
    scheduledFor: '2026-05-15T08:00:00Z',
    options: {},
    now: clock.now,
  });
  const jobs = listQueue({ queueDir });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].manifestPath, '/b.json');
  rmSync(queueDir, { recursive: true });
});

test('drainDue only runs jobs whose scheduledFor <= now', async () => {
  const queueDir = mkdtempSync(join(tmpdir(), 'q-'));
  const clock = createClock('2026-05-14T10:00:00Z');
  enqueue({
    queueDir,
    manifestPath: '/now.json',
    scheduledFor: '2026-05-14T09:00:00Z',
    options: {},
    now: clock.now,
  });
  enqueue({
    queueDir,
    manifestPath: '/future.json',
    scheduledFor: '2026-05-15T09:00:00Z',
    options: {},
    now: clock.now,
  });

  const fired = [];
  await drainDue({
    queueDir,
    now: clock.now,
    runner: async (job) => {
      fired.push(job.manifestPath);
      return { exitCode: 0 };
    },
  });
  assert.deepEqual(fired, ['/now.json']);
  const remaining = listQueue({ queueDir });
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].manifestPath, '/future.json');
  rmSync(queueDir, { recursive: true });
});

test('cancelJob removes job by id', () => {
  const queueDir = mkdtempSync(join(tmpdir(), 'q-'));
  const clock = createClock('2026-05-14T10:00:00Z');
  const job = enqueue({
    queueDir,
    manifestPath: '/a.json',
    scheduledFor: '2026-05-15T09:00:00Z',
    options: {},
    now: clock.now,
  });
  const ok = cancelJob({ queueDir, jobId: job.id });
  assert.equal(ok, true);
  assert.equal(listQueue({ queueDir }).length, 0);
  rmSync(queueDir, { recursive: true });
});
