# ADL Cloud Engineering: Implementation Playbook
## Bonamoussadi, Douala, Cameroon

**Teammate 4 -- Cloud Engineer Deliverable**
**Date:** March 2026

---

## Table of Contents

1. [Tooling Inventory](#1-tooling-inventory)
2. [Deployment Approach](#2-deployment-approach)
3. [Observability Stack](#3-observability-stack)
4. [Runbooks](#4-runbooks)
5. [Implementation Roadmap](#5-implementation-roadmap)
6. [Developer Experience](#6-developer-experience)

---

## Existing System Baseline

Before prescribing anything new, here is what is already running and what we are working with:

| Layer | Technology | File(s) |
|---|---|---|
| **Build** | Vite 6 + React 19 + TypeScript 5.8 | `vite.config.ts`, `tsconfig.json` |
| **API** | Vercel Serverless Functions | `api/**/*.ts` (12 route files) |
| **Database** | Neon PostgreSQL via `pg` driver | `lib/server/db.ts` |
| **File Storage** | Vercel Blob | `@vercel/blob` in `package.json` |
| **Auth** | `@auth/core` + Google OAuth + bcrypt | `api/auth/*.ts`, `lib/auth.ts` |
| **Offline Queue** | IndexedDB | `lib/client/offlineQueue.ts` |
| **Sync** | Custom flush engine | `lib/client/submissionSync.ts` |
| **Fraud Detection** | EXIF + haversine + IP | `lib/server/submissionFraud.ts` |
| **Cron** | Vercel Cron (weekly snapshot) | `vercel.json` |
| **Analytics** | `@vercel/analytics` + `@vercel/speed-insights` | `package.json` |
| **Tests** | Node.js built-in `node:test` | `tests/*.test.ts` (8 test files) |
| **CI/CD** | Vercel Git Integration (GitHub) | `.vercel/project.json` |
| **Deployment** | Vercel (project: `africandatalayer`, team: `team_lhlb001Ry6zDHLXyOSt59ga3`) | Auto-deploy on push to `main` |

**Key observation:** There is no linter, no formatter, no CI pipeline beyond Vercel's auto-build, no staging environment, no monitoring beyond page-level analytics, and no test runner in CI. The test files use `node:test` but there is no `test` script in `package.json`. This playbook addresses all of these gaps.

---

## 1. Tooling Inventory

### 1.1 Development Tools

| Tool | Purpose | Cost | Why Chosen |
|---|---|---|---|
| **VS Code** | Primary IDE | Free | Team already uses it; TypeScript support is best-in-class; extensions for Vite, ESLint, Prettier, Tailwind |
| **ESLint 9** | Linting | Free | Catches bugs early; enforces consistent code style; flat config format for simplicity |
| **Prettier 3** | Code formatting | Free | Eliminates formatting debates; integrates with ESLint; format-on-save in VS Code |
| **TypeScript 5.8** | Type checking | Free (already installed) | Already in use; `--noEmit` for type-checking without build; catches type errors at dev time |
| **Biome** (alternative) | Linting + formatting | Free | Faster than ESLint + Prettier combined; single tool; consider if team prefers speed over ecosystem |

### 1.2 Testing Frameworks

| Tool | Purpose | Cost | Why Chosen |
|---|---|---|---|
| **Node.js `node:test`** | Unit tests | Free (already in use) | Already 8 test files written; zero dependencies; built into Node 20+; sufficient for pure logic tests |
| **Vitest** | Unit + integration tests | Free | If `node:test` becomes limiting: same config as Vite, instant HMR, watch mode, coverage reports; drop-in for existing tests |
| **Playwright** | E2E tests (Phase 2) | Free | Cross-browser; mobile emulation for PWA testing; network throttling for offline-first testing; Vercel integration |

### 1.3 CI/CD Pipeline Tools

| Tool | Purpose | Cost | Why Chosen |
|---|---|---|---|
| **GitHub Actions** | CI pipeline | Free (2,000 min/month) | Repository is on GitHub; tight integration; matrix builds for Node versions; artifact storage for test reports |
| **Vercel CLI** | Preview deployments | Free (included in Pro) | Already the deployment target; preview URLs per PR; environment promotion |
| **Vercel Git Integration** | Production deployment | Free (already configured) | Auto-deploy on push to `main`; zero config; rollback via dashboard |

### 1.4 Monitoring and Alerting Tools

| Tool | Purpose | Cost | Why Chosen |
|---|---|---|---|
| **Sentry** | Error tracking + performance | Free (5K events/month) | Client-side + server-side; source maps; breadcrumbs for offline queue debugging; release tracking |
| **Vercel Analytics** | Page-level performance | Included in Pro ($20/mo) | Already integrated; Web Vitals; real-user monitoring |
| **Vercel Speed Insights** | Core Web Vitals | Included in Pro | Already integrated |
| **Better Uptime / UptimeRobot** | Uptime monitoring | Free tier | External health check on `/api/health`; SMS/email alerts on downtime; 5-minute intervals |
| **Vercel Logs** | Request-level logs | Included in Pro | Serverless function logs; request tracing; tail in real-time via CLI |
| **pg_stat_statements** | Database query analysis | Free (Neon built-in) | Identify slow queries; track query frequency; available in Neon dashboard |

### 1.5 Database Management Tools

| Tool | Purpose | Cost | Why Chosen |
|---|---|---|---|
| **Neon Console** | Database GUI + branching | Free | Already the database provider; SQL editor; schema viewer; branching for safe migrations |
| **pgAdmin / DBeaver** | Local database GUI | Free | For complex query development; schema visualization; export capabilities |
| **pg_dump / pg_restore** | Backup and restore | Free (CLI) | Weekly backups to Vercel Blob; disaster recovery; already recommended by Cloud Architect |
| **Neon Branching** | Migration testing | Free | Create a branch of production database; test migrations without risk; merge or discard |

### 1.6 Deployment Tools

| Tool | Purpose | Cost | Why Chosen |
|---|---|---|---|
| **Vercel CLI (`vercel`)** | Manual deploys, env management | Free | `vercel env pull` for local `.env`; `vercel deploy --prod` for manual production deploys; `vercel logs --follow` for debugging |
| **GitHub CLI (`gh`)** | PR and release management | Free | Create PRs, manage releases, trigger workflows from terminal |

### 1.7 Total Tooling Cost

| Category | Monthly Cost |
|---|---|
| Development tools | $0 |
| Testing tools | $0 |
| CI/CD (GitHub Actions) | $0 |
| Monitoring (Sentry free + UptimeRobot free) | $0 |
| Hosting (Vercel Pro) | $20 |
| Database (Neon Free) | $0 |
| **Total** | **$20/month** |

---

## 2. Deployment Approach

### 2.1 Environment Setup

```
ENVIRONMENT TOPOLOGY
═════════════════════

┌─────────────────────────────────────────────────────────┐
│                    GITHUB REPOSITORY                     │
│                    main branch                           │
│                                                         │
│  Push to main ──────► Vercel Production Deploy          │
│                       URL: africandatalayer.vercel.app   │
│                       DB:  Neon main branch              │
│                                                         │
│  Push to staging ───► Vercel Preview Deploy             │
│  (or PR to main)     URL: staging-adl.vercel.app        │
│                       DB:  Neon staging branch           │
│                                                         │
│  Push to feature/* ─► Vercel Preview Deploy             │
│                       URL: {branch}-adl.vercel.app      │
│                       DB:  Neon dev branch               │
│                                                         │
│  Local dev ─────────► vite dev server (localhost:5173)  │
│                       DB:  Neon dev branch               │
│                       API: Vercel Dev (localhost:3000)   │
│                       or: proxy to staging               │
└─────────────────────────────────────────────────────────┘
```

**Step-by-step environment setup:**

```bash
# 1. Create Git branches
git checkout -b staging
git push -u origin staging

# 2. Create Neon database branches
#    In Neon console: Project > Branches > Create Branch
#    - Branch "staging" from "main" (production snapshot)
#    - Branch "dev" from "staging"
#    Each branch gets its own connection string.

# 3. Configure Vercel environments
#    In Vercel Dashboard > Project > Settings > Environment Variables:

# Production (main branch):
vercel env add ADL_POSTGRES_URL production
# Paste: postgres://...@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require

# Preview (all non-main branches):
vercel env add ADL_POSTGRES_URL preview
# Paste: postgres://...@ep-yyy.us-east-1.aws.neon.tech/neondb?sslmode=require

# 4. Configure branch-specific preview deployments
#    In Vercel Dashboard > Project > Settings > Git:
#    - Production Branch: main
#    - Preview Branches: staging, feature/*

# 5. Pull environment for local development
vercel env pull .env.local
```

**Environment variable matrix:**

| Variable | Production | Staging | Development |
|---|---|---|---|
| `ADL_POSTGRES_URL` | Neon main branch | Neon staging branch | Neon dev branch |
| `AUTH_SECRET` | Unique per env | Unique per env | Unique per env |
| `GOOGLE_CLIENT_ID` | Production OAuth app | Same (localhost in redirect URIs) | Same |
| `GOOGLE_CLIENT_SECRET` | Production secret | Same | Same |
| `GEMINI_API_KEY` | Shared | Shared | Shared |
| `BLOB_READ_WRITE_TOKEN` | Production store | Staging store (separate) | Dev store |
| `SENTRY_DSN` | Production DSN | Staging DSN | Empty (disabled) |
| `NODE_ENV` | production | production | development |

### 2.2 Infrastructure as Code

Since ADL uses Vercel's managed platform, traditional IaC (Terraform/Pulumi) is unnecessary for compute and networking. Instead, we codify configuration declaratively:

**vercel.json (enhanced):**

```jsonc
{
  "framework": "vite",
  "buildCommand": "vite build",
  "devCommand": "vite",
  "outputDirectory": "dist",
  "crons": [
    {
      "path": "/api/analytics?view=cron",
      "schedule": "0 3 * * 1"
    },
    {
      "path": "/api/road-snapshot",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/monthly-rollup",
      "schedule": "0 4 1 * *"
    },
    {
      "path": "/api/backup",
      "schedule": "0 2 * * 0"
    }
  ],
  "headers": [
    {
      "source": "/api/submissions",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" }
      ]
    },
    {
      "source": "/api/analytics",
      "headers": [
        { "key": "Cache-Control", "value": "public, s-maxage=300, stale-while-revalidate=600" }
      ]
    },
    {
      "source": "/api/data/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, s-maxage=60, stale-while-revalidate=300" }
      ]
    },
    {
      "source": "/api/health",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache" }
      ]
    }
  ],
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 30
    },
    "api/backup.ts": {
      "maxDuration": 60
    }
  }
}
```

**Database migrations as code:**

Instead of Terraform for Neon, we use plain SQL migration files versioned in Git:

```
migrations/
├── 001_initial_schema.sql          (existing tables: point_events, snapshots, etc.)
├── 002_add_content_hash.sql        (ALTER TABLE point_events ADD content_hash)
├── 003_add_collection_assignments.sql
├── 004_add_api_keys.sql
├── 005_add_monthly_stats.sql
└── 006_add_review_flags.sql
```

**Migration runner script (`scripts/migrate.mjs`):**

```javascript
#!/usr/bin/env node
// scripts/migrate.mjs
// Usage: node scripts/migrate.mjs [--dry-run]

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.ADL_POSTGRES_URL || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  // Create migrations tracking table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Get already-applied migrations
  const { rows: applied } = await pool.query(
    'SELECT filename FROM _migrations ORDER BY filename'
  );
  const appliedSet = new Set(applied.map(r => r.filename));

  // Read migration files
  const migrationsDir = join(import.meta.dirname, '..', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`SKIP  ${file} (already applied)`);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    console.log(`${DRY_RUN ? 'WOULD APPLY' : 'APPLY'}  ${file}`);

    if (!DRY_RUN) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`FAILED  ${file}: ${err.message}`);
        process.exit(1);
      } finally {
        client.release();
      }
    }
  }

  console.log(`\nDone. ${count} migration(s) applied.`);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

**Sample migration file (`migrations/002_add_content_hash.sql`):**

```sql
-- 002_add_content_hash.sql
-- Adds content hash for server-side deduplication (ADR-008)

ALTER TABLE point_events
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_point_events_content_hash
  ON point_events (content_hash)
  WHERE content_hash IS NOT NULL;

-- Add review flag columns
ALTER TABLE point_events
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'auto_approved',
  ADD COLUMN IF NOT EXISTS review_flags TEXT[] DEFAULT '{}';

COMMENT ON COLUMN point_events.content_hash IS 'SHA-256 hash for dedup (category+point_id+event_type+coords+details)';
COMMENT ON COLUMN point_events.review_status IS 'auto_approved | pending_review | approved | rejected';
COMMENT ON COLUMN point_events.review_flags IS 'Array of flags: gps_mismatch, potential_duplicate, late_submission, low_confidence, anomaly';
```

**Sample migration file (`migrations/003_add_collection_assignments.sql`):**

```sql
-- 003_add_collection_assignments.sql
-- Zone-based field agent assignment tracking

CREATE TABLE IF NOT EXISTS collection_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  zone_id TEXT NOT NULL,
  zone_bounds JSONB NOT NULL,
  assigned_verticals TEXT[] NOT NULL,
  due_date DATE NOT NULL,
  points_expected INTEGER DEFAULT 0,
  points_collected INTEGER DEFAULT 0,
  status TEXT DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'in_progress', 'completed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_user
  ON collection_assignments (user_id, status);

CREATE INDEX IF NOT EXISTS idx_assignments_zone
  ON collection_assignments (zone_id, status);
```

### 2.3 Database Migration Strategy

```
MIGRATION WORKFLOW
═══════════════════

  Developer writes migration
       │
       ▼
  Test on Neon dev branch
       │
       ▼
  PR to staging branch
       │
       ▼
  GitHub Actions runs:
    1. Create Neon branch from staging
    2. Run migration on branch
    3. Run tests against branch
    4. If pass: merge PR, run migration on staging
    5. Delete temporary Neon branch
       │
       ▼
  PR from staging to main
       │
       ▼
  Production deploy:
    1. GitHub Action runs migration on Neon main branch
    2. Vercel deploys new code
    3. Code handles both old and new schema (backward compatible)
```

**Rules for safe migrations:**

1. **Always additive.** Never DROP columns or tables in the same release as code changes. Use a two-phase approach: (a) deploy code that stops using the column, (b) drop the column in the next release.
2. **Always with defaults.** New columns must have DEFAULT values so existing rows are valid.
3. **Always idempotent.** Use `IF NOT EXISTS` and `IF EXISTS` so migrations can be re-run safely.
4. **Always tested.** Run `node scripts/migrate.mjs --dry-run` before applying.
5. **Never break reads.** The Vercel deployment is zero-downtime (atomic swap), but the database migration runs before the new code deploys. The old code must be able to read from the new schema.

### 2.4 Deployment Strategy: Blue/Green via Vercel

Vercel provides atomic deployments by default. Every deploy creates a new immutable deployment URL. The production alias (`africandatalayer.vercel.app`) is atomically swapped to point to the new deployment only after the build succeeds. This is effectively blue/green deployment.

```
DEPLOYMENT FLOW
════════════════

  git push origin main
       │
       ▼
  Vercel Build Phase
    1. Install dependencies (npm ci)
    2. Run build (vite build)
    3. Bundle API functions
    4. If build fails: STOP (old deployment stays live)
       │
       ▼
  Vercel Deploy Phase
    1. Upload static assets to CDN
    2. Deploy serverless functions
    3. Atomic alias swap: production URL → new deployment
    4. Old deployment stays available at its unique URL
       │
       ▼
  Post-Deploy Verification
    1. GitHub Action hits /api/health on new deployment
    2. If health check fails: alert on Slack/email
    3. Manual rollback if needed
```

**Rollback procedure:**

```bash
# Option 1: Vercel Dashboard
# Go to Deployments > find the last good deployment > "..." > "Promote to Production"

# Option 2: Vercel CLI
vercel ls                          # List recent deployments
vercel promote <deployment-url>    # Promote a specific deployment to production

# Option 3: Git revert (creates new deployment)
git revert HEAD
git push origin main
```

**Rollback decision criteria:**
- `/api/health` returns non-200 for > 2 minutes after deploy
- Sentry error rate increases > 5x compared to pre-deploy baseline
- Field agents report inability to submit data
- Dashboard shows zero new submissions for > 30 minutes during active collection hours (08:00-18:00 WAT)

### 2.5 Secret Management

```
SECRET MANAGEMENT
══════════════════

WHERE SECRETS LIVE:
  1. Vercel Environment Variables (primary)
     - Set via Dashboard or CLI: vercel env add <KEY> <environment>
     - Encrypted at rest
     - Injected into serverless function runtime
     - Scoped per environment (production, preview, development)

  2. .env.local (local development only)
     - Created by: vercel env pull .env.local
     - In .gitignore (already)
     - Never committed to Git

  3. GitHub Actions Secrets (CI only)
     - For: NEON_API_KEY (database branching in CI)
     - For: VERCEL_TOKEN (deployment verification)
     - For: SENTRY_AUTH_TOKEN (source map upload)
     - Set via: GitHub > Settings > Secrets and Variables > Actions

SECRETS INVENTORY:
  ┌──────────────────────────┬──────────────────────────────────────┐
  │ Secret                   │ Where Used                           │
  ├──────────────────────────┼──────────────────────────────────────┤
  │ ADL_POSTGRES_URL         │ Vercel env, .env.local               │
  │ AUTH_SECRET              │ Vercel env, .env.local               │
  │ GOOGLE_CLIENT_ID         │ Vercel env, .env.local               │
  │ GOOGLE_CLIENT_SECRET     │ Vercel env, .env.local               │
  │ GEMINI_API_KEY           │ Vercel env, .env.local               │
  │ BLOB_READ_WRITE_TOKEN   │ Vercel env, .env.local               │
  │ EDGE_CONFIG              │ Vercel env, .env.local               │
  │ EDGE_CONFIG_ID           │ Vercel env, .env.local               │
  │ VERCEL_API_TOKEN         │ Vercel env, .env.local               │
  │ ADMIN_EMAIL              │ Vercel env, .env.local               │
  │ ADMIN_PASSWORD           │ Vercel env, .env.local               │
  │ SENTRY_DSN               │ Vercel env (new)                     │
  │ SENTRY_AUTH_TOKEN        │ GitHub Actions secret (new)          │
  │ NEON_API_KEY             │ GitHub Actions secret (new)          │
  └──────────────────────────┴──────────────────────────────────────┘

ROTATION SCHEDULE:
  - AUTH_SECRET:           Rotate every 90 days
  - ADMIN_PASSWORD:        Rotate every 90 days
  - API keys (client):     Rotate on request or annually
  - Database passwords:    Rotate via Neon console (generates new connection string)
  - All others:            Rotate on suspected compromise
```

---

## 3. Observability Stack

### 3.1 Application Metrics

```
METRICS TO TRACK
═════════════════

CATEGORY: FIELD AGENT SYNC HEALTH
──────────────────────────────────
Metric                          Source              Alert Threshold
────────────────────────────────────────────────────────────────────
sync_success_rate               Sentry + custom     < 90% over 1 hour
sync_latency_p95                Custom middleware    > 5s (excludes network)
queue_depth_per_agent           Client telemetry    > 50 items pending
failed_submissions_permanent    API response codes  > 5 in 1 hour
photo_upload_success_rate       API logs            < 85% over 24 hours
photo_upload_latency_p95        API logs            > 30s
offline_queue_age_max           Client telemetry    > 48 hours
idempotency_dedup_rate          API logs            > 20% (agents retrying excessively)
bandwidth_class_distribution    Client telemetry    (informational, no alert)

CATEGORY: DATA QUALITY PIPELINE
────────────────────────────────
Metric                          Source              Alert Threshold
────────────────────────────────────────────────────────────────────
review_queue_depth              Database query      > 50 pending items
review_queue_age_max            Database query      > 72 hours oldest item
fraud_flag_rate                 API middleware      > 15% of submissions
geofence_rejection_rate         API middleware      > 10% of submissions
duplicate_detection_rate        Content hash        > 10% (agents re-submitting)
anomaly_alert_count             Snapshot engine     > 0 per weekly run (notify admin)
data_completeness_score         Snapshot engine     < 60% avg across verticals

CATEGORY: API PERFORMANCE
─────────────────────────
Metric                          Source              Alert Threshold
────────────────────────────────────────────────────────────────────
api_response_time_p95           Vercel Analytics    > 3s for GET, > 5s for POST
api_error_rate_5xx              Vercel Logs         > 1% of requests
api_error_rate_4xx              Vercel Logs         > 20% of requests
cron_execution_success          Vercel Cron logs    Any failure
snapshot_engine_duration        Custom logging      > 60s (approaching timeout)
database_query_time_p95         pg middleware       > 2s

CATEGORY: STORAGE
─────────────────
Metric                          Source              Alert Threshold
────────────────────────────────────────────────────────────────────
database_size_mb                Neon dashboard      > 400 MB (80% of free tier)
blob_storage_gb                 Vercel dashboard    > 4 GB (80% of Pro limit)
event_count_total               Database query      (informational)
photo_count_total               Database query      (informational)
```

### 3.2 Infrastructure Metrics

```
INFRASTRUCTURE MONITORING
══════════════════════════

VERCEL PLATFORM
  Monitored automatically by Vercel:
    - Build success/failure
    - Function invocation count
    - Function duration (avg, p95, max)
    - Function memory usage
    - Bandwidth consumption
    - Edge cache hit rate

  Access: Vercel Dashboard > Project > Analytics
  Export: Vercel REST API (for custom dashboards)

NEON POSTGRESQL
  Monitored via Neon Console:
    - Active connections (max 20 on Free tier)
    - Compute hours consumed (max 190/month on Free)
    - Storage used (max 0.5 GB on Free)
    - Query latency (via pg_stat_statements)
    - Connection errors

  Access: Neon Console > Project > Monitoring

EXTERNAL UPTIME
  Monitored via UptimeRobot (free tier):
    - GET /api/health every 5 minutes
    - Alert via email + webhook on failure
    - Response time tracking
    - SSL certificate expiry warning
```

### 3.3 Log Aggregation Strategy

```
LOG ARCHITECTURE
═════════════════

TIER 1: STRUCTURED APPLICATION LOGS (Vercel Serverless Logs)
────────────────────────────────────────────────────────────
  Where:     console.log/warn/error in API functions
  Retention: 1 hour (Vercel Pro) — sufficient for debugging live issues
  Format:    Structured JSON for machine parsing

  Logging standard for all API routes:

    // At the start of every API handler:
    console.log(JSON.stringify({
      event: 'api_request',
      method: req.method,
      path: req.url,
      userId: session?.userId || 'anonymous',
      userAgent: req.headers.get('user-agent'),
      ts: new Date().toISOString(),
    }));

    // On success:
    console.log(JSON.stringify({
      event: 'api_response',
      path: req.url,
      status: 200,
      durationMs: Date.now() - startTime,
      ts: new Date().toISOString(),
    }));

    // On error:
    console.error(JSON.stringify({
      event: 'api_error',
      path: req.url,
      status: 500,
      error: err.message,
      code: err.code,
      stack: err.stack,
      ts: new Date().toISOString(),
    }));

  Access: vercel logs --follow
  Search: Vercel Dashboard > Logs (filter by function, status, time range)

TIER 2: ERROR TRACKING (Sentry)
────────────────────────────────
  Where:     Client-side (React) + Server-side (API functions)
  Retention: 90 days (free tier)
  What:      Unhandled exceptions, handled errors, performance transactions

  Client-side integration:

    // lib/client/sentry.ts
    import * as Sentry from '@sentry/browser';

    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_COMMIT_SHA,
      tracesSampleRate: 0.1,    // 10% of transactions for performance
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.1,
      beforeSend(event) {
        // Strip PII: do not send user GPS coordinates as breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.filter(
            b => !b.data?.latitude && !b.data?.longitude
          );
        }
        return event;
      },
    });

  Server-side integration:

    // lib/server/sentry.ts
    import * as Sentry from '@sentry/node';

    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.VERCEL_ENV || 'development',
      tracesSampleRate: 0.2,
    });

    export function captureApiError(err: Error, context?: Record<string, unknown>) {
      Sentry.captureException(err, { extra: context });
    }

