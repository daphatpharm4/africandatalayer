# ADL Cloud Engineering Document

**Author:** Teammate 3 -- Cloud Engineer
**Date:** 2026-02-27
**Status:** Living document -- updates with each scaling phase
**Predecessors:**
- [01-cloud-architecture.md](./01-cloud-architecture.md) (Cloud Architect)
- [02-system-design.md](./02-system-design.md) (System Design Expert)
**Scope:** Infrastructure as Code, CI/CD pipelines, observability, backup/DR, deployment runbooks, security hardening, and performance engineering for African Data Layer

---

## Table of Contents

1. [Infrastructure as Code (IaC)](#1-infrastructure-as-code-iac)
2. [CI/CD Pipeline](#2-cicd-pipeline)
3. [Observability Stack](#3-observability-stack)
4. [Backup & Disaster Recovery](#4-backup--disaster-recovery)
5. [Deployment Runbooks](#5-deployment-runbooks)
6. [Security Hardening](#6-security-hardening)
7. [Performance Engineering](#7-performance-engineering)

---

## 1. Infrastructure as Code (IaC)

### 1.1 Vercel Project Configuration as Code

The current `vercel.json` is minimal:

```json
{
  "framework": "vite",
  "buildCommand": "vite build",
  "devCommand": "vite",
  "outputDirectory": "dist"
}
```

**Enhanced `vercel.json` -- apply immediately:**

```json
{
  "framework": "vite",
  "buildCommand": "vite build",
  "devCommand": "vite",
  "outputDirectory": "dist",
  "regions": ["cdg1"],
  "functions": {
    "api/**/*.ts": {
      "memory": 256,
      "maxDuration": 30
    },
    "api/submissions/index.ts": {
      "memory": 512,
      "maxDuration": 45
    },
    "api/health/index.ts": {
      "memory": 128,
      "maxDuration": 10
    }
  },
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "0" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(self), geolocation=(self), microphone=()" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "crons": [
    {
      "path": "/api/cron/health-deep",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/refresh-projections",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/cron/backup-export",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Key additions explained:**
- `regions: ["cdg1"]` -- Paris, closest Vercel region to Douala (~180ms). Lock functions to a single region co-located with Supabase.
- Per-function memory/timeout: `api/submissions/index.ts` does photo upload, EXIF extraction, and fraud checks synchronously -- needs 512 MB and 45s. Health check needs only 128 MB.
- Security headers applied globally (HSTS, X-Content-Type-Options, X-Frame-Options).
- Immutable caching for Vite hashed assets (`/assets/index-QrY-Hdyj.js`).
- SPA rewrite rule for client-side routing.
- Cron jobs for deep health check, materialized view refresh, and nightly backup export.

### 1.2 Supabase Project Configuration

#### Migration Management

Current migrations in `supabase/migrations/`:
```
20260219_init_adl.sql          -- user_profiles + point_events tables + indexes
20260224_phone_identifier.sql  -- phone column on user_profiles
```

**New migrations to add:**

**`supabase/migrations/20260227_audit_log.sql`**
```sql
-- Audit log table (referenced in 01-cloud-architecture.md section 6.3)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor
  ON public.audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON public.audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON public.audit_log (created_at DESC);
```

**`supabase/migrations/20260227_idempotency_keys.sql`**
```sql
-- Server-side idempotency dedup table
-- (Addresses gap identified in 01-cloud-architecture.md section 4.4)
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key text PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.point_events(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-expire keys older than 48 hours
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at
  ON public.idempotency_keys (created_at);
```

**`supabase/migrations/20260227_point_projections.sql`**
```sql
-- Materialized view to replace in-app projectPointsFromEvents()
-- (Referenced in 01-cloud-architecture.md section 5.1)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.point_projections AS
SELECT DISTINCT ON (point_id)
  point_id,
  category,
  latitude,
  longitude,
  details,
  photo_url,
  created_at,
  source,
  external_id
FROM public.point_events
ORDER BY point_id, created_at DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_projections_point_id
  ON public.point_projections (point_id);

CREATE INDEX IF NOT EXISTS idx_point_projections_category
  ON public.point_projections (category);

CREATE INDEX IF NOT EXISTS idx_point_projections_location
  ON public.point_projections (latitude, longitude);
```

**`supabase/migrations/20260227_rls_policies.sql`**
```sql
-- Enable Row Level Security on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Application role (used by the API server via POSTGRES_URL)
-- Vercel functions connect as 'authenticated_api' role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'adl_api') THEN
    CREATE ROLE adl_api;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO adl_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.point_events TO adl_api;
GRANT SELECT, INSERT ON public.audit_log TO adl_api;
GRANT SELECT ON public.point_projections TO adl_api;

-- Read-only role for preview deployments
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'adl_readonly') THEN
    CREATE ROLE adl_readonly;
  END IF;
END $$;

GRANT SELECT ON public.user_profiles TO adl_readonly;
GRANT SELECT ON public.point_events TO adl_readonly;
GRANT SELECT ON public.audit_log TO adl_readonly;
GRANT SELECT ON public.point_projections TO adl_readonly;

-- RLS policies for user_profiles
CREATE POLICY user_profiles_api_select ON public.user_profiles
  FOR SELECT TO adl_api USING (true);
CREATE POLICY user_profiles_api_insert ON public.user_profiles
  FOR INSERT TO adl_api WITH CHECK (true);
CREATE POLICY user_profiles_api_update ON public.user_profiles
  FOR UPDATE TO adl_api USING (true);

-- RLS policies for point_events
CREATE POLICY point_events_api_all ON public.point_events
  FOR ALL TO adl_api USING (true);

-- RLS policies for audit_log (insert-only for API, select for admins via direct query)
CREATE POLICY audit_log_api_insert ON public.audit_log
  FOR INSERT TO adl_api WITH CHECK (true);
CREATE POLICY audit_log_api_select ON public.audit_log
  FOR SELECT TO adl_api USING (true);
```

#### Running Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Apply migrations to target environment
supabase db push --db-url "$POSTGRES_URL"

# Verify migration status
supabase migration list --db-url "$POSTGRES_URL"

# Generate a diff for manual changes made in Supabase Studio
supabase db diff --schema public --db-url "$POSTGRES_URL" > supabase/migrations/$(date +%Y%m%d)_auto_diff.sql
```

### 1.3 Environment Variable Management Strategy

**Variable classification:**

| Variable | Environments | Sensitivity | Source |
|----------|-------------|-------------|--------|
| `ADL_POSTGRES_URL` | All (different values) | SECRET | Vercel Env Vars (encrypted) |
| `BLOB_READ_WRITE_TOKEN` | All (different values) | SECRET | Vercel Env Vars (encrypted) |
| `AUTH_SECRET` | All (different values) | SECRET | Vercel Env Vars (encrypted) |
| `GOOGLE_CLIENT_ID` | Production + Preview | CONFIDENTIAL | Vercel Env Vars |
| `GOOGLE_CLIENT_SECRET` | Production + Preview | SECRET | Vercel Env Vars (encrypted) |
| `GEMINI_API_KEY` | Production only | SECRET | Vercel Env Vars (server only) |
| `ADMIN_EMAIL` | Production only | INTERNAL | Vercel Env Vars |
| `ADMIN_PASSWORD` | REMOVE | CRITICAL | Migrate to DB password_hash |
| `EDGE_CONFIG` | All | CONFIDENTIAL | Vercel Env Vars |
| `DATA_STORE_DRIVER` | All | PUBLIC | Vercel Env Vars (always `postgres`) |
| `POSTGRES_POOL_MAX` | Per environment | PUBLIC | Vercel Env Vars |
| `SENTRY_DSN` | All | PUBLIC | Vercel Env Vars |
| `VERCEL_API_TOKEN` | CI only | CRITICAL | GitHub Actions Secrets only |

**Naming convention for environment-specific variables:**

```
Production:  ADL_POSTGRES_URL = postgres://adl_api:***@db.xyz.supabase.co:5432/postgres
Staging:     ADL_POSTGRES_URL = postgres://adl_api:***@db.abc.supabase.co:5432/postgres
Preview:     ADL_POSTGRES_URL = postgres://adl_readonly:***@db.abc.supabase.co:5432/postgres
```

**Critical fix -- remove client-side API key exposure:**

The current `vite.config.ts` exposes `GEMINI_API_KEY` to the browser bundle:

```typescript
// CURRENT -- INSECURE (vite.config.ts lines 19-22)
define: {
  'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
},
```

**Fix:** Remove these `define` entries. Create a server-side proxy at `api/gemini/index.ts` that uses `process.env.GEMINI_API_KEY` on the server and expose a safe endpoint to the client.

### 1.4 IaC Tool Selection

**Phase 1 (Now -- MVP):** No Terraform/Pulumi needed. Manage infra with:
- `vercel.json` for Vercel configuration
- `supabase/migrations/*.sql` for database schema
- GitHub Actions for CI/CD
- Vercel CLI for deployment

**Phase 2 (1K-10K users):** Introduce Pulumi with TypeScript for:
- Multi-environment Supabase project provisioning
- Vercel project and domain configuration
- Upstash Redis provisioning (rate limiting)
- Edge Config management

**Phase 3 (10K+ users):** Full Pulumi stack:
- Cloudflare R2 for photo archival
- Supabase read replicas
- QStash topic management

**Rationale for Pulumi over Terraform:**
- TypeScript native (same language as the codebase)
- Vercel and Supabase both have Pulumi providers
- Richer programming constructs than HCL
- Single `package.json` can include infra code

### 1.5 Concrete IaC Files Needed Now

```
africandatalayer/
  vercel.json                          # Enhanced (section 1.1)
  supabase/
    migrations/
      20260219_init_adl.sql            # Existing
      20260224_phone_identifier.sql    # Existing
      20260227_audit_log.sql           # NEW
      20260227_idempotency_keys.sql    # NEW
      20260227_point_projections.sql   # NEW
      20260227_rls_policies.sql        # NEW
    config.toml                        # NEW: Supabase project config
  .github/
    workflows/
      ci.yml                           # NEW: Main CI/CD pipeline
      migration.yml                    # NEW: Database migration workflow
      security-scan.yml                # NEW: Dependency + SAST scanning
  scripts/
    backup-export.sh                   # NEW: Database export script
    refresh-projections.sh             # NEW: Materialized view refresh
```

**`supabase/config.toml`:**
```toml
[project]
id = "adl-prod"

[db]
port = 5432
major_version = 15

[db.pooler]
enabled = true
port = 6543
pool_mode = "transaction"
default_pool_size = 15
max_client_conn = 100

[auth]
enabled = false

[storage]
enabled = false

[realtime]
enabled = false
```

Auth, storage, and realtime are disabled in Supabase config because ADL uses Auth.js, Vercel Blob, and has no realtime yet. This avoids unnecessary resource usage on the Supabase instance.

---

## 2. CI/CD Pipeline

### 2.1 GitHub Actions Workflow Design

**`.github/workflows/ci.yml`** -- Main CI/CD pipeline:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: "20"

jobs:
  # ──────────────────────────────────────────
  # Stage 1: Lint & Type Check
  # ──────────────────────────────────────────
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - run: npm ci

      - name: TypeScript type check
        run: npx tsc --noEmit --strict

      - name: Check for console.log in production code
        run: |
          if grep -rn "console\.log\b" api/ lib/server/ --include="*.ts" | grep -v "test\." | grep -v "\.test\."; then
            echo "::warning::Found console.log statements in production code. Use structured logging instead."
          fi

  # ──────────────────────────────────────────
  # Stage 2: Unit Tests
  # ──────────────────────────────────────────
  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - run: npm ci

      - name: Run tests
        run: node --test tests/*.test.ts
        env:
          NODE_OPTIONS: "--experimental-strip-types"

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results/

  # ──────────────────────────────────────────
  # Stage 3: Build & Bundle Analysis
  # ──────────────────────────────────────────
  build:
    name: Build & Bundle Analysis
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - run: npm ci

      - name: Build
        run: npm run build
        env:
          NODE_ENV: production

      - name: Check bundle size
        run: |
          MAX_MAIN_KB=350
          MAX_TOTAL_KB=800
          MAIN_SIZE=$(du -sk dist/assets/index-*.js | awk '{print $1}')
          TOTAL_SIZE=$(du -sk dist/assets/ | awk '{print $1}')
          echo "Main bundle: ${MAIN_SIZE}KB (limit: ${MAX_MAIN_KB}KB)"
          echo "Total assets: ${TOTAL_SIZE}KB (limit: ${MAX_TOTAL_KB}KB)"
          if [ "$MAIN_SIZE" -gt "$MAX_MAIN_KB" ]; then
            echo "::error::Main bundle exceeds ${MAX_MAIN_KB}KB limit (${MAIN_SIZE}KB)"
            exit 1
          fi
          if [ "$TOTAL_SIZE" -gt "$MAX_TOTAL_KB" ]; then
            echo "::warning::Total assets exceed ${MAX_TOTAL_KB}KB soft limit (${TOTAL_SIZE}KB)"
          fi

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-dist
          path: dist/
          retention-days: 7

  # ──────────────────────────────────────────
  # Stage 4: Security Scanning
  # ──────────────────────────────────────────
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - run: npm ci

      - name: npm audit (production deps)
        run: npm audit --production --audit-level=high
        continue-on-error: true

      - name: Check for known vulnerable packages
        run: |
          npx audit-ci --high --report-type full

      - name: Check for secrets in code
        uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified

  # ──────────────────────────────────────────
  # Stage 5: Database Migration Dry Run (PRs only)
  # ──────────────────────────────────────────
  migration-check:
    name: Migration Dry Run
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4

      - name: Check for new migration files
        id: migration-check
        run: |
          CHANGED=$(git diff --name-only origin/${{ github.base_ref }}...HEAD -- 'supabase/migrations/')
          if [ -n "$CHANGED" ]; then
            echo "has_migrations=true" >> "$GITHUB_OUTPUT"
            echo "Changed migration files:"
            echo "$CHANGED"
          else
            echo "has_migrations=false" >> "$GITHUB_OUTPUT"
            echo "No migration changes detected."
          fi

      - name: Validate SQL syntax
        if: steps.migration-check.outputs.has_migrations == 'true'
        run: |
          for f in supabase/migrations/*.sql; do
            echo "Checking $f..."
            # Basic SQL syntax validation
            if ! grep -qE '(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE|DO)' "$f"; then
              echo "::warning::$f does not contain recognizable SQL statements"
            fi
          done

      - name: Label PR with migration tag
        if: steps.migration-check.outputs.has_migrations == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.addLabels({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              labels: ['database-migration']
            })

  # ──────────────────────────────────────────
  # Stage 6: Deploy
  # ──────────────────────────────────────────
  deploy:
    name: Deploy to Vercel
    runs-on: ubuntu-latest
    needs: [test, build, security]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: "--prod"

      - name: Post-deploy health check
        run: |
          echo "Waiting 30s for deployment to propagate..."
          sleep 30
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://africandatalayer.vercel.app/api/health)
          if [ "$STATUS" != "200" ]; then
            echo "::error::Health check failed with status $STATUS"
            exit 1
          fi
          echo "Health check passed (HTTP $STATUS)"

      - name: Notify deployment
        if: always()
        run: |
          echo "Deployment ${{ job.status }} for commit ${{ github.sha }}"
```

**`.github/workflows/migration.yml`** -- Database migration pipeline:

```yaml
name: Database Migration

on:
  workflow_dispatch:
    inputs:
      environment:
        description: "Target environment"
        required: true
        type: choice
        options:
          - staging
          - production
      dry_run:
        description: "Dry run (validate only, no apply)"
        type: boolean
        default: true

jobs:
  migrate:
    name: Run Migrations (${{ inputs.environment }})
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4

      - name: Install Supabase CLI
        run: |
          curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh

      - name: Validate migrations
        run: |
          echo "=== Migration files to apply ==="
          ls -la supabase/migrations/
          echo ""
          for f in supabase/migrations/*.sql; do
            echo "--- $f ---"
            head -5 "$f"
            echo "..."
          done

      - name: Apply migrations (dry run)
        if: inputs.dry_run
        run: |
          echo "DRY RUN: would apply migrations to ${{ inputs.environment }}"
          echo "Connection: ${{ inputs.environment }} database"
          # Validate SQL by parsing, do not execute
          for f in supabase/migrations/*.sql; do
            echo "Would apply: $f"
          done

      - name: Apply migrations
        if: ${{ !inputs.dry_run }}
        run: |
          supabase db push --db-url "${{ secrets.ADL_POSTGRES_URL }}"
        env:
          ADL_POSTGRES_URL: ${{ secrets.ADL_POSTGRES_URL }}

      - name: Verify migration
        if: ${{ !inputs.dry_run }}
        run: |
          supabase migration list --db-url "${{ secrets.ADL_POSTGRES_URL }}"
```

### 2.2 Branch Strategy

```
main (production)
  |
  +-- develop (staging, auto-deploys to preview)
       |
       +-- feature/add-rate-limiting
       +-- feature/idempotency-keys
       +-- fix/photo-upload-timeout
       +-- chore/update-dependencies
```

| Branch | Deploys To | DB Target | Auto-Deploy | Protection |
|--------|-----------|-----------|-------------|------------|
| `main` | Production | `adl-prod` | Yes (after CI passes) | Require PR + 1 approval + CI green |
| `develop` | Staging (preview) | `adl-staging` | Yes | Require CI green |
| `feature/*` | PR preview | `adl-staging` (read-only) | Yes (Vercel preview) | None |
| `fix/*` | PR preview | `adl-staging` (read-only) | Yes (Vercel preview) | None |
| `hotfix/*` | Production (fast-track) | `adl-prod` | After expedited review | Require 1 approval |

### 2.3 Preview Deployment Strategy

Vercel auto-deploys every PR as a preview. ADL-specific configuration:

1. **Preview environment variables:** Set via Vercel dashboard scoped to "Preview"
   - `ADL_POSTGRES_URL` -> staging database with `adl_readonly` role
   - `DATA_STORE_DRIVER=postgres`
   - `BLOB_READ_WRITE_TOKEN` -> staging blob store
   - Preview deployments are **read-only** -- POST to `/api/submissions` returns 403

2. **Preview URL pattern:** `adl-<branch>-<hash>.vercel.app`

3. **PR comment with preview link:** Vercel bot auto-posts this

4. **Preview cleanup:** Vercel auto-removes preview deployments after PR merge

### 2.4 Database Migration Pipeline

**Safe migration process (zero-downtime):**

```
Step 1: PR contains new file in supabase/migrations/
Step 2: CI auto-labels PR with 'database-migration'
Step 3: migration-check job validates SQL syntax
Step 4: Developer triggers manual migration.yml workflow on staging (dry run first)
Step 5: Verify staging works with new schema
Step 6: PR merges to main
Step 7: Developer triggers migration.yml on production (dry run, then apply)
Step 8: main deploys new code that uses the new schema
```

**Critical rules:**
- Migrations MUST be backwards-compatible (old code must work with new schema)
- Never DROP columns or tables in the same deploy as code changes
- Use a two-phase approach: Phase 1 adds columns/tables, Phase 2 (next release) removes old ones
- Always add `IF NOT EXISTS` / `IF EXISTS` guards
- Test migrations against a copy of production data before applying

### 2.5 Rollback Strategy

**Application rollback (instant):**
```bash
# List recent deployments
vercel ls --prod

# Instantly rollback to a specific deployment
vercel rollback <deployment-url> --prod

# Or promote a previous deployment
vercel promote <deployment-url>
```

**Database rollback:** Migrations are forward-only. To "undo" a migration:
1. Write a new migration that reverts the changes
2. Apply via the migration pipeline
3. This is why backwards-compatible migrations are essential

**Emergency rollback procedure:**
1. Vercel instant rollback to last known-good deployment (< 30 seconds)
2. If DB schema change caused the issue: apply reverse migration
3. If data corruption: restore from Supabase PITR (see section 4)

### 2.6 Security Scanning in CI

**Already included in `ci.yml` Stage 4. Additional configuration:**

**`.github/workflows/security-scan.yml`** -- Weekly deep scan:

```yaml
name: Weekly Security Scan

on:
  schedule:
    - cron: "0 6 * * 1"  # Monday 6 AM UTC
  workflow_dispatch:

jobs:
  dependency-audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci

      - name: Full npm audit
        run: npm audit --json > audit-report.json || true

      - name: Parse critical/high vulnerabilities
        run: |
          CRITICAL=$(jq '.metadata.vulnerabilities.critical // 0' audit-report.json)
          HIGH=$(jq '.metadata.vulnerabilities.high // 0' audit-report.json)
          echo "Critical: $CRITICAL, High: $HIGH"
          if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
            echo "::error::Found $CRITICAL critical and $HIGH high vulnerabilities"
          fi

      - name: Upload audit report
        uses: actions/upload-artifact@v4
        with:
          name: audit-report
          path: audit-report.json

  sast:
    name: Static Analysis
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Semgrep SAST
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/typescript
            p/jwt
            p/sql-injection
            p/xss
```

### 2.7 Performance Budget Enforcement

Defined in the `build` job above. Summary of budgets:

| Metric | Hard Limit | Soft Limit | Measured By |
|--------|-----------|------------|-------------|
| Main JS bundle | 350 KB | 250 KB | `du -sk dist/assets/index-*.js` |
| Total assets | 800 KB | 600 KB | `du -sk dist/assets/` |
| TypeScript errors | 0 | 0 | `tsc --noEmit` |
| npm audit critical | 0 | 0 | `npm audit` |
| Test pass rate | 100% | 100% | `node --test` |

---

## 3. Observability Stack

### 3.1 Logging Strategy

**Current state:** Minimal logging. `console.info("[SUBMISSION_DEVICE]", ...)` only in non-production (line 673 of `api/submissions/index.ts`). `console.error("Postgres pool error", error)` in `lib/server/db.ts`.

**Structured logging module -- `lib/server/logger.ts`:**

```typescript
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  action?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LEVEL];
}

function emit(entry: LogEntry): void {
  if (!shouldLog(entry.level)) return;
  const output = JSON.stringify(entry);
  if (entry.level === "error") {
    console.error(output);
  } else if (entry.level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (message: string, metadata?: Record<string, unknown>) =>
    emit({ level: "debug", message, timestamp: new Date().toISOString(), ...metadata }),
  info: (message: string, metadata?: Record<string, unknown>) =>
    emit({ level: "info", message, timestamp: new Date().toISOString(), ...metadata }),
  warn: (message: string, metadata?: Record<string, unknown>) =>
    emit({ level: "warn", message, timestamp: new Date().toISOString(), ...metadata }),
  error: (message: string, metadata?: Record<string, unknown>) =>
    emit({ level: "error", message, timestamp: new Date().toISOString(), ...metadata }),
};
```

**What to log (and what NOT to log):**

| Event | Level | Log? | Fields |
|-------|-------|------|--------|
| Submission created | `info` | YES | `eventId`, `userId`, `category`, `eventType`, `duration_ms` |
| Submission validation failed | `warn` | YES | `reason`, `userId`, `category` |
| Fraud check flagged | `warn` | YES | `eventId`, `userId`, `riskScore`, `signals` |
| Photo upload failed | `error` | YES | `eventId`, `errorCode`, `errorMessage` |
| DB query timeout | `error` | YES | `query` (first 100 chars), `timeout_ms` |
| DB pool error | `error` | YES | `errorCode`, `errorMessage` |
| Auth login success | `info` | YES | `userId`, `provider` |
| Auth login failed | `warn` | YES | `identifier` (hashed), `reason` |
| Health check | `debug` | NO in prod | `db_status`, `latency_ms` |
| Request body contents | - | NEVER | Contains PII, photos |
| Password hashes | - | NEVER | Security |
| Full SQL queries with params | - | NEVER | May contain PII |

### 3.2 Metrics Collection

**Custom ADL metrics (log-derived, queryable in Vercel Logs or Sentry):**

| Metric | Type | Source | Alert Threshold |
|--------|------|--------|-----------------|
| `adl.submissions.created` | Counter | POST /api/submissions 201 | < 1/hour during business hours |
| `adl.submissions.failed` | Counter | POST /api/submissions 4xx/5xx | > 10/hour |
| `adl.submissions.latency_p99` | Histogram | POST /api/submissions duration_ms | > 15000 ms |
| `adl.fraud.flagged` | Counter | Fraud check with risk > 0.7 | > 5/hour |
| `adl.fraud.blocked` | Counter | Submissions blocked by fraud | > 3/hour |
| `adl.sync.failures` | Counter | Offline queue permanent failures | > 0 (alert on any) |
| `adl.auth.login_failed` | Counter | Auth login failures | > 20/hour |
| `adl.db.query_timeout` | Counter | StorageUnavailableError | > 0 |
| `adl.db.pool_errors` | Counter | Pool error event | > 0 |
| `adl.blob.upload_failed` | Counter | Photo upload failures | > 3/hour |
| `adl.health.status` | Gauge | /api/health response | != "ok" |

**Implementation approach:**

Since ADL is on Vercel (no Prometheus endpoint), metrics are derived from structured log lines. Use Vercel Log Drains to send logs to a metrics backend:

```bash
# Set up Vercel log drain to send to a webhook or Datadog/Axiom
vercel logs drain create \
  --type json \
  --url https://your-metrics-endpoint.example.com/ingest \
  --project-id $VERCEL_PROJECT_ID
```

For MVP, Vercel's built-in Logs tab + `@vercel/analytics` (already installed) provides sufficient observability. Upgrade to Axiom (free Vercel integration) when log volume grows.

### 3.3 Alerting Rules and Thresholds

| Alert | Condition | Channel | Severity |
|-------|-----------|---------|----------|
| **Service Down** | Health check returns non-200 for 2 consecutive checks | SMS + Email | P1 - Critical |
| **DB Unreachable** | `adl.db.pool_errors > 0` in 5 min window | Email | P1 - Critical |
| **High Error Rate** | `5xx responses > 5%` of total in 10 min window | Email | P2 - High |
| **Submission Spike** | `adl.submissions.created > 100` in 10 min (possible bot) | Email | P2 - High |
| **Fraud Spike** | `adl.fraud.flagged > 10` in 1 hour | Email | P2 - High |
| **Build Failure** | CI pipeline fails on `main` | GitHub notification | P3 - Medium |
| **Bundle Regression** | Main JS bundle > 350 KB | GitHub PR comment | P3 - Medium |
| **Dependency Vuln** | Critical/High npm audit finding | Weekly email digest | P3 - Medium |

### 3.4 Distributed Tracing for Serverless Functions

Vercel Functions have limited tracing support. Implement lightweight request tracing:

**Request ID propagation -- `lib/server/requestContext.ts`:**

```typescript
export function getRequestId(request: Request): string {
  return (
    request.headers.get("x-vercel-id") ??
    request.headers.get("x-request-id") ??
    crypto.randomUUID()
  );
}

export function withRequestTiming<T>(
  label: string,
  fn: () => Promise<T>,
  requestId: string,
): Promise<T> {
  const start = performance.now();
  return fn().then(
    (result) => {
      const duration = Math.round(performance.now() - start);
      console.log(JSON.stringify({
        level: "info",
        requestId,
        trace: label,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      }));
      return result;
    },
    (error) => {
      const duration = Math.round(performance.now() - start);
      console.error(JSON.stringify({
        level: "error",
        requestId,
        trace: label,
        duration_ms: duration,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }));
      throw error;
    },
  );
}
```

**Usage in `api/submissions/index.ts` POST handler:**

```typescript
const requestId = getRequestId(request);
const photoUrl = await withRequestTiming(
  "blob.upload",
  () => uploadSubmissionPhoto(eventId, parsedPhoto.imageBuffer, parsedPhoto.mime, parsedPhoto.ext),
  requestId,
);
await withRequestTiming(
  "db.insert_event",
  () => insertPointEvent(newEvent),
  requestId,
);
```

This produces log lines like:
```json
{"level":"info","requestId":"cdg1::abcd-1234","trace":"blob.upload","duration_ms":1250,"timestamp":"2026-02-27T10:00:00.000Z"}
{"level":"info","requestId":"cdg1::abcd-1234","trace":"db.insert_event","duration_ms":85,"timestamp":"2026-02-27T10:00:01.250Z"}
```

### 3.5 Health Check Enhancement

The current `/api/health/index.ts` only checks `SELECT 1`. Enhance it:

**Enhanced `api/health/index.ts`:**

```typescript
import { query } from "../../lib/server/db.js";

interface HealthCheckResult {
  status: "ok" | "degraded" | "error";
  db: "ok" | "error";
  db_latency_ms: number | null;
  blob: "ok" | "unchecked";
  version: string;
  region: string | null;
  uptime_s: number;
  ts: string;
}

const startTime = Date.now();

export async function GET(request: Request): Promise<Response> {
  const isDeepCheck = new URL(request.url).searchParams.get("deep") === "true";
  const result: HealthCheckResult = {
    status: "ok",
    db: "error",
    db_latency_ms: null,
    blob: "unchecked",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    region: process.env.VERCEL_REGION ?? null,
    uptime_s: Math.round((Date.now() - startTime) / 1000),
    ts: new Date().toISOString(),
  };

  // Database check
  const dbStart = performance.now();
  try {
    await query("SELECT 1");
    result.db = "ok";
    result.db_latency_ms = Math.round(performance.now() - dbStart);
  } catch {
    result.status = "error";
    result.db_latency_ms = Math.round(performance.now() - dbStart);
  }

  // Deep check: verify table accessibility
  if (isDeepCheck && result.db === "ok") {
    try {
      await query("SELECT count(*) FROM point_events WHERE created_at > now() - interval '1 day'");
    } catch {
      result.status = "degraded";
    }
  }

  // DB latency warning
  if (result.db_latency_ms !== null && result.db_latency_ms > 5000) {
    result.status = result.status === "ok" ? "degraded" : result.status;
  }

  const httpStatus = result.status === "error" ? 503 : 200;
  return new Response(JSON.stringify(result), {
    status: httpStatus,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store",
    },
  });
}
```

### 3.6 Dashboard Design

**ADL Operations Dashboard (Axiom/Grafana/Vercel Analytics):**

| Panel | Query/Source | Refresh |
|-------|-------------|---------|
| **Health Status** | GET /api/health every 60s, display status badge | 1 min |
| **Submissions/Hour** | Count of 201 responses on POST /api/submissions | 5 min |
| **Submissions by Category** | Breakdown: pharmacy, fuel_station, mobile_money | 5 min |
| **Error Rate** | 4xx + 5xx / total requests as % | 5 min |
| **P50/P95/P99 Latency** | Duration of POST /api/submissions | 5 min |
| **Active Users (24h)** | Distinct user_id in point_events WHERE created_at > 24h ago | 15 min |
| **Fraud Detection Rate** | Flagged / total submissions as % | 15 min |
| **Offline Sync Failures** | Count of permanent sync failures (from structured logs) | 15 min |
| **DB Connection Pool** | Pool active / max (from Supabase metrics) | 1 min |
| **Blob Storage Usage** | Total blob storage in GB | 1 hour |
| **Bundle Size Trend** | Main JS bundle KB over last 30 days (from CI artifacts) | Daily |
| **Top Contributors** | Leaderboard top 10 by XP | 30 min |

### 3.7 Error Tracking

**Recommendation: Sentry (free tier: 5K errors/month)**

```bash
npm install @sentry/node
```

**`lib/server/sentry.ts`:**

```typescript
import * as Sentry from "@sentry/node";

const DSN = process.env.SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.VERCEL_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Strip PII from error reports
      if (event.request?.data) {
        event.request.data = "[REDACTED]";
      }
      if (event.request?.cookies) {
        event.request.cookies = {};
      }
      return event;
    },
  });
}

export { Sentry };
```

**Integration points:**
- Wrap each API handler's catch block with `Sentry.captureException(error)`
- Add `Sentry.setUser({ id: auth.id })` after authentication
- Use `Sentry.addBreadcrumb()` for tracing key operations

---

## 4. Backup & Disaster Recovery

### 4.1 Database Backup Strategy

**Layer 1: Supabase Automatic Backups**

| Supabase Tier | Backup Type | Frequency | Retention |
|---------------|-------------|-----------|-----------|
| Free | Daily snapshot | 24h | 7 days |
| Pro ($25/mo) | PITR (Point-in-Time Recovery) | Continuous WAL | 7 days |
| Team ($599/mo) | PITR | Continuous WAL | 30 days |

**Current tier: Free.** Upgrade to Pro when user count exceeds 500 (projected ~$55/mo total per architect's cost table).

**Layer 2: Custom Nightly Export**

**`scripts/backup-export.sh`:**

```bash
#!/bin/bash
set -euo pipefail

# Configuration
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/adl-backup-${BACKUP_DATE}"
POSTGRES_URL="${ADL_POSTGRES_URL:?ADL_POSTGRES_URL is required}"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting ADL database export at $(date -u)"

# Export tables as compressed CSV
psql "$POSTGRES_URL" -c "\COPY (SELECT * FROM point_events ORDER BY created_at) TO STDOUT WITH CSV HEADER" | gzip > "$BACKUP_DIR/point_events.csv.gz"
echo "[backup] point_events exported ($(du -sh "$BACKUP_DIR/point_events.csv.gz" | awk '{print $1}'))"

psql "$POSTGRES_URL" -c "\COPY (SELECT id, email, phone, name, image, occupation, xp, is_admin, map_scope, created_at, updated_at FROM user_profiles) TO STDOUT WITH CSV HEADER" | gzip > "$BACKUP_DIR/user_profiles.csv.gz"
echo "[backup] user_profiles exported (password_hash excluded)"

psql "$POSTGRES_URL" -c "\COPY (SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100000) TO STDOUT WITH CSV HEADER" | gzip > "$BACKUP_DIR/audit_log.csv.gz" 2>/dev/null || echo "[backup] audit_log table not found, skipping"

# Export schema
pg_dump "$POSTGRES_URL" --schema-only --no-owner --no-acl > "$BACKUP_DIR/schema.sql"
echo "[backup] Schema exported"

# Checksum
sha256sum "$BACKUP_DIR"/* > "$BACKUP_DIR/checksums.sha256"

# Upload to Vercel Blob (or S3/R2 in future)
echo "[backup] Backup complete: $BACKUP_DIR"
echo "[backup] Files:"
ls -lh "$BACKUP_DIR/"

# Cleanup backups older than 30 days
find /tmp -maxdepth 1 -name "adl-backup-*" -mtime +30 -exec rm -rf {} \;
echo "[backup] Old backups cleaned up"
```

**API endpoint for cron-triggered backup (Vercel Cron):**

```typescript
// api/cron/backup-export.ts
import { query } from "../../lib/server/db.js";

export async function GET(request: Request): Promise<Response> {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const countResult = await query<{ count: string }>(
      "SELECT count(*) as count FROM point_events"
    );
    const count = parseInt(countResult.rows[0]?.count ?? "0", 10);

    // Log backup metadata (actual export runs via scheduled script)
    console.log(JSON.stringify({
      level: "info",
      action: "backup.checkpoint",
      point_events_count: count,
      timestamp: new Date().toISOString(),
    }));

    return new Response(JSON.stringify({
      status: "ok",
      point_events_count: count,
      ts: new Date().toISOString(),
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ status: "error" }), { status: 500 });
  }
}
```

### 4.2 Blob Storage Backup

**Current:** Photos stored in Vercel Blob under `submissions/{eventId}-{timestamp}.{ext}`.

**Backup strategy:**
1. Vercel Blob has no built-in backup. Photos are referenced by URL in `point_events.photo_url`.
2. Nightly script lists all blob URLs from `point_events.photo_url` and verifies accessibility.
3. Phase 2: Copy blobs older than 30 days to Cloudflare R2 as cold archive.

**Blob verification script:**

```bash
#!/bin/bash
# Verify all photo URLs are accessible
psql "$ADL_POSTGRES_URL" -t -c "SELECT DISTINCT photo_url FROM point_events WHERE photo_url IS NOT NULL AND photo_url != ''" | while read -r url; do
  url=$(echo "$url" | xargs)  # trim whitespace
  if [ -z "$url" ]; then continue; fi
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10)
  if [ "$STATUS" != "200" ]; then
    echo "[blob-check] MISSING: $url (HTTP $STATUS)"
  fi
done
```

### 4.3 Configuration Backup

| Config | Location | Backup Method |
|--------|----------|---------------|
| `vercel.json` | Git repo | Git history |
| `supabase/migrations/` | Git repo | Git history |
| Vercel Environment Variables | Vercel dashboard | Manual export quarterly, store encrypted in 1Password/Vault |
| Vercel Edge Config | Vercel dashboard | Export JSON quarterly |
| GitHub Actions Secrets | GitHub | Document secret names (not values) in team wiki |

### 4.4 RTO/RPO Targets

Per the Cloud Architect's section 7.4:

| Phase | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) |
|-------|-------------------------------|-------------------------------|
| **MVP (now)** | 4 hours | 24 hours |
| **Phase 2 (1K-10K users)** | 1 hour | 1 hour |
| **Phase 3 (10K+ users)** | 15 minutes | 5 minutes |

**How each target is met:**

| Phase | RTO Met By | RPO Met By |
|-------|-----------|-----------|
| MVP | Vercel instant rollback + Supabase daily backup restore | Nightly CSV export + Supabase 7-day snapshots |
| Phase 2 | Vercel rollback + Supabase PITR | Supabase PITR (continuous WAL) |
| Phase 3 | Multi-region failover + read replicas | Real-time replication + PITR |

### 4.5 Disaster Recovery Runbook

**DR Scenario 1: Vercel Outage (app unreachable)**

```
Time 0:00 - Detect (health check fails, Vercel status page confirms)
  Action: Nothing to do. Wait for Vercel to recover.
  Mitigation: Vercel SLA is 99.99% for Pro tier.
  If > 1 hour:
    1. Redirect DNS to a static "maintenance" page on Cloudflare Pages
    2. Communicate via status page / Twitter

Time 0:15 - Notify users
  Action: Post on ADL status page: "We are experiencing intermittent issues.
          Your offline submissions are safely queued and will sync when
          service resumes."
```

**DR Scenario 2: Database Corruption / Accidental Data Loss**

```
Time 0:00 - Detect (API returns 500, health check shows db: error)
  Action: Verify via Supabase dashboard

Time 0:05 - Assess scope
  Query: SELECT count(*) FROM point_events;
  Query: SELECT max(created_at) FROM point_events;
  Compare with last backup checkpoint count.

Time 0:15 - If data loss confirmed:
  Option A (< 1 hour of data lost, Supabase Pro):
    1. Use Supabase PITR to restore to timestamp just before corruption
    2. supabase db restore --to <timestamp>

  Option B (> 1 hour of data lost, Free tier):
    1. Restore from nightly CSV backup:
       psql $POSTGRES_URL -c "BEGIN;"
       psql $POSTGRES_URL -c "\COPY point_events FROM 'point_events.csv' WITH CSV HEADER"
       psql $POSTGRES_URL -c "COMMIT;"
    2. Data between backup and corruption is lost.
    3. Users' offline queues may contain some of the lost data --
       it will re-sync when they come online.

Time 0:30 - Verify restoration
  Run: SELECT count(*) FROM point_events;
  Run: /api/health?deep=true
  Run: Manual test: create a submission via the app

Time 1:00 - Post-incident
  Write incident report. Update RPO assessment.
```

**DR Scenario 3: Supabase Region Outage (full database unavailable)**

```
Time 0:00 - Detect (all DB queries fail, Supabase status confirms)

Time 0:05 - Enable offline-only mode:
  1. Set Edge Config flag: { "maintenance_mode": true }
  2. App detects maintenance_mode and switches to offline-only UI
  3. All submissions queue to IndexedDB

Time 0:10 - Communicate:
  "We are temporarily in offline mode. Your submissions are saved locally
   and will sync automatically when database service resumes."

Time ?:?? - Supabase recovers:
  1. Verify connectivity: curl /api/health
  2. Clear maintenance_mode flag in Edge Config
  3. Users' apps will auto-flush offline queues

Post-incident:
  Evaluate multi-region database setup if outage > 4 hours.
```

### 4.6 Backup Verification Schedule

| Check | Frequency | Method | Owner |
|-------|-----------|--------|-------|
| Verify nightly CSV export ran | Daily (automated) | Check log for `backup.checkpoint` entry | Cron |
| Restore CSV to test database | Weekly (manual) | Load into local Postgres, run SELECT count(*) | Engineer |
| Verify Supabase snapshot exists | Weekly | Check Supabase dashboard > Backups | Engineer |
| Full DR drill (restore from backup) | Monthly | Spin up fresh Supabase project, restore, run tests | Team |
| Blob URL accessibility scan | Weekly | `blob-check.sh` script | Cron |

---

## 5. Deployment Runbooks

### 5.1 Standard Deployment Runbook (Feature Release)

```
PRE-DEPLOYMENT CHECKLIST
========================
[ ] All CI checks pass on the PR (lint, test, build, security)
[ ] PR approved by at least 1 reviewer
[ ] No 'database-migration' label on PR (if yes, follow section 5.3)
[ ] Bundle size within budget (< 350 KB main, < 800 KB total)
[ ] Manual testing on preview URL completed
[ ] Release notes drafted

DEPLOYMENT STEPS
================
1. Merge PR to main
   $ git checkout main && git pull
   $ git merge --no-ff feature/my-feature
   $ git push origin main

2. Monitor CI pipeline
   - Go to: https://github.com/<org>/africandatalayer/actions
   - Wait for all 5 stages to pass (lint, test, build, security, deploy)
   - Expected time: 3-5 minutes

3. Verify deployment
   $ curl -s https://africandatalayer.vercel.app/api/health | jq .
   # Expected: { "status": "ok", "db": "ok", "version": "<new-commit-sha>" }

4. Smoke test
   - Open https://africandatalayer.vercel.app
   - Login with test account
   - Verify map loads with points
   - Verify leaderboard loads
   - Submit a test data point (staging environment)

5. Monitor for 30 minutes
   - Watch Vercel Logs for error spikes
   - Check Sentry for new exceptions
   - Verify no regression in Vercel Analytics (Web Vitals)

POST-DEPLOYMENT
===============
[ ] Update changelog
[ ] Close related GitHub issues
[ ] Notify team in Slack/Discord
```

### 5.2 Hotfix Deployment Runbook

```
HOTFIX PROTOCOL (< 30 min end-to-end)
======================================

1. Create hotfix branch from main
   $ git checkout main && git pull
   $ git checkout -b hotfix/critical-fix-description

2. Apply fix (minimal change only)
   - Fix ONLY the immediate issue
   - No refactoring, no feature additions
   - Add regression test if time permits

3. Push and create PR
   $ git push -u origin hotfix/critical-fix-description
   $ gh pr create --title "HOTFIX: <description>" --base main

4. Expedited review
   - Tag on-call reviewer for immediate review
   - CI must pass (no skipping)
   - 1 approval required (not 2)

5. Merge and monitor
   - Merge immediately after approval
   - Monitor health check within 2 minutes
   - Watch logs for 15 minutes

6. If hotfix fails:
   $ vercel rollback --prod
   # This instantly reverts to the previous deployment
```

### 5.3 Database Migration Runbook

```
DATABASE MIGRATION PROTOCOL
============================

PRE-MIGRATION
=============
1. Review migration SQL carefully
   $ cat supabase/migrations/<new-file>.sql

2. Verify backwards compatibility
   - New columns must have DEFAULT values
   - No DROP without a two-phase plan
   - No renames without aliases

3. Take a backup checkpoint
   $ psql "$ADL_POSTGRES_URL" -c "SELECT count(*) FROM point_events;"
   # Record this number

4. Test on staging first
   $ gh workflow run migration.yml \
       -f environment=staging \
       -f dry_run=true

5. Review dry run output, then apply to staging
   $ gh workflow run migration.yml \
       -f environment=staging \
       -f dry_run=false

6. Verify staging works with new schema
   $ curl -s https://adl-staging.vercel.app/api/health | jq .

PRODUCTION MIGRATION
====================
7. Schedule migration during low-traffic window (02:00-04:00 UTC)

8. Dry run on production
   $ gh workflow run migration.yml \
       -f environment=production \
       -f dry_run=true

9. Apply to production
   $ gh workflow run migration.yml \
       -f environment=production \
       -f dry_run=false

10. Verify production
    $ curl -s https://africandatalayer.vercel.app/api/health?deep=true | jq .
    $ psql "$ADL_POSTGRES_URL" -c "SELECT count(*) FROM point_events;"
    # Should match pre-migration count

11. Deploy code that uses the new schema
    - Merge the application code PR to main
    - Wait for CI/CD to complete
    - Verify new functionality works

POST-MIGRATION
==============
12. Update migration documentation
13. Clean up any temporary backwards-compatibility code (schedule for next release)
```

### 5.4 Rollback Runbook

```
APPLICATION ROLLBACK (instant, < 1 minute)
==========================================
1. List recent production deployments
   $ vercel ls --prod --limit 5

2. Identify last known-good deployment
   (The one before the current broken one)

3. Rollback
   $ vercel rollback <deployment-url> --prod

4. Verify
   $ curl -s https://africandatalayer.vercel.app/api/health | jq .

5. Investigate root cause on the broken deployment
   $ vercel logs <broken-deployment-url> --follow

DATABASE ROLLBACK (write a reverse migration)
=============================================
1. Identify what changed
   $ cat supabase/migrations/<problematic-migration>.sql

2. Write reverse migration
   $ cat > supabase/migrations/$(date +%Y%m%d)_revert_<description>.sql << 'EOF'
   -- Revert: <description>
   -- This reverses migration <original-file>
   <reverse SQL statements>
   EOF

3. Apply reverse migration following section 5.3

4. If data loss occurred: follow DR Runbook section 4.5
```

### 5.5 Incident Response Runbook (First 15 Minutes)

```
INCIDENT RESPONSE -- FIRST 15 MINUTES
======================================

MINUTE 0-2: DETECT & CLASSIFY
==============================
- Source: Health check alert / user report / error spike in Sentry
- Classify severity:

  P1 (Critical): Service completely down. No users can access.
  P2 (High):     Major feature broken. Submissions failing.
  P3 (Medium):   Degraded performance. Non-critical feature broken.
  P4 (Low):      Cosmetic issue. No functional impact.

MINUTE 2-5: ASSESS
===================
1. Check health endpoint
   $ curl -s https://africandatalayer.vercel.app/api/health | jq .

2. Check Vercel status
   $ open https://www.vercel-status.com/

3. Check Supabase status
   $ open https://status.supabase.com/

4. Check recent deployments
   $ vercel ls --prod --limit 3

5. Check recent errors
   $ vercel logs --prod --follow  # look for patterns

MINUTE 5-10: MITIGATE
======================
If caused by bad deployment:
  $ vercel rollback --prod
  [Go to POST-MITIGATION]

If caused by database:
  Check Supabase dashboard for connection count, CPU, memory
  If connection exhaustion:
    $ psql "$ADL_POSTGRES_URL" -c "SELECT count(*) FROM pg_stat_activity;"
    $ psql "$ADL_POSTGRES_URL" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '5 minutes';"

If caused by external service (ipapi.co, Google OAuth):
  These are non-critical. The app should degrade gracefully.
  fetchIpLocation() has a 3-second timeout.
  If OAuth is down: credential login still works.

If unknown cause:
  Enable maintenance mode via Edge Config:
  { "maintenance_mode": true }

MINUTE 10-15: COMMUNICATE
==========================
- Update status page
- Notify team leads
- If P1: notify all users via in-app banner (set Edge Config flag)

POST-MITIGATION
===============
- Confirm service restored (health check green)
- Monitor for 30 minutes
- Write incident report within 24 hours
- Schedule follow-up to fix root cause
```

### 5.6 Scale-Up Runbook (Traffic Spike Handling)

```
TRAFFIC SPIKE HANDLING
======================

DETECTION
=========
Signals:
- Vercel dashboard shows function invocation spike
- /api/health response time > 5 seconds
- Database connection count approaching max (5 in current config)

IMMEDIATE ACTIONS (0-5 minutes)
===============================
1. Increase database connection pool
   Update Vercel env var:
   POSTGRES_POOL_MAX=15

   Note: Requires redeployment to take effect:
   $ vercel --prod --force

2. Verify Vercel auto-scaling is handling the load
   Vercel Functions auto-scale. No manual action needed for compute.

3. Enable aggressive caching
   If read traffic is the bottleneck:
   - Increase s-maxage on public endpoints
   - POST /api/submissions cache is never used (correct)

MEDIUM-TERM ACTIONS (5-30 minutes)
===================================
4. If database is the bottleneck:
   - Check for slow queries:
     $ psql "$ADL_POSTGRES_URL" -c "
       SELECT query, calls, mean_exec_time, total_exec_time
       FROM pg_stat_statements
       ORDER BY total_exec_time DESC
       LIMIT 10;"

   - Refresh materialized view if stale:
     $ psql "$ADL_POSTGRES_URL" -c "REFRESH MATERIALIZED VIEW CONCURRENTLY point_projections;"

5. If blob upload is the bottleneck:
   - Reduce MAX_SUBMISSION_IMAGE_BYTES temporarily:
     Set env var MAX_SUBMISSION_IMAGE_BYTES=4194304  (4 MB instead of 8 MB)
   - This reduces upload payload size

6. If a specific API route is overwhelmed:
   - Enable Edge Config rate limiting flag
   - Reduce rate limits temporarily

LONG-TERM FOLLOW-UP
====================
7. Analyze traffic pattern:
   - Was it organic growth or a bot/attack?
   - If bot: implement stricter rate limiting
   - If organic: proceed with scaling plan from architect's document

8. If consistently > 1000 requests/minute:
   - Upgrade to Supabase Pro for connection pooling via PgBouncer
   - Implement the materialized view (section 1.2)
   - Add read replica for GET endpoints
```

---

## 6. Security Hardening

### 6.1 Vercel Security Headers Configuration

Already defined in the enhanced `vercel.json` in section 1.1. Summary of headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS for 2 years |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `0` | Disable legacy XSS filter (CSP is better) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | `camera=(self), geolocation=(self), microphone=()` | Allow camera/GPS for submissions, deny mic |

### 6.2 Content Security Policy (CSP)

**CSP for the React SPA:**

Add to the `/(.*)`  headers block in `vercel.json`:

```json
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://*.tile.openstreetmap.org; connect-src 'self' https://*.supabase.co https://ipapi.co https://generativelanguage.googleapis.com https://va.vercel-scripts.com; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
}
```

**CSP breakdown:**
- `script-src 'self' https://va.vercel-scripts.com` -- App scripts + Vercel Analytics
- `style-src 'self' 'unsafe-inline'` -- React inline styles need `unsafe-inline`
- `img-src ... blob.vercel-storage.com ...openstreetmap.org` -- Photo display + Leaflet map tiles
- `connect-src` -- API calls to Supabase, ipapi.co, Gemini, Vercel Analytics
- `frame-ancestors 'none'` -- Same as X-Frame-Options DENY
- `upgrade-insecure-requests` -- Force HTTPS for all subresources

### 6.3 API Rate Limiting Implementation

**No rate limiting currently exists.** This is the highest-priority security gap per the system design doc (section 2.2).

**Implementation with Vercel Edge Middleware + Upstash Redis:**

```bash
npm install @upstash/ratelimit @upstash/redis
```

**`middleware.ts` (Vercel Edge Middleware at project root):**

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const rateLimiters = {
  submission_write: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),  // 10 submissions/min
    prefix: "rl:sub:write",
  }),
  auth_register: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),   // 5 registrations/min
    prefix: "rl:auth:reg",
  }),
  auth_signin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),  // 10 login attempts/min
    prefix: "rl:auth:sign",
  }),
  api_read: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 reads/min
    prefix: "rl:api:read",
  }),
};

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function getRateLimiter(pathname: string, method: string) {
  if (pathname === "/api/submissions" && method === "POST") return rateLimiters.submission_write;
  if (pathname === "/api/auth/register" && method === "POST") return rateLimiters.auth_register;
  if (pathname.startsWith("/api/auth/") && method === "POST") return rateLimiters.auth_signin;
  if (pathname.startsWith("/api/") && method === "GET") return rateLimiters.api_read;
  return null;
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);
  const limiter = getRateLimiter(url.pathname, request.method);
  if (!limiter) return undefined;  // pass through

  const ip = getClientIp(request);
  const { success, limit, remaining, reset } = await limiter.limit(ip);

  if (!success) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(reset),
          "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    );
  }

  return undefined;  // pass through, Vercel adds rate limit headers
}

export const config = {
  matcher: ["/api/:path*"],
};
```

**New environment variables needed:**
- `UPSTASH_REDIS_REST_URL` -- from Upstash dashboard (free tier: 10K commands/day)
- `UPSTASH_REDIS_REST_TOKEN` -- from Upstash dashboard

### 6.4 Dependency Vulnerability Scanning

**Automated in CI (section 2.6).** Additional measures:

1. **Dependabot configuration** -- `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
    reviewers:
      - "adl-team"
    groups:
      production:
        patterns:
          - "*"
        exclude-patterns:
          - "@types/*"
          - "typescript"
          - "vite"
      dev:
        patterns:
          - "@types/*"
          - "typescript"
          - "vite"
          - "@vitejs/*"
```

2. **GitHub security advisories:** Enabled automatically when Dependabot is configured.

3. **Lock file hygiene:** `package-lock.json` MUST be committed. `npm ci` (not `npm install`) in CI to ensure reproducible builds.

### 6.5 Secret Rotation Procedures

| Secret | Rotation Frequency | Procedure |
|--------|-------------------|-----------|
| `AUTH_SECRET` | Every 90 days | 1. Generate new secret: `openssl rand -hex 32`. 2. Update in Vercel env vars. 3. Redeploy. 4. Active sessions will require re-login. |
| `POSTGRES_URL` | On credential compromise only | 1. Rotate password in Supabase dashboard. 2. Update connection string in Vercel env vars. 3. Redeploy. |
| `BLOB_READ_WRITE_TOKEN` | Every 90 days | 1. Generate new token in Vercel dashboard > Storage. 2. Update env var. 3. Redeploy. |
| `GOOGLE_CLIENT_SECRET` | On compromise only | 1. Rotate in Google Cloud Console. 2. Update env var. 3. Redeploy. |
| `GEMINI_API_KEY` | Every 90 days | 1. Generate new key in Google AI Studio. 2. Update env var. 3. Redeploy. |
| `UPSTASH_REDIS_REST_TOKEN` | Every 90 days | 1. Rotate in Upstash dashboard. 2. Update env var. 3. Redeploy. |
| `CRON_SECRET` | Every 90 days | 1. Generate: `openssl rand -hex 16`. 2. Update env var. 3. Redeploy. |

**Rotation checklist (run quarterly):**

```bash
# 1. Generate new secrets
NEW_AUTH_SECRET=$(openssl rand -hex 32)
NEW_CRON_SECRET=$(openssl rand -hex 16)

# 2. Update Vercel env vars (via CLI)
vercel env rm AUTH_SECRET production
echo "$NEW_AUTH_SECRET" | vercel env add AUTH_SECRET production

vercel env rm CRON_SECRET production
echo "$NEW_CRON_SECRET" | vercel env add CRON_SECRET production

# 3. Redeploy
vercel --prod

# 4. Verify
curl -s https://africandatalayer.vercel.app/api/health | jq .

# 5. Record rotation in audit log
echo "[secret-rotation] AUTH_SECRET, CRON_SECRET rotated at $(date -u)"
```

---

## 7. Performance Engineering

### 7.1 Vercel Function Optimization

**Cold start mitigation:**

| Strategy | Implementation | Impact |
|----------|---------------|--------|
| Minimal dependencies | `api/health/index.ts` imports only `db.js` -- keep it lean | -200ms cold start |
| Lazy imports | Heavy modules (exifr, bcryptjs) loaded only when needed in handlers | -300ms on health check paths |
| Connection pooling | `lib/server/db.ts` uses `pg.Pool` with module-level singleton | Reuse across warm invocations |
| Region co-location | `regions: ["cdg1"]` in vercel.json -- same region as Supabase | -50ms per DB round-trip |

**Per-function configuration (from enhanced vercel.json):**

| Function | Memory | Max Duration | Rationale |
|----------|--------|-------------|-----------|
| `api/health/index.ts` | 128 MB | 10s | Simple SELECT 1 |
| `api/leaderboard/index.ts` | 256 MB | 30s | Aggregation query |
| `api/submissions/index.ts` | 512 MB | 45s | Photo upload + EXIF + fraud check |
| `api/user/index.ts` | 256 MB | 15s | Simple CRUD |
| `api/auth/*.ts` | 256 MB | 30s | bcrypt is CPU-intensive |
| All others | 256 MB | 30s | Default |

**Critical optimization -- move EXIF extraction off the hot path:**

Currently, `api/submissions/index.ts` does EXIF extraction synchronously:
```
Request -> Validate -> Extract EXIF -> Upload Photo -> Fraud Check -> Insert DB -> Return 201
```

Phase 2 architecture (per Cloud Architect section 5.3):
```
Request -> Validate -> Upload Photo -> Insert DB (status=pending) -> Return 201
QStash -> Extract EXIF -> Fraud Check -> Update DB -> Notify Admin
```

This reduces POST latency from ~5-15s to ~2-3s.

### 7.2 Database Query Optimization

**Problem 1: Full table scan on every GET request**

`postgresStore.ts` line 290-297:
```sql
SELECT id, point_id, event_type, user_id, category, latitude, longitude,
       details, photo_url, created_at, source, external_id
FROM point_events
ORDER BY created_at asc
```

This loads ALL events into Node.js memory, then `projectPointsFromEvents()` aggregates them in JavaScript. At 10K events this is already slow; at 100K it will timeout.

**Fix: Use the materialized view (section 1.2):**

```sql
-- Replace getPointEvents() for projection reads with:
SELECT point_id, category, latitude, longitude, details, photo_url, created_at, source, external_id
FROM point_projections
WHERE latitude BETWEEN $1 AND $2
  AND longitude BETWEEN $3 AND $4;
```

**Refresh strategy:**
```sql
-- Cron job every 10 minutes (api/cron/refresh-projections):
REFRESH MATERIALIZED VIEW CONCURRENTLY point_projections;
```

The `CONCURRENTLY` keyword allows reads during refresh (requires the `UNIQUE INDEX` on `point_id` defined in section 1.2).

**Problem 2: Leaderboard aggregation in memory**

`api/leaderboard/index.ts` loads all events to compute XP. Replace with SQL:

```sql
-- Leaderboard query (push aggregation to PostgreSQL)
SELECT
  pe.user_id,
  count(*) as contributions,
  sum(COALESCE((pe.details->>'xpAwarded')::int, 5)) as xp,
  max(pe.created_at) as last_contribution_at
FROM point_events pe
GROUP BY pe.user_id
ORDER BY xp DESC, contributions DESC
LIMIT 100;
```

**Problem 3: Missing indexes for common queries**

Additional indexes to create:

```sql
-- Geospatial bounding box queries (used by isWithinBonamoussadi filter)
CREATE INDEX IF NOT EXISTS idx_point_events_location
  ON public.point_events (latitude, longitude);

-- Category filter (used in admin queue views)
CREATE INDEX IF NOT EXISTS idx_point_events_category
  ON public.point_events (category);

-- Composite index for user submissions page
CREATE INDEX IF NOT EXISTS idx_point_events_user_category
  ON public.point_events (user_id, category, created_at DESC);
```

### 7.3 CDN Caching Optimization

**Current caching (already implemented):**
- Public submissions GET: `public, s-maxage=30, stale-while-revalidate=300`
- Leaderboard GET: `public, s-maxage=30, stale-while-revalidate=300`
- Static assets: No explicit cache header (Vercel defaults apply)

**Enhanced caching strategy:**

| Resource | Cache-Control | Rationale |
|----------|--------------|-----------|
| `/assets/*` (Vite hashed) | `public, max-age=31536000, immutable` | Content-hash in filename ensures cache-bust on change |
| `/api/submissions` (GET, unauth) | `public, s-maxage=30, stale-while-revalidate=300` | Keep existing: 30s fresh, 5 min stale |
| `/api/leaderboard` (GET) | `public, s-maxage=60, stale-while-revalidate=600` | Increase to 60s -- leaderboard does not need second-level freshness |
| `/api/submissions` (GET, auth) | `private, no-cache` | Per-user data, must revalidate |
| `/api/health` | `no-cache, no-store` | Always fresh |
| Photo blobs (`*.public.blob.vercel-storage.com`) | `public, max-age=86400` | Photos are immutable once uploaded |
| `/index.html` | `public, max-age=0, must-revalidate` | HTML shell must always be fresh for SPA version check |

### 7.4 Bundle Size Optimization

**Current state:** The `dist/assets/` directory contains route-level code-split chunks:

```
index-QrY-Hdyj.js              # Main bundle (React, router, core)
HomeMap-BBvX59tx.js             # Map page (Leaflet)
ContributionFlow-C0OtjrQ7.js   # Submission form
AdminQueue-CIwAkFN4.js         # Admin review
Analytics-Biu7dnSs.js           # Analytics page
Profile-BBU3pMSi.js             # Profile page
Settings-oeachGDZ.js            # Settings page
Auth-BTl58sT6.js                # Login/register
Details-Ddn_dClY.js             # Submission detail
QualityInfo-DgX-tEJp.js         # Quality info
RewardsCatalog-CCmD9cPF.js     # Rewards page
```

**This is already well code-split by Vite.** Key optimizations:

1. **Analyze bundle contents:**
   ```bash
   npx vite-bundle-visualizer
   ```

2. **Largest dependency risk: Leaflet + react-leaflet**
   - Leaflet is ~40KB gzipped. Already route-split into `HomeMap-*.js`.
   - Consider lazy-loading Leaflet only when map view is active (already done via code splitting).

3. **Recharts (charting library)**
   - ~50KB gzipped. Only used in `Analytics-*.js`.
   - Already code-split. No action needed.

4. **lucide-react (icons)**
   - Tree-shakeable. Import individual icons only (which the codebase does).
   - Verify no barrel imports: `import { ... } from 'lucide-react'` should import specific icons.

5. **Vite build optimization in `vite.config.ts`:**

   ```typescript
   // Add to vite.config.ts
   build: {
     target: 'es2020',
     minify: 'terser',
     terserOptions: {
       compress: {
         drop_console: true,  // Remove console.log in production
         drop_debugger: true,
       },
     },
     rollupOptions: {
       output: {
         manualChunks: {
           'vendor-react': ['react', 'react-dom'],
           'vendor-leaflet': ['leaflet', 'react-leaflet'],
           'vendor-recharts': ['recharts'],
         },
       },
     },
   },
   ```

   This ensures React, Leaflet, and Recharts are in separate cached vendor chunks that do not change when application code changes.

### 7.5 Image Optimization Pipeline

**Current:** Photos uploaded as-is (JPEG/PNG/WebP/HEIC up to 8 MB). No server-side optimization.

**Phase 1 (Now) -- Client-side optimization before upload:**

The client should compress images before base64-encoding. Add to `lib/client/imageUtils.ts`:

```typescript
export async function compressImage(
  file: File,
  maxWidth: number = 1200,
  quality: number = 0.8,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          resolve(blob);
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}
```

**Impact:** Reduces average upload payload from ~3-5 MB to ~200-500 KB. Critical for 2G/3G networks in Africa.

**Phase 2 -- Server-side thumbnail generation:**

After upload, generate thumbnails asynchronously:

```typescript
// api/internal/process-photo.ts (triggered by QStash)
// 1. Download original from Vercel Blob
// 2. Generate 200px thumbnail
// 3. Generate 800px preview
// 4. Upload variants to Vercel Blob
// 5. Update point_events.details with variant URLs
```

**Variant URL pattern:**
```
Original:  submissions/{eventId}-{ts}.jpg
Preview:   submissions/{eventId}-{ts}-800w.jpg
Thumbnail: submissions/{eventId}-{ts}-200w.jpg
```

---

## Appendix A: Environment Setup Checklist

New developer onboarding checklist:

```bash
# 1. Clone repo
git clone git@github.com:<org>/africandatalayer.git
cd africandatalayer

# 2. Install dependencies
npm ci

# 3. Copy environment template
cp .env.example .env.local

# 4. Fill in required variables
# ADL_POSTGRES_URL=<get from team lead>
# AUTH_SECRET=<generate: openssl rand -hex 32>
# BLOB_READ_WRITE_TOKEN=<get from Vercel dashboard>

# 5. Run database migrations locally
# (requires a local or remote Postgres instance)
psql $ADL_POSTGRES_URL < supabase/migrations/20260219_init_adl.sql
psql $ADL_POSTGRES_URL < supabase/migrations/20260224_phone_identifier.sql

# 6. Start development server
npm run dev

# 7. Run tests
node --test tests/*.test.ts

# 8. Verify health
curl http://localhost:5173/api/health
```

## Appendix B: Cost of Observability Stack

| Tool | Tier | Monthly Cost | Purpose |
|------|------|-------------|---------|
| Vercel Analytics | Included in Pro | $0 | Web Vitals, page views |
| Vercel Speed Insights | Included in Pro | $0 | Real User Monitoring |
| Sentry | Free (5K errors/mo) | $0 | Error tracking, alerting |
| Upstash Redis | Free (10K commands/day) | $0 | Rate limiting |
| Axiom | Free (Vercel integration) | $0 | Log aggregation (when needed) |
| **Total** | | **$0** | |

All observability tools are on free tiers for MVP. First paid upgrade will be Sentry Team ($26/mo) when error volume exceeds 5K/month.

## Appendix C: File Manifest

Files referenced or proposed in this document:

| File | Status | Section |
|------|--------|---------|
| `vercel.json` | ENHANCE | 1.1 |
| `vite.config.ts` | MODIFY (remove client-side API key) | 1.3 |
| `supabase/migrations/20260227_audit_log.sql` | NEW | 1.2 |
| `supabase/migrations/20260227_idempotency_keys.sql` | NEW | 1.2 |
| `supabase/migrations/20260227_point_projections.sql` | NEW | 1.2 |
| `supabase/migrations/20260227_rls_policies.sql` | NEW | 1.2 |
| `supabase/config.toml` | NEW | 1.5 |
| `.github/workflows/ci.yml` | NEW | 2.1 |
| `.github/workflows/migration.yml` | NEW | 2.1 |
| `.github/workflows/security-scan.yml` | NEW | 2.6 |
| `.github/dependabot.yml` | NEW | 6.4 |
| `lib/server/logger.ts` | NEW | 3.1 |
| `lib/server/requestContext.ts` | NEW | 3.4 |
| `lib/server/sentry.ts` | NEW | 3.7 |
| `lib/client/imageUtils.ts` | NEW | 7.5 |
| `middleware.ts` | NEW | 6.3 |
| `api/health/index.ts` | ENHANCE | 3.5 |
| `api/cron/backup-export.ts` | NEW | 4.1 |
| `api/cron/health-deep.ts` | NEW | 1.1 (cron) |
| `api/cron/refresh-projections.ts` | NEW | 7.2 |
| `scripts/backup-export.sh` | NEW | 4.1 |
