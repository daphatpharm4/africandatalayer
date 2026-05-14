import {
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const defaultQueueDir = join(here, '..', 'queue');

function jobIdFor(scheduledFor, slug) {
  const stamp = scheduledFor.replace(/[:.]/g, '-');
  return slug ? `${stamp}__${slug}` : stamp;
}

export function enqueue({
  queueDir = defaultQueueDir,
  manifestPath,
  scheduledFor,
  options,
  slug,
  now = () => new Date().toISOString(),
}) {
  if (!existsSync(queueDir)) mkdirSync(queueDir, { recursive: true });
  const id = jobIdFor(scheduledFor, slug);
  const job = { id, manifestPath, scheduledFor, options, enqueuedAt: now() };
  writeFileSync(join(queueDir, `${id}.json`), JSON.stringify(job, null, 2));
  return job;
}

export function listQueue({ queueDir = defaultQueueDir } = {}) {
  if (!existsSync(queueDir)) return [];
  return readdirSync(queueDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(queueDir, f), 'utf8')))
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

export function cancelJob({ queueDir = defaultQueueDir, jobId }) {
  const path = join(queueDir, `${jobId}.json`);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

export async function drainDue({
  queueDir = defaultQueueDir,
  now = () => new Date().toISOString(),
  runner,
}) {
  const jobs = listQueue({ queueDir });
  const nowIso = now();
  const due = jobs.filter((j) => j.scheduledFor <= nowIso);
  const results = [];
  for (const job of due) {
    const result = await runner(job);
    if (result.exitCode === 0 || result.exitCode === 4) {
      unlinkSync(join(queueDir, `${job.id}.json`));
    }
    results.push({ job, result });
  }
  return results;
}

export async function runQueueCommand(args) {
  const subcommand = args[0];
  if (subcommand === 'list') {
    const jobs = listQueue();
    for (const j of jobs) {
      console.log(`${j.id}  →  ${j.manifestPath}  (scheduled ${j.scheduledFor})`);
    }
    return 0;
  }
  if (subcommand === 'cancel') {
    const ok = cancelJob({ jobId: args[1] });
    return ok ? 0 : 1;
  }
  if (subcommand === 'run') {
    const { runPublish } = await import('./publish.mjs');
    const results = await drainDue({
      runner: async (job) =>
        runPublish({
          manifestPath: job.manifestPath,
          env: process.env,
          options: job.options,
        }),
    });
    console.log(`drained ${results.length} job(s)`);
    return 0;
  }
  if (subcommand === 'purge') {
    const queueDir = defaultQueueDir;
    let removed = 0;
    for (const f of readdirSync(queueDir)) {
      if (!f.endsWith('.json')) continue;
      unlinkSync(join(queueDir, f));
      removed++;
    }
    console.log(`purged ${removed} job(s)`);
    return 0;
  }
  console.error(`unknown queue subcommand: ${subcommand}`);
  return 1;
}