TIER 3: AUDIT LOG (Database)
─────────────────────────────
  Where:     PostgreSQL table for compliance with Cameroon Law 2024/017
  Retention: 2 years
  What:      Admin actions (approve/reject/merge/delete), data exports, login events

  CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX idx_audit_log_actor ON audit_log (actor_id, created_at DESC);
  CREATE INDEX idx_audit_log_action ON audit_log (action, created_at DESC);
```

### 3.4 Alerting Rules and Thresholds

```
ALERTING CONFIGURATION
═══════════════════════

CHANNEL SETUP:
  1. Email: ops@africandatalayer.com (team distribution list)
  2. Slack/WhatsApp: #adl-alerts channel (for real-time awareness)
  3. SMS: +237 XXX XXX XXX (on-call engineer, critical only)

ALERT DEFINITIONS:

CRITICAL (page on-call, immediate response):
─────────────────────────────────────────────
Alert: API_DOWN
  Condition: /api/health returns non-200 for 3 consecutive checks (15 min)
  Source:    UptimeRobot
  Action:    Check Vercel status, check Neon status, check DNS
  Notify:    SMS + Slack + Email

Alert: DATABASE_UNREACHABLE
  Condition: StorageUnavailableError rate > 50% of requests over 5 minutes
  Source:    Sentry error grouping
  Action:    Check Neon console, check connection pool, check compute hours
  Notify:    SMS + Slack + Email

Alert: ZERO_SUBMISSIONS
  Condition: No POST /api/submissions in 4 hours during 08:00-18:00 WAT on weekdays
  Source:    Custom cron check (query point_events count)
  Action:    Check if agents are deployed, check sync health, contact field supervisor
  Notify:    Slack + Email


WARNING (investigate within 4 hours):
──────────────────────────────────────
Alert: HIGH_ERROR_RATE
  Condition: 5xx error rate > 5% of requests over 30 minutes
  Source:    Vercel Analytics / Sentry
  Action:    Review Vercel logs, check recent deployments, check database
  Notify:    Slack + Email

Alert: SYNC_DEGRADATION
  Condition: Photo upload success rate < 80% over 24 hours
  Source:    Custom metric (count photo_url IS NOT NULL vs total events)
  Action:    Check Vercel Blob, check network conditions in Douala
  Notify:    Slack + Email

Alert: REVIEW_QUEUE_BACKLOG
  Condition: > 50 items in review queue or oldest item > 72 hours
  Source:    Custom cron check (query point_events WHERE review_status = 'pending_review')
  Action:    Notify admin to process queue
  Notify:    Email

Alert: STORAGE_APPROACHING_LIMIT
  Condition: Neon storage > 400 MB or Vercel Blob > 4 GB
  Source:    Weekly cron check
  Action:    Plan upgrade or archival
  Notify:    Email

Alert: CRON_FAILURE
  Condition: Weekly snapshot cron fails (non-200 response)
  Source:    Vercel Cron logs
  Action:    Check snapshot engine, check database, re-run manually
  Notify:    Slack + Email


INFORMATIONAL (daily digest):
──────────────────────────────
Alert: DAILY_SUMMARY
  Condition: Sent at 19:00 WAT daily
  Content:   Submissions today, photos uploaded, sync failures, review queue depth,
             active agents, top contributing agent
  Source:    Custom cron job
  Notify:    Email
```

### 3.5 Dashboard Designs

**Dashboard 1: Operations Overview (for engineering team)**

```
┌─────────────────────────────────────────────────────────────────┐
│  ADL Operations Dashboard                        Last 24 hours  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ API Uptime   │  │ Submissions  │  │ Error Rate   │          │
│  │   99.8%      │  │   47 today   │  │   0.3%       │          │
│  │   ▲ 0.1%     │  │   ▲ 12%     │  │   ▼ 0.1%     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Photos       │  │ Sync Success │  │ Review Queue │          │
│  │   38 / 47    │  │   94.2%      │  │   7 pending  │          │
│  │   80.9%      │  │   ▲ 2.1%     │  │   ▼ 3        │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  API Response Time (p95)          │  Submissions by Hour        │
│  ┌─────────────────────────────┐  │  ┌─────────────────────┐   │
│  │     2.1s                    │  │  │ ████                │   │
│  │    ╱    ╲                   │  │  │ ██████████          │   │
│  │   ╱      ╲   1.4s          │  │  │ ████████████████    │   │
│  │  ╱        ╲─╱   ╲          │  │  │ ██████████████      │   │
│  │ ╱                 ╲  0.9s  │  │  │ ██████████          │   │
│  │╱                    ╲─     │  │  │ ████████            │   │
│  │ 06  08  10  12  14  16  18 │  │  │ 06 08 10 12 14 16  │   │
│  └─────────────────────────────┘  │  └─────────────────────┘   │
│                                                                 │
│  Database: 67 MB / 500 MB         │  Blob: 312 MB / 5 GB       │
│  ████████░░░░░░░░░░░░░ 13%        │  ██████░░░░░░░░░░░░░ 6%    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Dashboard 2: Field Agent Sync Health (for field supervisors)**

```
┌─────────────────────────────────────────────────────────────────┐
│  Field Agent Sync Monitor                   Bonamoussadi Pilot  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Agent           Last Sync    Queue  Photos  Status             │
│  ──────────────────────────────────────────────────────────────  │
│  Kouam J.        5 min ago    0      12/12   ● Online           │
│  Ngo M.          12 min ago   3      8/10    ● Syncing          │
│  Talla P.        2 hours ago  15     4/7     ● Degraded         │
│  Fouda E.        6 hours ago  28     0/5     ● Offline          │
│  Mbarga L.       1 day ago    0      20/20   ● Last seen 18:00  │
│  Ndongo S.       3 min ago    1      15/16   ● Online           │
│                                                                 │
│  Sync Success Rate (7 days)   │  Queue Depth Distribution       │
│  ┌─────────────────────────┐  │  ┌─────────────────────────┐   │
│  │ 100% ─ ─ ─ ─ ─ ─ ─ ─  │  │  │ 0-5:    ████████ 12     │   │
│  │  95% ──────────────────  │  │  │ 6-15:   ████ 3          │   │
│  │  90% ─ ─ ─────────────  │  │  │ 16-30:  ██ 2            │   │
│  │  85% ─ ─ ─ ─ ─ ─ ─ ─  │  │  │ 31+:    █ 1             │   │
│  │ Mon Tue Wed Thu Fri Sat │  │  └─────────────────────────┘   │
│  └─────────────────────────┘  │                                 │
│                                                                 │
│  Connection Quality Today:     │  Photo Upload Failures:        │
│  4G:  ████████ 45%             │  Network timeout:  3           │
│  3G:  ██████████ 40%           │  File too large:   1           │
│  2G:  ████ 12%                 │  Server error:     0           │
│  Off: █ 3%                     │  Total failures:   4 / 47 (8%) │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Dashboard 3: Data Quality Pipeline (for data managers)**

```
┌─────────────────────────────────────────────────────────────────┐
│  Data Quality Pipeline                         Week of 2026-03  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Vertical        Points  New  Changed  Completeness  Anomalies  │
│  ────────────────────────────────────────────────────────────    │
│  Mobile Money    142     +8   22       78%           0          │
│  Pharmacy        32      +2   5        85%           1 ⚠        │
│  Fuel Station    8       +1   2        92%           0          │
│  Alcohol Outlet  95      +12  18       65%           0          │
│  Billboard       41      +3   8        71%           0          │
│  Transport Road  56      +4   31       80%           2 ⚠        │
│  Census Proxy    127     +6   15       55%           0          │
│                                                                 │
│  Review Queue:                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ⚠ Pharmacy near Carrefour - potential duplicate (82% sim)  │ │
│  │ ⚠ Road segment R-014 - GPS mismatch (450m from photo GPS) │ │
│  │ ⚠ Transport Road - unusual 31 changes (z-score 2.4)       │ │
│  │ ● 4 more items pending review                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Fraud Detection:                                                │
│  Submissions checked:  312                                       │
│  GPS match pass:       289 (92.6%)                              │
│  Geofence pass:        308 (98.7%)                              │
│  Flagged for review:   23 (7.4%)                                │
│  Confirmed fraud:      2 (0.6%)                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.6 Implementing the Metrics Collection

Since ADL runs on Vercel serverless functions (no persistent process), metrics collection is done through:

1. **Sentry transactions** for performance metrics (automatic with SDK)
2. **Structured console.log** for custom metrics (parsed in Vercel Logs)
3. **Database queries** for data quality metrics (run by cron jobs)
4. **Custom telemetry endpoint** for client-side metrics

```typescript
// api/telemetry/index.ts (NEW)
// Receives client-side sync metrics from field agents

export async function POST(req: Request): Promise<Response> {
  const body = await req.json();

  // Validate telemetry payload
  const { agentId, metrics } = body;
  if (!agentId || !metrics) {
    return new Response('Invalid payload', { status: 400 });
  }

  // Store in database for dashboard queries
  // Using point_events-style append-only pattern
  await query(
    `INSERT INTO agent_telemetry
     (agent_id, metric_type, value, metadata, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [agentId, metrics.type, metrics.value, JSON.stringify(metrics.metadata)]
  );

  return new Response('OK', { status: 200 });
}
```

```typescript
// lib/client/telemetry.ts (NEW)
// Sends sync health metrics to server

export async function reportSyncMetrics(metrics: {
  queueDepth: number;
  photosPending: number;
  connectionClass: string;
  syncSuccessCount: number;
  syncFailureCount: number;
  oldestQueueItemAge: number; // minutes
}) {
  // Best-effort: do not block the sync loop
  try {
    await fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: getCurrentUserId(),
        metrics: {
          type: 'sync_health',
          value: metrics.queueDepth,
          metadata: metrics,
        },
      }),
    });
  } catch {
    // Silently ignore telemetry failures
  }
}

// Call every 5 minutes from the sync loop
```

---

## 4. Runbooks

### Runbook 1: Field Agent Cannot Sync Data

```
RUNBOOK: FIELD AGENT SYNC FAILURE
═══════════════════════════════════

SYMPTOMS:
  - Agent reports "pending" items not clearing
  - Sync status shows orange/red indicator
  - Queue depth growing over time
  - Agent dashboard shows stale data

DIAGNOSIS STEPS:

  Step 1: Determine scope
    - Is it one agent or all agents?
    - Check: Vercel Dashboard > Analytics > recent requests from Cameroon
    - If ALL agents affected: likely infrastructure issue → jump to Step 4
    - If ONE agent: likely device/network issue → continue

  Step 2: Check agent's sync status
    - Ask agent to tap the sync indicator and screenshot the detail panel
    - Look for:
      - Connection class (2G/3G/4G/Offline)
      - Queue depth
      - Last successful sync timestamp
      - Any "failed" items with error messages

  Step 3: Check agent's error messages
    - If "Outside Bonamoussadi geofence":
      Agent is physically outside the pilot zone. Data will be rejected.
      Resolution: Agent must be within the bounding box (4.0755-4.0999 N, 9.7185-9.7602 E)

    - If "invalid GPS" or fraud flag:
      Agent's phone GPS may be inaccurate or spoofed.
      Resolution: Ask agent to enable high-accuracy GPS mode, go outside for clear sky,
      wait 30 seconds, try again.

    - If "Network error" or "timeout":
      Connectivity issue. Continue to Step 5.

    - If "413 Payload Too Large":
      Photo is too big even after compression.
      Resolution: Check if compression is working. Agent should restart the app.

  Step 4: Check infrastructure health
    curl -s https://africandatalayer.vercel.app/api/health | jq .
    Expected: { "status": "ok", "db": "ok", "ts": "..." }

    If status is "error":
      - Check Vercel status: https://www.vercel-status.com/
      - Check Neon status: https://neonstatus.com/
      - If Vercel is down: wait for recovery. Offline queue will catch up.
      - If Neon is down: wait for recovery. Reads fall back to Edge Config.

  Step 5: Network issues
    - Cameroon network congestion is common, especially:
      - 12:00-14:00 (lunch hour peak)
      - 18:00-20:00 (evening peak)
      - During heavy rain (cell tower interference)
    - Resolution:
      a. Agent continues capturing offline (data is safe in IndexedDB)
      b. Agent syncs from a location with better connectivity later
      c. If persistent: agent syncs from WiFi at the team office

  Step 6: Force sync from better connection
    - Agent goes to team office or WiFi hotspot
    - Opens app, taps sync indicator, taps "Force Sync Now"
    - Watches queue depth decrease
    - If items still fail: screenshot error and escalate

RESOLUTION:
  - If infrastructure: wait for provider recovery + verify auto-catch-up
  - If agent device: clear app cache, restart, retry
  - If persistent: factory reset PWA (clear site data in Chrome)

ESCALATION:
  Level 1: Field supervisor (network/device issues)
  Level 2: Engineering team (infrastructure issues)
  Level 3: Vercel/Neon support (platform outages)

RECOVERY VERIFICATION:
  - Agent's queue depth returns to 0
  - New submissions appear in admin dashboard
  - Run: SELECT COUNT(*) FROM point_events WHERE user_id = '<agent_id>'
    AND created_at > NOW() - INTERVAL '1 hour'
```

### Runbook 2: Photo Upload Failures

```
RUNBOOK: PHOTO UPLOAD FAILURES
════════════════════════════════

SYMPTOMS:
  - Events created in point_events but photo_url is NULL
  - Photo upload success rate drops below 85%
  - Agents report "photo pending" status
  - Dashboard photos section shows broken images

DIAGNOSIS STEPS:

  Step 1: Quantify the problem
    SQL query:
    SELECT
      DATE(created_at) AS day,
      COUNT(*) AS total_events,
      COUNT(photo_url) AS with_photo,
      ROUND(COUNT(photo_url)::numeric / COUNT(*) * 100, 1) AS photo_pct
    FROM point_events
    WHERE created_at > NOW() - INTERVAL '7 days'
      AND source = 'field_agent'
    GROUP BY DATE(created_at)
    ORDER BY day DESC;

    Healthy: > 85% photo attachment rate
    Problem: < 70% photo attachment rate

  Step 2: Check Vercel Blob storage
    - Vercel Dashboard > Storage > Blob
    - Check: is storage approaching the 5 GB limit?
    - Check: are there recent failed uploads in the logs?

    If storage is full:
      Resolution: Archive old photos, upgrade plan, or migrate to Cloudflare R2

  Step 3: Check photo sizes
    SQL query:
    SELECT
      AVG(LENGTH(photo_url)) AS avg_url_length,
      COUNT(CASE WHEN photo_url IS NOT NULL THEN 1 END) AS uploaded,
      COUNT(CASE WHEN photo_url IS NULL AND source = 'field_agent' THEN 1 END) AS missing
    FROM point_events
    WHERE created_at > NOW() - INTERVAL '24 hours';

    Check Vercel logs for rejected uploads:
    vercel logs --filter "413\|payload\|too large" --since 24h

    If photos are being rejected for size:
      Resolution: Verify client-side compression is working.
      Check: Is the compression config using quality 0.7 and max 1280px?

  Step 4: Check network conditions
    - Photo uploads require 3G+ connectivity (Priority 3 in sync engine)
    - If most agents are on 2G, photos will be queued indefinitely
    - Check agent telemetry for connection class distribution

    If persistent 2G:
      Resolution: Lower photo quality to 0.5, reduce max dimension to 800px,
      or allow photo upload on 2G for small files (< 200KB)

  Step 5: Check for Vercel Blob API errors
    Vercel Dashboard > Logs > filter by "blob" or "upload"
    Common errors:
      - 403: Token expired or invalid → rotate BLOB_READ_WRITE_TOKEN
      - 500: Vercel Blob service issue → check Vercel status page
      - Timeout: Network too slow → photos will retry automatically

RESOLUTION:
  - Storage full: archive + upgrade
  - Compression broken: fix client code, deploy
  - Network: adjust quality settings, batch uploads to WiFi windows
  - Token issue: rotate BLOB_READ_WRITE_TOKEN in Vercel env vars

ESCALATION:
  Level 1: Engineering team (code/config issues)
  Level 2: Vercel support (platform issues)
```

### Runbook 3: Database Performance Degradation

```
RUNBOOK: DATABASE PERFORMANCE DEGRADATION
═══════════════════════════════════════════

SYMPTOMS:
  - API response times spike (> 3s p95)
  - /api/health returns slowly or times out
  - Sentry shows StorageUnavailableError increase
  - Dashboard fails to load or loads partially
  - Snapshot engine cron fails or times out

DIAGNOSIS STEPS:

  Step 1: Check Neon dashboard
    - Neon Console > Project > Monitoring
    - Check: Active connections (max 20 on free tier)
    - Check: Compute hours consumed (max 190/month)
    - Check: CPU and memory usage

    If compute hours exhausted:
      Resolution: Upgrade to Launch plan ($19/mo) or wait for month reset.
      Neon suspends compute after 190 hours on free tier.

    If too many connections:
      Resolution: Check POSTGRES_POOL_MAX (currently 5).
      Reduce if multiple preview deployments are sharing the same branch.
      Kill idle connections: SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE state = 'idle' AND query_start < NOW() - INTERVAL '10 minutes';

  Step 2: Identify slow queries
    SQL query (if pg_stat_statements is enabled):
    SELECT query, calls, mean_exec_time, total_exec_time
    FROM pg_stat_statements
    ORDER BY mean_exec_time DESC
    LIMIT 10;

    Common slow query patterns:
    - Full table scan on point_events without index
    - Snapshot engine projecting all events (expected to be slow at scale)
    - Missing index on new columns (e.g., review_status, content_hash)

  Step 3: Check table sizes
    SELECT relname, pg_size_pretty(pg_total_relation_size(oid))
    FROM pg_class
    WHERE relkind = 'r'
    ORDER BY pg_total_relation_size(oid) DESC;

    If point_events > 50MB: consider partitioning by year
    If snapshots > 100MB: archive old snapshots to Vercel Blob

  Step 4: Check index health
    SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
    FROM pg_stat_user_indexes
    ORDER BY idx_scan ASC;

    Unused indexes: drop to save space
    Missing indexes: add based on slow query analysis

  Step 5: Neon cold start
    Neon free tier suspends compute after 5 minutes of inactivity.
    First query after suspension takes 1-3 seconds (cold start).
    This is expected behavior, not a bug.

    If cold starts cause problems:
      Resolution: Add a keep-alive query in the health check cron,
      or upgrade to Neon Launch ($19/mo) for always-on compute.

RESOLUTION:
  - Compute hours exhausted: upgrade plan
  - Connection pool exhaustion: reduce pool size, kill idle connections
  - Slow queries: add indexes, optimize queries
  - Cold start: keep-alive cron or upgrade
  - Table bloat: VACUUM ANALYZE, archival

ESCALATION:
  Level 1: Engineering team (query optimization)
  Level 2: Neon support (platform issues)
```

### Runbook 4: Supabase/Neon Outage

```
RUNBOOK: DATABASE OUTAGE (NEON)
════════════════════════════════

SYMPTOMS:
  - /api/health returns { "status": "error", "db": "error" }
  - All API POST requests fail with 503
  - API GET requests may still work (Edge Config fallback)
  - Sentry floods with StorageUnavailableError

DIAGNOSIS STEPS:

  Step 1: Confirm outage
    - Check Neon status page: https://neonstatus.com/
    - Check Vercel status page: https://www.vercel-status.com/
    - Run: curl -s https://africandatalayer.vercel.app/api/health | jq .

  Step 2: Verify fallback is active
    - The Edge Config fallback (edgeFallbackStore.ts) should automatically
      serve read requests from cached seed data.
    - Verify: API GET endpoints return data (even if stale).
    - Write operations (POST /api/submissions) will fail — this is expected.

  Step 3: Communicate to field team
    - Notify field supervisor: "Database maintenance in progress.
      Agents can continue capturing. Data is saved locally and will
      sync automatically when service resumes."
    - Agents' offline queues will accumulate submissions.

  Step 4: Monitor recovery
    - Watch Neon status page for resolution
    - When resolved, run: curl -s .../api/health | jq .
    - Expect a burst of sync traffic as all agents flush their queues

  Step 5: Post-recovery verification
    - Check for data loss:
      SELECT COUNT(*), MIN(created_at), MAX(created_at)
      FROM point_events
      WHERE created_at > NOW() - INTERVAL '24 hours';

    - Check for duplicate submissions (idempotency keys should prevent these):
      SELECT idempotency_key, COUNT(*)
      FROM point_events
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY idempotency_key
      HAVING COUNT(*) > 1;

    - Re-run snapshot engine if outage spanned a Monday cron:
      curl -s "https://africandatalayer.vercel.app/api/analytics?view=cron"

RESOLUTION:
  - Neon planned maintenance: wait for completion (usually < 30 min)
  - Neon unplanned outage: wait for provider recovery
  - If outage > 4 hours: consider emergency database restore from backup

ESCALATION:
  Level 1: Engineering team (verify fallback, communicate to field)
  Level 2: Neon support (open ticket)
  Level 3: Restore from backup (if data loss suspected)
```

### Runbook 5: Data Quality Alert (Anomalous Submissions)

```
RUNBOOK: DATA QUALITY ANOMALY
═══════════════════════════════

SYMPTOMS:
  - Snapshot engine detects z-score > 2 for a vertical
  - Unusual spike in new/removed/changed entities
  - Admin dashboard shows anomaly warning badge
  - Example: "Mobile money: 15 agents removed this week (z-score 3.1)"

DIAGNOSIS STEPS:

  Step 1: Identify the anomaly
    SQL query:
    SELECT vertical_id, metric, value, z_score, direction
    FROM snapshot_stats
    WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM snapshot_stats)
      AND ABS(z_score) > 2
    ORDER BY ABS(z_score) DESC;

  Step 2: Determine if anomaly is real or data error
    Check recent events for the affected vertical:
    SELECT user_id, event_type, COUNT(*), MIN(created_at), MAX(created_at)
    FROM point_events
    WHERE category = '<affected_vertical>'
      AND created_at > NOW() - INTERVAL '7 days'
    GROUP BY user_id, event_type
    ORDER BY COUNT(*) DESC;

    Red flags:
    - One agent submitted > 50% of the changes (possible fraud or error)
    - All changes in a 10-minute window (possible bulk upload error)
    - All changes have identical details (copy-paste submissions)

  Step 3: Cross-reference with field reality
    - Contact field supervisor: "Did something unusual happen in Bonamoussadi
      this week? Municipal crackdown? New business openings? Seasonal change?"
    - Check: is it rainy season? (flooding can close many road segments at once)
    - Check: was there a regulatory event? (e.g., pharmacy inspection closing informal sellers)

  Step 4: Resolve
    If REAL anomaly (confirmed by field supervisor):
      - Accept the data
      - Add context note to the snapshot_stats record
      - Adjust z-score baseline if this is a new normal

    If DATA ERROR (one agent submitted bad data):
      - Flag the agent's submissions for review
      - Use admin review queue to approve/reject individually
      - If systematic fraud: deactivate agent, investigate

    If SYSTEM ERROR (bug in snapshot engine):
      - Check snapshot engine logs
      - Re-run snapshot: curl "...api/analytics?view=cron"
      - Fix bug, deploy

RESOLUTION:
  - Real anomaly: document and accept
  - Data error: review and correct via admin queue
  - System error: fix and re-run

ESCALATION:
  Level 1: Data manager (anomaly review)
  Level 2: Field supervisor (ground truth verification)
  Level 3: Engineering team (system errors)
```

### Runbook 6: New Vertical Onboarding

```
RUNBOOK: ADDING A NEW DATA VERTICAL
═════════════════════════════════════

CONTEXT: Adding a new vertical (e.g., "water_point", "school", "clinic")
to the ADL platform.

STEPS:

  Step 1: Define the vertical schema (Data team)
    - Add to shared/verticals.ts:
      {
        id: 'water_point',
        labelEn: 'Water Point',
        labelFr: 'Point d\'eau',
        emoji: '💧',
        createRequiredFields: ['name', 'waterType'],
        enrichableFields: ['isActive', 'waterQuality', 'operatingHours'],
        allFields: ['name', 'waterType', 'isActive', 'waterQuality',
                    'operatingHours', 'provider', 'isFree'],
      }

  Step 2: Update type definitions
    - Add to shared/types.ts: new detail interface for the vertical
    - Add to the VerticalId union type

  Step 3: Update geofence (if needed)
    - If the vertical operates in a different area, update shared/geofence.ts
    - Usually: same Bonamoussadi bounding box applies

  Step 4: Add UI components
    - Add vertical icon to components/shared/VerticalIcon.tsx
    - Add capture form fields to ContributionFlow.tsx
    - Add to filter options in Home.tsx, Analytics.tsx, DeltaDashboard.tsx

  Step 5: Update snapshot engine
    - lib/server/snapshotEngine.ts: add vertical to snapshot projection
    - lib/server/pointProjection.ts: add validation rules for new fields
    - Verify: does projectPointsFromEvents() handle the new category?

  Step 6: Write tests
    - Add validation tests to tests/submissionsValidation.test.ts
    - Test: createRequiredFields are enforced
    - Test: enrichableFields are validated
    - Test: snapshot projection includes new vertical

  Step 7: Database migration (if new columns needed)
    - Usually: no migration needed (JSONB details field handles new data)
    - If new indexed field: add migration file

  Step 8: Deploy
    - Create PR: feature/add-water-point-vertical
    - CI runs tests
    - Preview deployment for QA
    - Merge to staging, verify
    - Merge to main, deploy to production

  Step 9: Train field agents
    - Update capture training materials
    - Brief field supervisor on new vertical requirements
    - Assign zones for new vertical collection

  Step 10: Verify data flow
    - Submit test data for new vertical
    - Verify it appears in dashboard
    - Verify snapshot engine includes it in weekly run
    - Verify delta computation works

ESTIMATED EFFORT: 2-3 developer days
RISK: Low (JSONB schema is flexible; no database migration usually needed)
```

### Runbook 7: New City/Zone Expansion

```
RUNBOOK: EXPANDING TO A NEW CITY OR ZONE
══════════════════════════════════════════

CONTEXT: Expanding data collection from Bonamoussadi to a new area
(e.g., Akwa in Douala, or Yaounde).

STEPS:

  Step 1: Define new geofence
    - Determine bounding box for the new zone
    - Add to shared/geofence.ts:

      export const ZONES = {
        bonamoussadi: {
          minLat: 4.0755, maxLat: 4.0999,
          minLng: 9.7185, maxLng: 9.7602,
          label: 'Bonamoussadi',
        },
        akwa: {
          minLat: 4.0400, maxLat: 4.0600,
          minLng: 9.6900, maxLng: 9.7200,
          label: 'Akwa',
        },
      };

      export function isWithinAnyZone(coords: { latitude: number; longitude: number }): string | null {
        for (const [zoneId, bounds] of Object.entries(ZONES)) {
          if (coords.latitude >= bounds.minLat && coords.latitude <= bounds.maxLat &&
              coords.longitude >= bounds.minLng && coords.longitude <= bounds.maxLng) {
            return zoneId;
          }
        }
        return null;
      }

  Step 2: Update API geofence validation
    - api/submissions/index.ts: replace isWithinBonamoussadi() with isWithinAnyZone()
    - Return the zone_id in the response for client-side zone awareness

  Step 3: Seed data for new zone
    - Run OSM Overpass query for the new bounding box:
      [out:json][timeout:25];
      area["name"="Akwa"]->.searchArea;
      (
        node["amenity"~"pharmacy|fuel|bank"](area.searchArea);
        node["shop"~"alcohol|kiosk"](area.searchArea);
      );
      out body;
    - Import via: node scripts/import-bonamoussadi-csv.mjs (renamed to import-osm-data.mjs)

  Step 4: Create zone assignments
    - Use admin API to create assignments for field agents in the new zone
    - Assign verticals based on zone characteristics

  Step 5: Database considerations
    - No schema changes needed (zone_id derived from coordinates)
    - Add zone_id column to point_events if query filtering by zone becomes slow:
      ALTER TABLE point_events ADD COLUMN zone_id TEXT;
      CREATE INDEX idx_point_events_zone ON point_events (zone_id, created_at);

  Step 6: Infrastructure scaling
    - Check: Does the current infrastructure handle 2x data volume?
    - Neon free tier: 0.5 GB. With two zones: may need upgrade to Launch ($19/mo)
    - Vercel: bandwidth may increase. Monitor usage.
    - Vercel Blob: photo storage doubles. Monitor against 5 GB limit.

  Step 7: Update dashboards
    - Add zone filter to all dashboard views
    - Add zone-specific metrics and comparisons
    - Update the Leaflet map default center and zoom to include new zone

  Step 8: Recruit and train field agents
    - Recruit agents who know the new zone
    - Provide the same training as Bonamoussadi pilot
    - Assign zone-specific mobile data bundles

  Step 9: Deploy and verify
    - Deploy geofence update
    - Test with submissions from new zone
    - Verify snapshot engine processes both zones
    - Verify delta computation separates or aggregates by zone

ESTIMATED EFFORT: 1-2 developer weeks
DEPENDENCIES: Field team recruitment for new zone
RISK: Medium (scaling may hit free tier limits; new zone may have different
      network conditions requiring sync engine tuning)
```

---

## 5. Implementation Roadmap

### Phase 1: Pilot Infrastructure (Weeks -2 to 0, before pilot launch)

**Goal:** Make the existing system production-ready for a 6-week pilot with 10-20 field agents in Bonamoussadi.

| Task | Description | Effort | Dependency | Risk |
|---|---|---|---|---|
| **P1.1** Set up CI pipeline | GitHub Actions: lint, typecheck, test on PR | 1 day | None | Low |
| **P1.2** Add ESLint + Prettier | Configure linting and formatting rules | 0.5 day | None | Low |
| **P1.3** Add `test` script to package.json | `"test": "node --test tests/*.test.ts"` with TypeScript loader | 0.5 day | None | Low |
| **P1.4** Integrate Sentry | Client-side + server-side error tracking | 1 day | None | Low |
| **P1.5** Set up staging environment | Neon staging branch + Vercel preview config | 1 day | None | Low |
| **P1.6** Create migration framework | `scripts/migrate.mjs` + initial migration files | 1 day | P1.5 | Low |
| **P1.7** Run database migrations | `content_hash`, `collection_assignments`, `api_keys`, `monthly_stats` tables | 0.5 day | P1.6 | Medium |
| **P1.8** Add structured logging | Consistent JSON logging in all API routes | 1 day | None | Low |
| **P1.9** Set up uptime monitoring | UptimeRobot on `/api/health` with email alerts | 0.5 day | None | Low |
| **P1.10** Add enhanced cron jobs | Daily road snapshot, monthly rollup, weekly backup | 1 day | P1.7 | Low |
| **P1.11** Add `vercel.json` headers | Cache-Control headers for API routes | 0.5 day | None | Low |
| **P1.12** Write operational runbooks | Document in `docs/runbooks/` (markdown) | 1 day | None | Low |
| **P1.13** Create `.env.example` update | Add new env vars (SENTRY_DSN, etc.) | 0.5 day | P1.4 | Low |

**Phase 1 total estimated effort:** 10 developer-days (2 weeks for 1 developer)

**Phase 1 deliverables:**
- CI pipeline running on every PR
- Sentry error tracking in production
- Staging environment with separate database
- Database migration framework
- Uptime monitoring with alerts
- Operational runbooks documented

### Phase 2: Production Hardening (Weeks 1-3 of pilot)

**Goal:** Harden the system based on real-world pilot data. Fix issues discovered during first week of field operations.

| Task | Description | Effort | Dependency | Risk |
|---|---|---|---|---|
| **P2.1** Enhance offline queue | Add priority levels, photo staging store, local POI cache | 3 days | P1.7 | Medium |
| **P2.2** Add bandwidth-aware sync | Navigator.connection API + HEAD probe + priority filtering | 2 days | P2.1 | Medium |
| **P2.3** Build sync status UI | Persistent indicator + detail panel (as designed by Cloud Architect) | 2 days | P2.1 | Low |
| **P2.4** Add content-hash dedup | Server-side SHA-256 dedup on submissions | 1 day | P1.7 | Low |
| **P2.5** Build admin review queue | API endpoints + UI for flagged submissions | 3 days | P1.7 | Medium |
| **P2.6** Build client data API | `/api/data/*` endpoints with API key auth | 2 days | P1.7 | Medium |
| **P2.7** Add client telemetry | `/api/telemetry` endpoint + client-side metrics collection | 1 day | P2.2 | Low |
| **P2.8** Build ops dashboard | Grafana-like view using Recharts (already in deps) | 3 days | P2.7 | Medium |
| **P2.9** Weekly backup automation | Cron-triggered `pg_dump` to Vercel Blob | 1 day | P1.10 | Low |
| **P2.10** Tune sync engine | Adjust timeouts, backoff, compression based on field data | 2 days | P2.2 | Medium |
| **P2.11** Add E2E test skeleton | Playwright setup with mobile viewport + offline simulation | 2 days | P1.1 | Low |

**Phase 2 total estimated effort:** 22 developer-days (3 weeks for 1-2 developers)

**Phase 2 deliverables:**
- Bandwidth-aware offline sync with priority levels
- Admin review queue for flagged submissions
- Client-facing data API with API key authentication
- Operations dashboard
- Automated weekly database backups
- E2E test framework

### Phase 3: Scale-Ready Infrastructure (Weeks 4-6 of pilot + post-pilot)

**Goal:** Prepare for expansion beyond Bonamoussadi. Multi-zone support, performance optimization, cost efficiency.

| Task | Description | Effort | Dependency | Risk |
|---|---|---|---|---|
| **P3.1** Multi-zone geofence | Replace single bounding box with zone registry | 2 days | None | Low |
| **P3.2** Zone-based assignments | Update assignment system for multi-zone | 1 day | P3.1 | Low |
| **P3.3** Dashboard zone filtering | Add zone selector to all dashboards | 2 days | P3.1 | Low |
| **P3.4** Database partitioning | Partition point_events by created_at (yearly) | 2 days | None | Medium |
| **P3.5** Photo archival pipeline | Compress old photos to thumbnails, move originals to cold storage | 2 days | None | Medium |
| **P3.6** Cloudflare R2 migration | Migrate photo storage from Vercel Blob to R2 (if > 5 GB) | 3 days | P3.5 | Medium |
| **P3.7** API rate limiting | Per-client rate limits for data consumer API | 1 day | P2.6 | Low |
| **P3.8** Audit logging | Compliance logging for Cameroon Law 2024/017 | 2 days | None | Low |
| **P3.9** Load testing | Simulate 100+ agents, 1000+ daily submissions | 2 days | P3.4 | Low |
| **P3.10** Native app evaluation | Decision on PWA vs React Native based on pilot feedback | 3 days | None | Medium |
| **P3.11** Neon upgrade evaluation | Determine if free tier is sufficient or upgrade needed | 0.5 day | None | Low |
| **P3.12** Performance optimization | Index tuning, query optimization based on real workload | 2 days | P3.9 | Medium |

**Phase 3 total estimated effort:** 22.5 developer-days (3-4 weeks for 1-2 developers)

**Phase 3 deliverables:**
- Multi-zone support ready for new city expansion
- Database partitioned for long-term growth
- Photo storage cost-optimized
- Load tested for 10x scale
- Decision document on native app migration
- Audit logging for regulatory compliance

### Implementation Timeline

```
TIMELINE (14 weeks total)
══════════════════════════

Week -2  │ P1: CI, linting, Sentry, staging env
Week -1  │ P1: Migrations, monitoring, runbooks, cron
─────────┼──────────────────────────────────────────
Week 1   │ PILOT STARTS │ P2: Enhanced offline queue, bandwidth sync
Week 2   │              │ P2: Admin review queue, sync status UI
Week 3   │              │ P2: Data API, telemetry, ops dashboard
Week 4   │              │ P2: Backup automation, sync tuning, E2E tests
Week 5   │              │ P3: Multi-zone geofence, partitioning
Week 6   │ PILOT ENDS   │ P3: Photo archival, R2 eval, load testing
─────────┼──────────────────────────────────────────
Week 7-8 │ POST-PILOT   │ P3: Native app eval, audit logging, optimization
```

---

## 6. Developer Experience

### 6.1 Local Development Setup Guide

```bash
# ═══════════════════════════════════════════════════
# ADL Local Development Setup
# ═══════════════════════════════════════════════════

# Prerequisites:
# - Node.js 20+ (recommended: install via nvm)
# - Git
# - VS Code (recommended)
# - Vercel CLI

# 1. Clone the repository
git clone https://github.com/<org>/africandatalayer.git
cd africandatalayer

# 2. Install dependencies
npm install

# 3. Install Vercel CLI (if not already installed)
npm install -g vercel

# 4. Link to Vercel project
vercel link
# Select: "Link to existing project"
# Project: africandatalayer

# 5. Pull environment variables
vercel env pull .env.local
# This creates .env.local with all required secrets for local development.
# The database URL will point to the Neon dev branch.

# 6. Start the development server
npm run dev
# Frontend: http://localhost:5173
# API proxy: localhost:5173/api/* → Vercel dev server

# Alternative: run with Vercel dev for full serverless function emulation
vercel dev
# This runs both frontend and API functions locally, matching production behavior.

# 7. Run tests
npm test
# Runs all tests in tests/*.test.ts using Node.js built-in test runner

# 8. Run type checking
npx tsc --noEmit
# Type-checks all TypeScript files without emitting output

# 9. Run linting (after P1.2 is complete)
npx eslint .
npx prettier --check .

# 10. Run database migrations against dev branch
ADL_POSTGRES_URL="<dev-branch-url>" node scripts/migrate.mjs

# ═══════════════════════════════════════════════════
# Common development tasks
# ═══════════════════════════════════════════════════

# Seed test data
npm run seed:submissions

# Import OSM data for Bonamoussadi
npm run import:bonamoussadi

# Backfill EXIF fraud data
npm run backfill:exif

# View Vercel logs in real-time
vercel logs --follow

# Deploy preview (without pushing to Git)
vercel deploy

# Open Neon console for SQL queries
# https://console.neon.tech/ > select project > select dev branch > SQL Editor
```

**VS Code recommended extensions (`.vscode/extensions.json`):**

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

**VS Code workspace settings (`.vscode/settings.json`):**

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.exclude": {
    "node_modules": true,
    "dist": true
  }
}
```

### 6.2 Testing Strategy

```
TESTING PYRAMID
════════════════

         ┌──────────┐
         │   E2E    │  Playwright (Phase 2)
         │  ~10     │  Critical user flows
         │  tests   │  Mobile viewport + offline
         ├──────────┤
         │          │
         │ Integra- │  Node.js test runner
         │  tion    │  API endpoint tests
         │  ~30     │  Database interaction
         │  tests   │  Sync engine tests
         ├──────────┤
         │          │
         │  Unit    │  Node.js test runner (existing)
         │  ~50+    │  Pure function tests
         │  tests   │  Validation, projection, geofence
         │          │  fraud detection, identifier gen
         └──────────┘
```

**Unit tests (existing + additions):**

```
tests/
├── submissionsValidation.test.ts    (existing - geofence, validation)
├── submissionFraud.test.ts          (existing - fraud detection)
├── submissionVisibility.test.ts     (existing - access control)
├── pointProjection.test.ts          (existing - event projection)
├── identifierNormalization.test.ts  (existing - ID generation)
├── deviceProfile.test.ts            (existing - device fingerprinting)
├── importBonamoussadiCsv.test.ts    (existing - CSV import)
├── aiSearchApi.test.ts              (existing - Gemini integration)
├── contentHash.test.ts              (NEW - dedup hash computation)
├── priorityQueue.test.ts            (NEW - sync priority ordering)
├── photoCompression.test.ts         (NEW - compression config)
├── bandwidthDetection.test.ts       (NEW - connection classification)
├── zoneGeofence.test.ts             (NEW - multi-zone geofence)
└── deltaComputation.test.ts         (NEW - snapshot delta logic)
```

**Integration tests (new):**

```
tests/integration/
├── submissionApi.test.ts            (POST + GET /api/submissions)
├── analyticsApi.test.ts             (GET /api/analytics)
├── healthApi.test.ts                (GET /api/health)
├── reviewQueue.test.ts              (admin review workflow)
├── dataExport.test.ts               (CSV + GeoJSON export)
├── snapshotEngine.test.ts           (full snapshot cycle)
└── migrationRunner.test.ts          (migration idempotency)
```

**E2E tests (Phase 2, Playwright):**

```
e2e/
├── login.spec.ts                    (email/password login flow)
├── submission.spec.ts               (create POI with photo)
├── offline-sync.spec.ts             (capture offline, sync when online)
├── admin-review.spec.ts             (review flagged submission)
├── dashboard.spec.ts                (analytics dashboard loads)
└── mobile-viewport.spec.ts          (responsive design on 360x640)
```

**Add to `package.json`:**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --import tsx --test tests/*.test.ts",
    "test:watch": "node --import tsx --test --watch tests/*.test.ts",
    "test:integration": "node --import tsx --test tests/integration/*.test.ts",
    "test:e2e": "npx playwright test",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "migrate": "node scripts/migrate.mjs",
    "migrate:dry": "node scripts/migrate.mjs --dry-run",
    "seed:submissions": "node scripts/seed-edge-submissions.mjs",
    "import:bonamoussadi": "node scripts/import-bonamoussadi-csv.mjs",
    "migrate:edge-to-postgres": "node scripts/migrate-edge-config-to-postgres.mjs",
    "backfill:exif": "node scripts/backfill-fraud-exif.mjs"
  }
}
```

### 6.3 CI/CD Pipeline

**GitHub Actions workflow (`.github/workflows/ci.yml`):**

```yaml
name: CI

on:
  pull_request:
    branches: [main, staging]
  push:
    branches: [main, staging]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx eslint .
      - run: npx prettier --check .
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
        env:
          ADL_POSTGRES_URL: ${{ secrets.NEON_TEST_DATABASE_URL }}

  build:
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/

  verify-deploy:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Wait for Vercel deployment
        run: sleep 60

      - name: Health check
        run: |
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            https://africandatalayer.vercel.app/api/health)
          if [ "$STATUS" != "200" ]; then
            echo "Health check failed with status $STATUS"
            exit 1
          fi
          echo "Health check passed"

  upload-sourcemaps:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: build
          path: dist/
      - name: Upload source maps to Sentry
        run: |
          npx @sentry/cli sourcemaps upload \
            --org adl \
            --project africandatalayer \
            --release ${{ github.sha }} \
            dist/assets/
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
```

**Migration CI (`.github/workflows/migrate.yml`):**

```yaml
name: Database Migration

on:
  push:
    branches: [staging]
    paths:
      - 'migrations/**'

jobs:
  migrate-staging:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Dry run migration
        run: node scripts/migrate.mjs --dry-run
        env:
          ADL_POSTGRES_URL: ${{ secrets.NEON_STAGING_DATABASE_URL }}
      - name: Apply migration
        run: node scripts/migrate.mjs
        env:
          ADL_POSTGRES_URL: ${{ secrets.NEON_STAGING_DATABASE_URL }}
```

### 6.4 Code Review and Merge Process

```
CODE REVIEW PROCESS
═════════════════════

BRANCHING MODEL:
  main        ← production (auto-deploys to Vercel)
  staging     ← staging (preview deployment, migration testing)
  feature/*   ← feature branches (preview deployments)
  fix/*       ← bug fix branches
  chore/*     ← maintenance branches

PR WORKFLOW:

  1. Developer creates feature branch from staging
     git checkout staging && git pull
     git checkout -b feature/add-bandwidth-sync

  2. Developer pushes and creates PR to staging
     git push -u origin feature/add-bandwidth-sync
     gh pr create --base staging --title "Add bandwidth-aware sync engine"

  3. CI runs automatically:
     - Lint check (ESLint)
     - Format check (Prettier)
     - Type check (tsc --noEmit)
     - Unit tests
     - Build verification
     - Vercel preview deployment

  4. Code review requirements:
     - At least 1 approval required
     - All CI checks must pass
     - No merge conflicts
     - Preview deployment tested for visual regression

  5. Merge to staging:
     - Squash and merge (clean history)
     - Delete feature branch
     - If migration files present: migration runs on staging DB

  6. Staging verification:
     - Test on staging preview URL
     - Verify new functionality works
     - Check Sentry for new errors

  7. PR from staging to main:
     - Create PR: staging → main
     - Abbreviated review (already reviewed in step 4)
     - Merge (regular merge commit to preserve staging history)
     - Vercel auto-deploys to production

  8. Post-deploy verification:
     - Health check (automated in CI)
     - Monitor Sentry error rate
     - Spot-check affected features

CODE REVIEW CHECKLIST:
  □ Does it have tests?
  □ Does it handle errors gracefully?
  □ Does it work offline? (if client-side)
  □ Are new environment variables documented in .env.example?
  □ Are database changes backward-compatible?
  □ Does it respect the data protection law? (no PII in logs)
  □ Is the TypeScript strict? (no `any` without justification)
  □ Are API responses consistent with existing patterns?
  □ Does it have structured logging?
```

### 6.5 Documentation Standards

```
DOCUMENTATION STANDARDS
═══════════════════════

CODE DOCUMENTATION:
  - Every exported function: JSDoc comment with @param, @returns, @throws
  - Every API route: document request/response format at top of file
  - Every database query: inline comment explaining what it does and why
  - Complex algorithms: block comments explaining the approach

FILE DOCUMENTATION:
  - New files: 2-3 line comment at the top explaining the file's purpose
  - Example:
    // lib/client/bandwidthDetector.ts
    // Measures network quality using Navigator.connection API and HEAD probe.
    // Used by the sync engine to determine which queue priorities to flush.

API DOCUMENTATION:
  - Maintained in api/README.md (create if needed)
  - Each endpoint: method, path, auth required, request body, response body
  - Updated when endpoints change

RUNBOOK DOCUMENTATION:
  - Maintained in docs/runbooks/ (markdown files)
  - One file per runbook
  - Template: Symptoms, Diagnosis, Resolution, Escalation

ARCHITECTURE DECISIONS:
  - Maintained in research/ directory (this file and predecessors)
  - Each ADR: context, decision, consequences, status

CHANGELOG:
  - Maintained in CHANGELOG.md at project root
  - Format: Keep a Changelog (https://keepachangelog.com/)
  - Updated on each PR to main
```

---

## Summary: Implementation Priorities

| Priority | What | Why | Effort |
|---|---|---|---|
| **Immediate** (Week -2) | CI pipeline + linting + tests in CI | Prevent regressions before pilot | 2 days |
| **Immediate** (Week -2) | Sentry integration | Catch field errors early | 1 day |
| **Immediate** (Week -1) | Staging environment + migrations | Safe deployment workflow | 2 days |
| **Immediate** (Week -1) | Uptime monitoring + alerting | Know when things break | 0.5 day |
| **Week 1-2** | Enhanced offline sync + photo staging | Core field agent experience | 5 days |
| **Week 2-3** | Admin review queue + data API | Quality control + commercial value | 5 days |
| **Week 3-4** | Ops dashboard + telemetry | Visibility into field operations | 4 days |
| **Week 4-6** | Backup automation + E2E tests | Production resilience | 3 days |
| **Post-pilot** | Multi-zone + scaling prep | Growth readiness | 10+ days |

**Total new tooling cost:** $0/month additional (Sentry free, UptimeRobot free, GitHub Actions free)
**Total infrastructure cost:** $20/month (unchanged -- Vercel Pro)
**Total implementation effort:** ~54 developer-days across 3 phases

---

## Sources and References

- Vercel Cron documentation: https://vercel.com/docs/cron-jobs
- Vercel Environment Variables: https://vercel.com/docs/environment-variables
- Neon Branching: https://neon.tech/docs/introduction/branching
- Sentry JavaScript SDK: https://docs.sentry.io/platforms/javascript/
- Sentry Node.js SDK: https://docs.sentry.io/platforms/node/
- GitHub Actions: https://docs.github.com/en/actions
- Node.js built-in test runner: https://nodejs.org/api/test.html
- Playwright: https://playwright.dev/
- ESLint flat config: https://eslint.org/docs/latest/use/configure/configuration-files-new
- UptimeRobot: https://uptimerobot.com/
- Cameroon Data Protection Law 2024/017: https://prc.cm/en/multimedia/documents/10271-law-n-2024-017-of-23-12-2024-web
- Keep a Changelog: https://keepachangelog.com/
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
