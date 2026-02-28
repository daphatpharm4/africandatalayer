# ADL Cybersecurity Assessment

**Author:** Teammate 4 -- Cybersecurity Expert
**Date:** 2026-02-28
**Status:** Living document -- updates with each threat landscape change
**Predecessors:**
- [01-cloud-architecture.md](./01-cloud-architecture.md) (Cloud Architect)
- [02-system-design.md](./02-system-design.md) (System Design Expert)
- [03-cloud-engineering.md](./03-cloud-engineering.md) (Cloud Engineer)
**Scope:** Threat modeling, vulnerability assessment, security controls, incident response, and hardening for African Data Layer

---

## Table of Contents

1. [Threat Model (STRIDE)](#1-threat-model-stride)
2. [Vulnerability Assessment](#2-vulnerability-assessment)
3. [Security Controls Matrix](#3-security-controls-matrix)
4. [Incident Response Plan](#4-incident-response-plan)
5. [Security Hardening Checklist](#5-security-hardening-checklist)

---

## 1. Threat Model (STRIDE)

### 1.1 System Overview for Threat Modeling

**Trust boundaries identified in the ADL codebase:**

```
+-------------------------------------------------------------------+
|  TRUST BOUNDARY 1: Client Device (untrusted)                      |
|  - React SPA in browser                                           |
|  - IndexedDB offline queue (lib/client/offlineQueue.ts)           |
|  - Gemini API key embedded in client bundle (vite.config.ts:20)   |
|  - Photo capture + EXIF metadata                                  |
|  - GPS coordinates from navigator.geolocation                     |
+-------------------------------------------------------------------+
          |  HTTPS (TLS 1.2+)
          v
+-------------------------------------------------------------------+
|  TRUST BOUNDARY 2: Vercel Edge / CDN                              |
|  - Static asset serving                                           |
|  - Request routing to serverless functions                        |
|  - No WAF or rate limiting configured                             |
+-------------------------------------------------------------------+
          |
          v
+-------------------------------------------------------------------+
|  TRUST BOUNDARY 3: Vercel Serverless Functions (semi-trusted)     |
|  - api/auth/auth.ts -- Auth.js handler                            |
|  - api/auth/register.ts -- User registration                     |
|  - api/submissions/index.ts -- GET/POST submissions              |
|  - api/submissions/[id].ts -- GET/PUT/DELETE by ID               |
|  - api/user/index.ts -- Profile management                       |
|  - api/leaderboard/index.ts -- Public leaderboard                |
|  - api/health/index.ts -- Health check                           |
+-------------------------------------------------------------------+
          |  TLS (pooled connection)
          v
+-------------------------------------------------------------------+
|  TRUST BOUNDARY 4: Data Stores (trusted)                          |
|  - Supabase PostgreSQL (append-only event log + user profiles)    |
|  - Vercel Blob (submission photos, public access)                 |
|  - Vercel Edge Config (read-only fallback)                        |
+-------------------------------------------------------------------+
```

**Key assets to protect:**
- User credentials (password hashes, OAuth tokens)
- User PII (emails, phone numbers, names, GPS tracks)
- Submission data integrity (the core product value)
- Admin access controls
- API keys and service credentials
- Platform availability

### 1.2 Spoofing

#### S-1: Credential Stuffing on Registration and Login

**Risk:** HIGH

The registration endpoint (`api/auth/register.ts`) and credential login (`api/auth/auth.ts`) have zero rate limiting. An attacker can enumerate valid accounts by observing 409 (user exists) vs 201 (created) responses on the registration endpoint, then launch credential stuffing against the login endpoint.

**Current state:**
- Registration: No CAPTCHA, no rate limit, leaks user existence via 409 status (`api/auth/register.ts:39`)
- Login: Auth.js credential flow with no lockout, no rate limit (`api/auth/auth.ts:23-58`)
- Password policy: Only minimum 8 characters (`api/auth/register.ts:31`), no complexity requirements

**Attack scenario:**
1. Attacker scripts POST requests to `/api/auth/register` with common email addresses
2. 409 responses reveal which emails are registered
3. Attacker targets confirmed emails with credential stuffing against `/api/auth/callback/credentials`
4. Weak 8-character minimum means many passwords are guessable

#### S-2: Admin Account Hardcoded Pattern

**Risk:** CRITICAL

Admin authentication uses a single shared `ADMIN_EMAIL` + `ADMIN_PASSWORD` environment variable pair (`api/auth/auth.ts:36-48`). The code explicitly supports plaintext passwords as a fallback:

```typescript
// api/auth/auth.ts:42-44
if (adminPassword.startsWith("$2")) {
  adminMatch = await bcrypt.compare(password, adminPassword);
} else {
  // Fallback for plain-text password (legacy)
  adminMatch = password === adminPassword;
}
```

The `.env` file committed to the repository contains `ADMIN_PASSWORD=test1234` in plaintext. Even in production, a single admin credential shared across all admin sessions creates a single point of compromise.

#### S-3: Session Token Security

**Risk:** MEDIUM

Session management uses Auth.js JWT strategy (`api/auth/auth.ts:103`) with appropriate cookie settings:
- `httpOnly: true` (prevents XSS-based cookie theft)
- `sameSite: "lax"` (partial CSRF protection)
- `secure: true` in production (enforced by `isSecureRequest()` in `lib/auth.ts:8-12`)

However, JWT tokens have no explicit expiration configuration. Auth.js defaults to 30-day session tokens. Combined with no token rotation and no server-side session revocation capability, a stolen JWT remains valid for the full 30-day window.

#### S-4: Bearer Token Acceptance Without Scope Validation

**Risk:** MEDIUM

The `getAuthToken` function (`lib/auth.ts:24-31`) accepts both cookie-based and Bearer token authentication. The Bearer path decodes the JWT directly without validating audience, issuer, or scope claims. Any valid JWT signed with `AUTH_SECRET` grants full access regardless of its original intended use.

### 1.3 Tampering

#### T-1: Offline Queue Client-Side Tampering

**Risk:** HIGH

The offline queue (`lib/client/offlineQueue.ts`) stores submission payloads in IndexedDB. Users with DevTools access can:
1. Modify GPS coordinates in queued submissions
2. Alter category or details fields
3. Replace photo data with stock images
4. Change the `idempotencyKey` to replay submissions

The idempotency key is generated client-side (`offlineQueue.ts:110`) and sent as an option to the sync function (`offlineQueue.ts:233`), but **the server never checks it**. The POST handler in `api/submissions/index.ts` has no idempotency logic whatsoever.

#### T-2: Photo Metadata Spoofing

**Risk:** HIGH

While the fraud detection system (`lib/server/submissionFraud.ts`) extracts and validates EXIF GPS data, EXIF metadata is trivially spoofable. An attacker can:
1. Use tools like `exiftool` to set arbitrary GPS coordinates in a photo
2. Set `DateTimeOriginal` to fake the capture time
3. Set `Make`/`Model` to impersonate a different device

The system does compare photo GPS with submission GPS and IP-based geolocation, but if the attacker controls all three (spoofed EXIF, spoofed browser geolocation, VPN for IP), all checks pass.

#### T-3: PUT Endpoint Bypasses Photo Requirement

**Risk:** HIGH

The `PUT` handler in `api/submissions/[id].ts:68-113` creates an `ENRICH_EVENT` without requiring a photo upload:

```typescript
// api/submissions/[id].ts:100
photoUrl: typeof body?.photoUrl === "string" ? body.photoUrl : undefined,
```

This accepts an arbitrary URL as the photo without validation, download, or storage. An attacker can:
1. Point `photoUrl` to any external URL
2. Submit enrichment events without photographic proof
3. Inject URLs that could be used for tracking (e.g., unique URLs per victim to detect when admins view submissions)

#### T-4: XP Manipulation via Rapid Submissions

**Risk:** MEDIUM

The XP award logic (`api/submissions/index.ts:677-681`) unconditionally adds 5 XP per submission with no duplicate check, no rate limit, and no cap:

```typescript
profile.XP = (profile.XP ?? 0) + BASE_EVENT_XP;
await upsertUserProfile(auth.id, profile);
```

An attacker can script hundreds of submissions to farm XP for the rewards catalog and leaderboard.

### 1.4 Repudiation

#### R-1: Insufficient Audit Trail for Administrative Actions

**Risk:** MEDIUM

Admin operations (delete events via `api/submissions/[id].ts:115-144`, viewing admin_events) are not logged to any audit trail. The only log statement in the submission flow (`api/submissions/index.ts:673-675`) is gated behind `NODE_ENV !== "production"`, meaning production submissions produce no server-side log.

Admin actions that should be logged but are not:
- Event deletion
- Admin event view access
- User profile modifications
- Map scope changes

#### R-2: No Contributor Attribution Integrity

**Risk:** MEDIUM

The `userId` field on events comes from the JWT token (`api/submissions/index.ts:646`). While the JWT is server-signed, there is no mechanism to prove that the *physical person* who submitted data is the token holder. For compliance and data quality, this means:
- No digital signature on individual submissions
- No device attestation
- No biometric verification

### 1.5 Information Disclosure

#### I-1: `.env` File Committed to Git with Production Secrets

**Risk:** CRITICAL -- IMMEDIATE ACTION REQUIRED

The file `.env` is tracked in git and contains live credentials:

```
AUTH_SECRET=XdY8VIr66Q077SVFIZmXqpTySovBixl8wFHxxAFeJtQp
GOOGLE_CLIENT_ID=73914770275-2likrarh0k9l05ug5u8ut66vte15tb40.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=yGOCSPX-TL7OV_iMZs-8oK6zpVybyB78jnsY
VERCEL_API_TOKEN=x3oYJk7MoutMESNe91C0Fv1s
POSTGRES_URL=postgres://postgres.rhslszcwchyzkaooxzht:ApcWC6XbmfKBbp6S@aws-1-us-east-1.pooler.supabase.com:6543/postgres
EDGE_CONFIG=https://edge-config.vercel.com/ecfg_dihwwvwrdqg25ajeeoyrmeohawzv?token=07dab6e5-8ade-44bd-9c8d-73b04107b547
ADMIN_PASSWORD=test1234
VERCEL_OIDC_TOKEN=eyJhbGciOiJSUzI1NiIs...
```

The `.gitignore` only excludes `.env*.local` (line 3), NOT `.env` itself. Every secret listed above must be considered compromised.

#### I-2: Gemini API Key Baked into Client Bundle

**Risk:** HIGH

`vite.config.ts:20-21` injects the Gemini API key into the client-side JavaScript bundle:

```typescript
define: {
  'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
},
```

This means anyone viewing the production JavaScript source can extract the API key. The key is then used directly in `lib/gemini.ts:4`:

```typescript
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
```

Impact: An attacker can use the API key for their own Gemini API calls, incurring costs on ADL's Google Cloud billing account.

#### I-3: Leaderboard Exposes User Identifiers

**Risk:** MEDIUM

The leaderboard endpoint (`api/leaderboard/index.ts:88-99`) returns `userId` for every top contributor. The `userId` is typically an email address (since email is the primary identifier). This is returned on a public, unauthenticated endpoint with cache headers set to public (`LEADERBOARD_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=300"`).

Combined with the registration endpoint user enumeration (S-1), this gives attackers a ready-made target list.

#### I-4: Password Hashes Returned in User Profile

**Risk:** HIGH

The `rowToUserProfile` function (`lib/server/storage/postgresStore.ts:71-86`) includes `passwordHash` in the returned `UserProfile` object:

```typescript
passwordHash: typeof row.password_hash === "string" ? row.password_hash : undefined,
```

The `GET /api/user` endpoint (`api/user/index.ts:21`) returns the full profile object:

```typescript
return jsonResponse(profile, { status: 200 });
```

This means the bcrypt hash is sent to the client in the user profile response. While bcrypt hashes are computationally expensive to crack, they should never leave the server.

#### I-5: Unhandled Errors Propagate Stack Traces

**Risk:** MEDIUM

Several API handlers use `throw error` as the final fallback (`api/submissions/index.ts:449`, `api/submissions/[id].ts:48`, etc.). When `isStorageUnavailableError` returns false, the raw error is thrown and Vercel's default error handler may expose stack traces, internal paths, and implementation details in the response.

#### I-6: Health Endpoint Exposes Database Connectivity

**Risk:** LOW

The health endpoint (`api/health/index.ts`) reveals whether the database is reachable. While useful for monitoring, it gives attackers reconnaissance information about infrastructure state and can be used to detect when database attacks are effective.

### 1.6 Denial of Service

#### D-1: No Rate Limiting on Any Endpoint

**Risk:** HIGH

There is zero rate limiting across the entire API surface. No middleware, no Vercel configuration, no application-level throttling. Every endpoint is vulnerable to abuse:

- `POST /api/auth/register` -- mass account creation
- `POST /api/auth/callback/credentials` -- brute force login
- `POST /api/submissions` -- resource exhaustion (each submission triggers photo upload to Vercel Blob, EXIF parsing, IP geolocation lookup, and database write)
- `GET /api/submissions` -- database query amplification (loads ALL events on every request)
- `GET /api/leaderboard` -- same full-table scan pattern

#### D-2: Unbounded Full-Table Scans

**Risk:** HIGH

The `getPointEvents` function (`lib/server/storage/postgresStore.ts:289-298`) loads every row from the `point_events` table on every GET request:

```sql
select id, point_id, event_type, user_id, category, latitude, longitude,
       details, photo_url, created_at, source, external_id
from point_events
order by created_at asc
```

At scale (10K+ events with JSONB `details` containing fraud metadata, photo URLs, and client device info), this will:
1. Exhaust the 256MB/512MB serverless function memory
2. Saturate the database connection pool (max 5 connections, `lib/server/db.ts:121`)
3. Timeout (10-second query timeout, `lib/server/db.ts:19`)

#### D-3: Photo Upload Resource Exhaustion

**Risk:** MEDIUM

The submission endpoint accepts up to 8MB base64-encoded images (`MAX_IMAGE_BYTES`, `api/submissions/index.ts:56`). Since base64 encoding increases payload size by ~33%, the actual HTTP request can be ~11MB. The endpoint processes two photos per submission (primary + secondary), each requiring:
1. Base64 decode to Buffer
2. EXIF parsing via `exifr`
3. Upload to Vercel Blob

With no rate limit, an attacker can send hundreds of 11MB requests simultaneously, exhausting Vercel's concurrent execution limits and Blob storage quota.

#### D-4: External IP Geolocation Dependency

**Risk:** LOW

The `fetchIpLocation` function (`api/submissions/index.ts:223-239`) calls `ipapi.co` for every submission. The 3-second timeout means that if ipapi.co is slow or unavailable, submissions are delayed. If ipapi.co rate-limits the server IP, all geolocation lookups fail silently (returning `null`), potentially allowing submissions without proper location validation.

### 1.7 Elevation of Privilege

#### E-1: Admin Role Determination via Environment Variable Email Match

**Risk:** HIGH

Admin status is determined solely by matching the user's email against `ADMIN_EMAIL` (`api/auth/auth.ts:36-48`, `api/auth/auth.ts:122`, `api/auth/auth.ts:180-186`). The admin flag is embedded in the JWT token:

```typescript
// api/auth/auth.ts:182-184
if (adminEmail && email && adminEmail === email) {
  (token as { isAdmin?: boolean }).isAdmin = true;
}
```

**Problem 1:** Only one admin email is supported. There is no role hierarchy, no group-based access, no way to have multiple admins without sharing the single `ADMIN_EMAIL` credential.

**Problem 2:** The JWT `isAdmin` claim is trusted by all endpoints without re-verification against the database. If `ADMIN_EMAIL` is changed (e.g., to revoke admin), existing JWTs with `isAdmin: true` remain valid until they expire (up to 30 days).

#### E-2: User Profile Self-Escalation Blocked but Fragile

**Risk:** MEDIUM

The `PUT /api/user` endpoint (`api/user/index.ts:66-73`) does check that non-admin users cannot set `mapScope` beyond `bonamoussadi`:

```typescript
if (!profile.isAdmin && nextScope !== "bonamoussadi") {
  return errorResponse("Only admin users can unlock map scope", 403);
}
```

However, the `profile.isAdmin` check reads from the database, while admin status is determined by the JWT `isAdmin` claim and synced to the database in the `GET /api/user` handler (`api/user/index.ts:24-27`). If there is any race condition or inconsistency between the JWT claim and database state, escalation could occur.

#### E-3: IDOR in Submission Detail View

**Risk:** MEDIUM

The `GET /api/submissions/[id]` endpoint (`api/submissions/[id].ts:58-63`) allows any authenticated user to view projected point data for any `pointId`:

```typescript
const point = points.find((item) => item.pointId === id || item.id === id);
if (point) return jsonResponse(point, { status: 200 });
```

Only the `view=event` path checks ownership (`canViewEventDetail`). The default path returns any projected point to any authenticated user, potentially including details from other users' enrichment events aggregated into the projection.

#### E-4: PUT Endpoint Missing Admin/Owner Check for Enrichment

**Risk:** MEDIUM

The `PUT /api/submissions/[id]` handler (`api/submissions/[id].ts:68-113`) requires authentication but does not verify that the user owns the target submission or has admin privileges. Any authenticated user can create an `ENRICH_EVENT` for any existing point, potentially overwriting legitimate data.

---

## 2. Vulnerability Assessment

### 2.1 Critical Severity

#### VULN-001: Live Secrets Committed to Git Repository

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **File** | `.env` (entire file) |
| **CVSS** | 9.8 (Network/Low/None/Changed/High/High/High) |
| **Priority** | FIX NOW -- before any further deployment |

**Description:** The `.env` file containing production database credentials, API tokens, OAuth secrets, and the admin password is committed to the git repository. The `.gitignore` file only excludes `.env*.local`, not `.env` itself.

**Exposed secrets:**
1. `AUTH_SECRET` -- JWT signing key. Compromise allows forging any user session including admin.
2. `POSTGRES_URL` -- Full database connection string with password. Allows direct database access.
3. `GOOGLE_CLIENT_SECRET` -- OAuth client secret. Allows impersonating the application in Google OAuth flows.
4. `VERCEL_API_TOKEN` -- Allows deploying code, modifying environment variables, and accessing all project data.
5. `ADMIN_PASSWORD=test1234` -- Admin password in plaintext.
6. `EDGE_CONFIG` token -- Access to Edge Config data.
7. `VERCEL_OIDC_TOKEN` -- Vercel OIDC token for project access.

**Proof of concept:**
```bash
# Anyone with repo access can read the file
cat .env
# Use POSTGRES_URL to connect directly
psql "postgres://postgres.rhslszcwchyzkaooxzht:ApcWC6XbmfKBbp6S@aws-1-us-east-1.pooler.supabase.com:6543/postgres"
# Forge an admin JWT using AUTH_SECRET
```

**Remediation:**
1. Immediately rotate ALL secrets listed above
2. Add `.env` to `.gitignore`
3. Remove `.env` from git history using `git filter-branch` or BFG Repo Cleaner
4. Revoke and regenerate: Supabase database password, Google OAuth credentials, Vercel API token, AUTH_SECRET
5. Change Supabase database password from Supabase dashboard
6. Set all secrets exclusively via Vercel Environment Variables dashboard
7. Audit git log for any forks or clones that may have captured the secrets

#### VULN-002: Gemini API Key Exposed in Client Bundle

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **File** | `vite.config.ts:20-21`, `lib/gemini.ts:4` |
| **CVSS** | 8.6 |
| **Priority** | FIX NOW |

**Description:** The Vite build configuration injects `GEMINI_API_KEY` as a compile-time constant into the client-side JavaScript bundle. This key is visible to anyone who opens browser DevTools on the production site.

**Proof of concept:**
```javascript
// In browser console on the production site:
// Search the bundled JS for the API key string
// Or inspect the Network tab for requests to generativelanguage.googleapis.com
```

**Remediation:**
```typescript
// vite.config.ts -- REMOVE these lines:
define: {
  'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
},

// Instead, create a server-side proxy:
// api/ai/search.ts
export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const { query, lat, lng } = await request.json();
  // Call Gemini with server-side key
  const result = await searchLocations(query, lat, lng);
  return jsonResponse(result);
}
```

#### VULN-003: Plaintext Admin Password Support

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **File** | `api/auth/auth.ts:42-46` |
| **CVSS** | 8.1 |
| **Priority** | FIX NOW |

**Description:** The admin authentication code has a fallback path that compares passwords in plaintext when `ADMIN_PASSWORD` does not start with `$2` (bcrypt prefix). The current `.env` contains `ADMIN_PASSWORD=test1234`, which triggers this plaintext path.

**Proof of concept:**
```bash
curl -X POST https://adl.vercel.app/api/auth/callback/credentials \
  -d "identifier=test@example.com&password=test1234&csrfToken=..."
```

**Remediation:**
```bash
# Generate bcrypt hash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('NEW_STRONG_PASSWORD_HERE', 12));"
# Set in Vercel env vars (NOT in .env file)
# ADMIN_PASSWORD=$2a$12$... (the bcrypt hash output)
```

Remove the plaintext fallback:
```typescript
// api/auth/auth.ts -- Remove the else branch entirely:
if (adminPassword.startsWith("$2")) {
  adminMatch = await bcrypt.compare(password, adminPassword);
} else {
  // DELETE THIS BRANCH
  adminMatch = password === adminPassword;
}
// Replace with:
if (!adminPassword.startsWith("$2")) {
  console.error("[auth] ADMIN_PASSWORD must be a bcrypt hash. Rejecting login.");
  return null;
}
adminMatch = await bcrypt.compare(password, adminPassword);
```

### 2.2 High Severity

#### VULN-004: Password Hash Leaked in API Response

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **File** | `api/user/index.ts:22`, `lib/server/storage/postgresStore.ts:82` |
| **CVSS** | 7.5 |
| **Priority** | Fix within 7 days |

**Description:** The `GET /api/user` endpoint returns the full `UserProfile` object including the `passwordHash` field. While bcrypt hashes are designed to be computationally expensive, exposing them provides attackers with offline cracking material.

**Proof of concept:**
```bash
curl -H "Cookie: __Secure-authjs.session-token=VALID_TOKEN" \
  https://adl.vercel.app/api/user
# Response includes: { "passwordHash": "$2a$10$...", ... }
```

**Remediation:**
```typescript
// api/user/index.ts -- Strip passwordHash before response:
const { passwordHash, ...safeProfile } = profile;
return jsonResponse(safeProfile, { status: 200 });
```

#### VULN-005: No Server-Side Idempotency Check

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **File** | `api/submissions/index.ts:453-689` (entire POST handler) |
| **CVSS** | 7.1 |
| **Priority** | Fix within 7 days |

**Description:** The client generates an `idempotencyKey` in the offline queue (`lib/client/offlineQueue.ts:110`), but the server POST handler never reads or validates it. The `insertPointEvent` function uses `ON CONFLICT (id) DO UPDATE` on the event `id`, but the `id` is generated server-side via `crypto.randomUUID()` (`api/submissions/index.ts:576`), making the upsert effectively a no-op for deduplication.

This means:
- Offline queue retries create duplicate submissions
- Network retries (e.g., browser retry on timeout) create duplicates
- An attacker can replay the same submission thousands of times

**Remediation:**
```typescript
// api/submissions/index.ts -- Accept and validate idempotency key:
const idempotencyKey = typeof body?.idempotencyKey === "string"
  ? body.idempotencyKey.trim()
  : null;

if (idempotencyKey) {
  // Check if this idempotency key was already processed
  const existing = await query(
    "SELECT id FROM point_events WHERE details->>'idempotencyKey' = $1 AND user_id = $2",
    [idempotencyKey, auth.id]
  );
  if (existing.rows.length > 0) {
    // Return the existing event instead of creating a duplicate
    return jsonResponse({ id: existing.rows[0].id, deduplicated: true }, { status: 200 });
  }
}
// Store idempotencyKey in details
details.idempotencyKey = idempotencyKey;
```

#### VULN-006: PUT Endpoint Accepts Arbitrary Photo URLs

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **File** | `api/submissions/[id].ts:100` |
| **CVSS** | 6.8 |
| **Priority** | Fix within 14 days |

**Description:** The PUT endpoint accepts any string as `photoUrl` without validation. This bypasses the photo requirement enforced in the POST handler.

**Proof of concept:**
```bash
curl -X PUT https://adl.vercel.app/api/submissions/SOME_POINT_ID \
  -H "Cookie: ..." \
  -H "Content-Type: application/json" \
  -d '{"details":{"siteName":"Fake"},"photoUrl":"https://attacker.com/tracking-pixel.jpg"}'
```

**Remediation:**
- Remove `photoUrl` acceptance from PUT endpoint, or
- Validate that the URL points to the `*.public.blob.vercel-storage.com` domain
- Require photo upload through the same flow as POST

#### VULN-007: No Rate Limiting on Authentication Endpoints

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **File** | `api/auth/auth.ts`, `api/auth/register.ts` |
| **CVSS** | 7.3 |
| **Priority** | Fix within 14 days |

**Description:** Neither the login nor registration endpoints implement rate limiting, account lockout, or CAPTCHA. This enables brute-force attacks against user accounts and mass account creation.

**Remediation (immediate -- Vercel WAF):**
```json
// vercel.json -- Add Vercel Firewall rules:
{
  "headers": [
    {
      "source": "/api/auth/(.*)",
      "headers": [
        { "key": "X-RateLimit-Policy", "value": "auth" }
      ]
    }
  ]
}
```

**Remediation (application-level):**
```typescript
// lib/server/rateLimit.ts
import { query } from "./db.js";

export async function checkRateLimit(
  key: string,
  windowMs: number,
  maxAttempts: number
): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - windowMs).toISOString();
  const result = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM rate_limit_events WHERE key = $1 AND created_at > $2",
    [key, windowStart]
  );
  const count = parseInt(result.rows[0]?.count ?? "0", 10);
  if (count >= maxAttempts) return { allowed: false, remaining: 0 };

  await query(
    "INSERT INTO rate_limit_events (key, created_at) VALUES ($1, NOW())",
    [key]
  );
  return { allowed: true, remaining: maxAttempts - count - 1 };
}
```

Apply limits:
- Login: 5 attempts per email per 15 minutes
- Registration: 3 accounts per IP per hour
- Submissions: 10 per user per hour

### 2.3 Medium Severity

#### VULN-008: User Enumeration via Registration Endpoint

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | `api/auth/register.ts:38-39` |
| **CVSS** | 5.3 |
| **Priority** | Fix within 30 days |

**Description:** The registration endpoint returns a distinct 409 status code when a user already exists, allowing attackers to enumerate valid accounts.

**Remediation:** Return the same response for both "user exists" and "user created" scenarios, then send a confirmation email to the address. Only the legitimate email owner would know whether the account was newly created.

```typescript
// For MVP, at minimum normalize the response:
if (existing) {
  // Return 201 anyway to prevent enumeration
  return jsonResponse({ ok: true }, { status: 201 });
}
```

#### VULN-009: Missing CORS Configuration

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | `vercel.json`, all API handlers |
| **CVSS** | 5.8 |
| **Priority** | Fix within 30 days |

**Description:** No CORS headers are configured anywhere in the application. Vercel's default behavior allows same-origin requests, but there is no explicit `Access-Control-Allow-Origin` policy. This means:
- No protection against CORS misconfiguration if headers are added incorrectly later
- No preflight handling for complex requests
- Cross-origin API consumption is undefined

**Remediation:**
```json
// vercel.json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "https://africandatalayer.vercel.app" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, PUT, DELETE, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization" },
        { "key": "Access-Control-Allow-Credentials", "value": "true" }
      ]
    }
  ]
}
```

#### VULN-010: Missing Security Headers

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | `vercel.json` |
| **CVSS** | 5.0 |
| **Priority** | Fix within 30 days |

**Description:** No security headers are configured. Missing headers include:
- `Content-Security-Policy` -- No CSP to prevent XSS
- `X-Content-Type-Options` -- No MIME sniffing prevention
- `X-Frame-Options` -- No clickjacking protection
- `Strict-Transport-Security` -- No HSTS
- `Referrer-Policy` -- No referrer leakage control
- `Permissions-Policy` -- No feature policy

**Remediation:**
```json
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(self), geolocation=(self), microphone=(self)" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: *.public.blob.vercel-storage.com; connect-src 'self' https://ipapi.co https://generativelanguage.googleapis.com; frame-ancestors 'none';" }
      ]
    }
  ]
}
```

#### VULN-011: Leaderboard Exposes User Email Addresses

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | `api/leaderboard/index.ts:88-98` |
| **CVSS** | 5.3 |
| **Priority** | Fix within 30 days |

**Description:** The leaderboard endpoint returns `userId` (typically the user's email) for every leaderboard entry. This is on a public, unauthenticated, cached endpoint.

**Remediation:**
```typescript
// api/leaderboard/index.ts -- Redact userId:
const leaderboard = topRows.map((row, index) => {
  const profile = profileMap.get(row.userId);
  return {
    rank: index + 1,
    // userId: row.userId,  // REMOVE THIS
    name: getDisplayName(row.userId, profile?.name, profile?.email, profile?.phone),
    xp: row.xp,
    contributions: row.contributions,
    lastContributionAt: row.lastContributionAt,
    lastLocation: row.lastLocation,
  };
});
```

#### VULN-012: Synchronous bcrypt in Login Path

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | `api/auth/auth.ts:53` |
| **CVSS** | 4.3 |
| **Priority** | Fix within 30 days |

**Description:** The credential login path uses `bcrypt.compareSync` (synchronous) for non-admin users:

```typescript
const valid = bcrypt.compareSync(password, profile.passwordHash);
```

Meanwhile, the admin path correctly uses `await bcrypt.compare` (asynchronous). The synchronous call blocks the Node.js event loop for 50-200ms per comparison, making the serverless function unresponsive during password verification and amplifying DoS impact.

**Remediation:**
```typescript
// api/auth/auth.ts:53 -- Change to async:
const valid = await bcrypt.compare(password, profile.passwordHash);
```

#### VULN-013: Database SSL Verification Bypass

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | `lib/server/db.ts:50-51` |
| **CVSS** | 5.9 |
| **Priority** | Fix within 30 days |

**Description:** The database connection supports `POSTGRES_SSL_NO_VERIFY=true` which sets `rejectUnauthorized: false`, disabling TLS certificate validation. This opens the connection to man-in-the-middle attacks. The `.env.example` explicitly documents this option.

**Remediation:** Remove the `POSTGRES_SSL_NO_VERIFY` option entirely. If Supabase's certificate chain causes issues, pin the specific CA certificate rather than disabling verification.

### 2.4 Low Severity

#### VULN-014: No Password Complexity Requirements

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **File** | `api/auth/register.ts:31-33` |
| **CVSS** | 3.7 |
| **Priority** | Fix within 90 days |

**Description:** The only password requirement is a minimum length of 8 characters. No uppercase, lowercase, digit, or special character requirements. Passwords like `aaaaaaaa` or `12345678` are accepted.

**Remediation:**
```typescript
function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain a digit";
  return null;
}
```

#### VULN-015: Blob Storage Photos Publicly Accessible

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **File** | `api/submissions/index.ts:186-187` |
| **CVSS** | 3.1 |
| **Priority** | Fix within 90 days |

**Description:** All uploaded photos use `access: "public"` on Vercel Blob. Anyone who obtains or guesses a photo URL can access the image without authentication. Photo URLs follow a predictable pattern: `submissions/{eventId}-{timestamp}.{ext}`.

**Remediation:** For Phase 2, implement signed URLs with time-limited access. For now, the UUIDs in the path provide some obscurity.

#### VULN-016: `trustHost: true` in Auth.js Configuration

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **File** | `api/auth/auth.ts:104` |
| **CVSS** | 3.7 |
| **Priority** | Fix within 90 days |

**Description:** `trustHost: true` tells Auth.js to trust the `Host` header from the request. In a Vercel deployment this is safe because Vercel controls the reverse proxy, but if the application is ever deployed behind a different reverse proxy or directly, this could allow host header injection attacks (password reset link poisoning, cache poisoning).

**Remediation:** Set `AUTH_URL` explicitly in Vercel environment variables rather than relying on `trustHost`.

---

## 3. Security Controls Matrix

### 3.1 Authentication Controls

| Control | Current State | Gap | Target | Priority |
|---------|--------------|-----|--------|----------|
| Password hashing | bcrypt with cost factor 10 (`register.ts:50`) | Cost factor should be 12+ for modern hardware | bcrypt cost 12 | Medium |
| Password complexity | Min 8 chars only | No complexity rules | Min 10 chars + uppercase + lowercase + digit | Low |
| Account lockout | None | Unlimited login attempts | Lock after 5 failures for 15 min | High |
| MFA | Not implemented | No second factor available | TOTP or SMS OTP for admin accounts | Phase 2 |
| Session duration | Auth.js default (30 days) | Too long for sensitive app | 7 days with sliding window; 24h for admin | High |
| Session revocation | Not possible (stateless JWT) | Cannot invalidate compromised sessions | Server-side session store or token blocklist | Phase 2 |
| Token rotation | None | Same JWT for entire session lifetime | Rotate JWT on each request or every 15 min | Medium |
| Admin authentication | Single env var email match | No MFA, shared credential, no audit | Per-user admin roles in database + MFA | High |
| OAuth security | Standard Google OAuth via Auth.js | No PKCE enforcement visible | Verify PKCE in Auth.js config | Low |
| CSRF protection | Auth.js built-in CSRF token | Adequate for auth flows | Extend to all state-changing API endpoints | Medium |

### 3.2 Authorization Controls

| Control | Current State | Gap | Target | Priority |
|---------|--------------|-----|--------|----------|
| RBAC | Binary admin/non-admin via JWT claim | No roles, no groups, single admin | Database-backed role table with reviewer/admin/superadmin | Phase 2 |
| API authorization | `requireUser` checks JWT presence | No per-endpoint role checks beyond admin | Middleware-based RBAC on every endpoint | High |
| Resource ownership | Partial -- event detail view checks ownership | PUT endpoint has no owner check | Enforce ownership on all mutations | High |
| Map scope enforcement | Server-side geofence check (`isWithinBonamoussadi`) | Admin bypass is all-or-nothing | Granular scope-based access per region | Phase 2 |
| API key scoping | Gemini key has full access | Client-side key, no usage limits | Server-side proxy with per-user quotas | Critical |

### 3.3 Input Validation Controls

| Control | Current State | Gap | Target | Priority |
|---------|--------------|-----|--------|----------|
| SQL injection | Parameterized queries throughout (`$1`, `$2`, etc.) | None -- well implemented | Maintain current approach | Adequate |
| XSS | No `dangerouslySetInnerHTML` usage found in React components | No CSP header, user data rendered via React's auto-escaping | Add CSP header | Medium |
| JSON schema validation | Manual field-by-field validation | No schema library, easy to miss edge cases | Add `zod` or `ajv` for request body validation | Medium |
| File upload validation | MIME type whitelist, size limit, EXIF parsing | No magic byte validation (only checks data URI prefix) | Validate file magic bytes, not just MIME string | Medium |
| GPS coordinate validation | `Number.isFinite()` checks | No bounding box validation on raw coordinates | Reject coordinates outside Africa (-40 to 40 lat, -20 to 55 lng) | Low |
| String sanitization | `trimString` with max length | No HTML entity encoding on storage | Encode on output if ever rendered in non-React context | Low |

### 3.4 Encryption Controls

| Control | Current State | Gap | Target | Priority |
|---------|--------------|-----|--------|----------|
| Transport encryption | HTTPS enforced by Vercel | No HSTS header | Add HSTS with preload | Medium |
| Database connection | TLS with optional verification bypass | `POSTGRES_SSL_NO_VERIFY` option exists | Remove bypass option, pin CA cert | Medium |
| Data at rest | Supabase manages disk encryption | No application-level encryption | Encrypt PII fields (email, phone) at application level | Phase 2 |
| Password storage | bcrypt (cost 10) | Cost factor slightly low | Increase to cost 12 | Medium |
| JWT signing | HMAC-SHA256 via AUTH_SECRET | Secret currently compromised (in .env) | Rotate secret, consider RSA key pair | Critical |
| Photo storage | Public URLs on Vercel Blob | No encryption, no access control | Signed URLs with time-limited access | Phase 2 |
| Secrets management | `.env` file in git | All secrets compromised | Vercel Environment Variables only, no local .env in git | Critical |

### 3.5 Monitoring Controls

| Control | Current State | Gap | Target | Priority |
|---------|--------------|-----|--------|----------|
| Security event logging | None | No audit trail for any security event | Log auth events, admin actions, permission denials | High |
| Failed login monitoring | None | Cannot detect brute force attempts | Alert on >10 failures per email per hour | High |
| Anomaly detection | None | Cannot detect unusual submission patterns | Flag users with >20 submissions/day or unusual GPS patterns | Medium |
| Data exfiltration monitoring | None | Cannot detect bulk data access | Monitor large GET responses and unusual access patterns | Phase 2 |
| Dependency vulnerability scanning | None visible in CI/CD | No automated CVE detection | Add `npm audit` to CI pipeline, Dependabot/Snyk | Medium |
| Uptime monitoring | Health endpoint exists | No alerting configured | Integrate with Vercel monitoring or external uptime service | Medium |

---

## 4. Incident Response Plan

### 4.1 IR Team Roles and Responsibilities

| Role | Responsibility | Current Assignment |
|------|---------------|-------------------|
| **Incident Commander (IC)** | Owns the incident lifecycle, makes escalation decisions, coordinates response | Project Lead |
| **Security Lead** | Performs technical investigation, containment, and forensics | Teammate 4 (Cybersecurity Expert) |
| **Engineering Lead** | Implements fixes, deploys patches, manages rollbacks | Teammate 3 (Cloud Engineer) |
| **Communications Lead** | Drafts internal/external communications, manages stakeholder updates | Teammate 8 (Service Delivery Manager) |
| **Data Protection Officer** | Assesses PII impact, manages regulatory notifications (GDPR, local data protection laws) | To be assigned |

### 4.2 Incident Classification

| Priority | Definition | Response Time | Resolution Target | Example |
|----------|-----------|---------------|-------------------|---------|
| **P1 -- Critical** | Active exploitation, data breach, complete service outage, admin account compromise | 15 minutes to acknowledge | 4 hours to contain, 24 hours to resolve | Database credentials leaked and accessed; admin session hijacked |
| **P2 -- High** | Vulnerability actively being exploited but contained, partial service degradation, PII exposure risk | 1 hour to acknowledge | 8 hours to contain, 72 hours to resolve | Brute force attack on login endpoint; API key abuse detected |
| **P3 -- Medium** | Vulnerability discovered but not yet exploited, minor data exposure, degraded security posture | 4 hours to acknowledge | 5 business days to resolve | Missing rate limiting identified; password hash in API response |
| **P4 -- Low** | Hardening opportunity, best practice gap, informational finding | 24 hours to acknowledge | 30 business days to resolve | Missing security headers; bcrypt cost factor upgrade |

### 4.3 Response Procedures

#### Phase 1: Detection and Triage (0-15 minutes for P1)

1. **Identify** the incident source (monitoring alert, user report, security scan, external notification)
2. **Classify** the priority using the matrix above
3. **Assign** an Incident Commander
4. **Create** an incident channel (Slack/Discord/WhatsApp group)
5. **Notify** the IR team per the priority response time

#### Phase 2: Containment (15 min - 4 hours for P1)

1. **Isolate** affected components:
   - Rotate compromised credentials immediately
   - If database is compromised: change Supabase password, update `POSTGRES_URL` in Vercel
   - If admin account is compromised: change `ADMIN_EMAIL` and `AUTH_SECRET` to invalidate all JWTs
   - If API key is abused: revoke key in Google Cloud console
2. **Preserve evidence** before making changes:
   - Export Vercel function logs
   - Export database audit logs from Supabase
   - Screenshot relevant dashboard states
   - Save HTTP access logs
3. **Block** the attack vector:
   - Add IP to Vercel Firewall blocklist if applicable
   - Disable affected endpoint if necessary (via Vercel redirect rule)

#### Phase 3: Eradication (4-24 hours for P1)

1. **Root cause analysis**: Identify how the attacker gained access
2. **Patch** the vulnerability (code fix, config change, or dependency update)
3. **Deploy** the fix via standard CI/CD pipeline (do not skip tests)
4. **Verify** the fix in staging/preview before production

#### Phase 4: Recovery (24-72 hours for P1)

1. **Restore** service to full operation
2. **Monitor** closely for recurrence (increased logging, manual checks)
3. **Communicate** resolution to affected users if applicable
4. **Update** credentials rotation schedule

#### Phase 5: Post-Incident Review (within 5 business days)

1. **Timeline**: Minute-by-minute reconstruction of the incident
2. **Impact assessment**: Data affected, users affected, financial impact
3. **Root cause**: Technical and process failures that allowed the incident
4. **Action items**: Specific, assignable, time-bound improvements
5. **Lessons learned**: What worked well, what did not

### 4.4 Communication Plan

**Internal communications:**
- P1/P2: Immediate notification to all team members via primary communication channel
- P3: Notification to engineering team within 4 hours
- P4: Include in weekly security review

**External communications (if user data is affected):**
- Within 72 hours: Notify affected users via email
- Include: What happened, what data was affected, what we are doing, what users should do
- Regulatory: Assess GDPR notification requirements (72-hour deadline to supervisory authority)

**Status page updates:**
- P1: Update status page within 30 minutes of detection
- P2: Update within 2 hours
- Use neutral language: "investigating an issue" rather than "security breach"

### 4.5 Evidence Preservation Procedures

1. **Do not modify** logs or database records before capturing them
2. **Export** Vercel function logs for the affected time window
3. **Capture** database state with `pg_dump` if data integrity is in question
4. **Archive** HTTP request/response pairs from CDN logs
5. **Store** all evidence in a time-stamped, access-controlled archive
6. **Document** the chain of custody for any evidence that may be needed for legal proceedings

### 4.6 Specific Playbooks

#### Playbook A: Credential Compromise

**Trigger:** Suspected or confirmed compromise of any credential (database password, API key, OAuth secret, admin password, AUTH_SECRET).

**Steps:**
1. Identify which credentials are compromised
2. Rotate the compromised credentials immediately:
   - `AUTH_SECRET`: Generate new value, update in Vercel env vars. This invalidates ALL user sessions.
   - `POSTGRES_URL`: Change password in Supabase dashboard, update connection string in Vercel env vars
   - `GOOGLE_CLIENT_SECRET`: Regenerate in Google Cloud Console, update in Vercel env vars
   - `VERCEL_API_TOKEN`: Regenerate in Vercel dashboard
   - `ADMIN_PASSWORD`: Generate new bcrypt hash, update in Vercel env vars
   - `BLOB_READ_WRITE_TOKEN`: Regenerate in Vercel Blob settings
3. Audit database for unauthorized changes:
   ```sql
   -- Check for recent suspicious user profile changes
   SELECT * FROM user_profiles WHERE updated_at > NOW() - INTERVAL '24 hours' ORDER BY updated_at DESC;
   -- Check for suspicious point events
   SELECT * FROM point_events WHERE created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC;
   ```
4. Check Vercel deployment history for unauthorized deployments
5. Review git history for unauthorized commits
6. If `AUTH_SECRET` was compromised, all users must re-authenticate (sessions are invalidated)

#### Playbook B: Data Breach

**Trigger:** Confirmed unauthorized access to user PII (emails, phone numbers, passwords) or submission data.

**Steps:**
1. Determine scope: Which tables were accessed? Which records? Which time period?
2. Contain: Revoke the access vector (rotate credentials, block IP, disable endpoint)
3. Assess PII impact:
   - User emails and phone numbers: Notify affected users
   - Password hashes: If bcrypt cost 10, assess cracking feasibility (generally low risk but notify users to change passwords)
   - Submission data: Assess if location data constitutes PII under applicable law
4. Legal assessment:
   - GDPR applicability (EU users)
   - Cameroon Data Protection Act (Law No. 2010/012)
   - Nigeria Data Protection Regulation (NDPR)
5. Notify supervisory authority within 72 hours if required
6. Notify affected users with specific remediation steps
7. Offer password reset for all affected accounts

#### Playbook C: DDoS Attack

**Trigger:** Sustained high traffic causing service degradation or outage.

**Steps:**
1. Verify it is a DDoS and not a legitimate traffic spike
2. Enable Vercel's built-in DDoS protection (contact Vercel support if on Hobby plan)
3. If attack targets specific endpoint:
   - Add Vercel Firewall rules to block attacking IPs/ranges
   - Temporarily add rate limiting via Edge Middleware
   - If targeting `/api/submissions`, temporarily increase function timeout and memory
4. If attack is volumetric:
   - Enable Vercel's attack challenge mode if available
   - Contact Vercel support for CDN-level mitigation
5. Monitor database connection pool usage (`SELECT count(*) FROM pg_stat_activity`)
6. Post-attack: Implement rate limiting (VULN-007) to prevent recurrence

#### Playbook D: Fraudulent Data Injection at Scale

**Trigger:** Discovery of large-scale fake submissions (bot-generated points, fabricated locations, stock photos).

**Steps:**
1. Identify the fraudulent submissions:
   ```sql
   -- Find users with abnormally high submission rates
   SELECT user_id, COUNT(*) as count, MIN(created_at) as first, MAX(created_at) as last
   FROM point_events
   GROUP BY user_id
   HAVING COUNT(*) > 50
   ORDER BY count DESC;

   -- Find submissions from the same device ID
   SELECT details->>'clientDevice'->>'deviceId' as device_id, COUNT(*) as count
   FROM point_events
   WHERE details->'clientDevice'->>'deviceId' IS NOT NULL
   GROUP BY details->'clientDevice'->>'deviceId'
   HAVING COUNT(*) > 20;
   ```
2. Quarantine suspicious submissions (add a `status: "quarantined"` field via ENRICH_EVENT)
3. Block the offending user accounts
4. Assess data quality impact on projected points
5. If photos were uploaded, check for duplicate image hashes across submissions
6. Remove fraudulent data after confirmation
7. Recalculate XP and leaderboard rankings
8. Implement rate limiting and enhanced fraud detection to prevent recurrence

#### Playbook E: Admin Account Compromise

**Trigger:** Suspected unauthorized admin access.

**Steps:**
1. IMMEDIATELY:
   - Change `ADMIN_EMAIL` to a new address in Vercel env vars
   - Rotate `AUTH_SECRET` to invalidate all sessions
   - Change `ADMIN_PASSWORD` to a new bcrypt hash
2. Audit admin actions:
   - Review all `DELETE` operations on point_events
   - Check for unauthorized user profile modifications
   - Review admin_events access logs (if logging is implemented)
3. Check for data exfiltration:
   - Admin can view all events including user identifiers
   - Admin can view fraud check metadata including IP locations
4. Restore any deleted events from database backups
5. Post-incident: Implement admin audit logging, MFA for admin accounts

---

## 5. Security Hardening Checklist

### 5.1 Must Fix Before Launch (Critical)

| # | Item | Vulnerability | File(s) | Status |
|---|------|--------------|---------|--------|
| C-1 | Rotate ALL secrets exposed in `.env` | VULN-001 | `.env` | NOT DONE |
| C-2 | Add `.env` to `.gitignore` and purge from git history | VULN-001 | `.gitignore` | NOT DONE |
| C-3 | Move Gemini API calls to server-side proxy | VULN-002 | `vite.config.ts`, `lib/gemini.ts` | NOT DONE |
| C-4 | Remove plaintext admin password fallback | VULN-003 | `api/auth/auth.ts:42-46` | NOT DONE |
| C-5 | Set `ADMIN_PASSWORD` to bcrypt hash in Vercel env vars | VULN-003 | Vercel dashboard | NOT DONE |
| C-6 | Strip `passwordHash` from user profile API response | VULN-004 | `api/user/index.ts:22` | NOT DONE |
| C-7 | Verify all Vercel env vars are set correctly after secret rotation | VULN-001 | Vercel dashboard | NOT DONE |

### 5.2 Fix Within 30 Days (High)

| # | Item | Vulnerability | File(s) | Status |
|---|------|--------------|---------|--------|
| H-1 | Implement rate limiting on auth endpoints | VULN-007 | `api/auth/auth.ts`, `api/auth/register.ts` | NOT DONE |
| H-2 | Implement server-side idempotency check for submissions | VULN-005 | `api/submissions/index.ts` | NOT DONE |
| H-3 | Remove or validate `photoUrl` in PUT endpoint | VULN-006 | `api/submissions/[id].ts:100` | NOT DONE |
| H-4 | Add security headers (HSTS, CSP, X-Frame-Options, etc.) | VULN-010 | `vercel.json` | NOT DONE |
| H-5 | Add admin action audit logging | R-1 | `api/submissions/[id].ts`, `api/user/index.ts` | NOT DONE |
| H-6 | Implement rate limiting on submission endpoint | D-1 | `api/submissions/index.ts` | NOT DONE |
| H-7 | Change `bcrypt.compareSync` to `await bcrypt.compare` | VULN-012 | `api/auth/auth.ts:53` | NOT DONE |
| H-8 | Reduce JWT session duration to 7 days | S-3 | `api/auth/auth.ts:103` | NOT DONE |
| H-9 | Add ownership/admin check to PUT endpoint | E-4 | `api/submissions/[id].ts:68` | NOT DONE |
| H-10 | Redact `userId` from public leaderboard response | VULN-011 | `api/leaderboard/index.ts:92` | NOT DONE |

### 5.3 Fix Within 90 Days (Medium)

| # | Item | Vulnerability | File(s) | Status |
|---|------|--------------|---------|--------|
| M-1 | Add CORS configuration | VULN-009 | `vercel.json` | NOT DONE |
| M-2 | Prevent user enumeration on registration | VULN-008 | `api/auth/register.ts:38-39` | NOT DONE |
| M-3 | Remove `POSTGRES_SSL_NO_VERIFY` option | VULN-013 | `lib/server/db.ts:50-51` | NOT DONE |
| M-4 | Add request body validation with `zod` | 3.3 input validation | All API handlers | NOT DONE |
| M-5 | Implement pagination for `getPointEvents` | D-2 | `lib/server/storage/postgresStore.ts:289-298` | NOT DONE |
| M-6 | Add `npm audit` to CI pipeline | 3.5 monitoring | CI/CD configuration | NOT DONE |
| M-7 | Implement failed login monitoring and alerting | 3.5 monitoring | New: `lib/server/securityEvents.ts` | NOT DONE |
| M-8 | Add magic byte validation for uploaded images | 3.3 input validation | `api/submissions/index.ts:164-176` | NOT DONE |
| M-9 | Increase bcrypt cost factor to 12 | 3.1 authentication | `api/auth/register.ts:50` | NOT DONE |
| M-10 | Configure explicit JWT expiration (7 days standard, 24h admin) | S-3 | `api/auth/auth.ts:103` | NOT DONE |
| M-11 | Set `AUTH_URL` explicitly, remove `trustHost: true` | VULN-016 | `api/auth/auth.ts:104` | NOT DONE |

### 5.4 Nice to Have (Low / Phase 2)

| # | Item | Vulnerability | Notes |
|---|------|--------------|-------|
| L-1 | Implement password complexity requirements | VULN-014 | Min 10 chars + uppercase + lowercase + digit |
| L-2 | Add MFA for admin accounts (TOTP) | S-2 | Requires UI work + authenticator app integration |
| L-3 | Implement server-side session store for revocation | S-3 | Redis or database-backed sessions |
| L-4 | Switch to signed URLs for Vercel Blob photos | VULN-015 | Prevents direct photo access without auth |
| L-5 | Implement per-user API rate limiting | D-1 | Token bucket algorithm with Redis |
| L-6 | Add application-level PII encryption for email/phone fields | 3.4 encryption | AES-256-GCM with key management |
| L-7 | Implement database-backed RBAC with roles table | E-1 | Roles: contributor, reviewer, admin, superadmin |
| L-8 | Add device attestation for mobile contributors | R-2 | Android SafetyNet / iOS App Attest |
| L-9 | Implement geographic anomaly detection | T-2 | Flag impossible travel patterns |
| L-10 | Add Dependabot or Snyk for automated dependency updates | 3.5 monitoring | GitHub Dependabot is free |
| L-11 | Implement WAF rules for common attack patterns | D-1 | Vercel Firewall or Cloudflare |
| L-12 | Add CSP reporting endpoint to detect XSS attempts | VULN-010 | `report-uri` or `report-to` directive |

---

## Appendix A: Vulnerability Summary by Priority

| Priority | Count | IDs |
|----------|-------|-----|
| Critical (fix now) | 3 | VULN-001, VULN-002, VULN-003 |
| High (within 30 days) | 4 | VULN-004, VULN-005, VULN-006, VULN-007 |
| Medium (within 90 days) | 6 | VULN-008, VULN-009, VULN-010, VULN-011, VULN-012, VULN-013 |
| Low (Phase 2) | 3 | VULN-014, VULN-015, VULN-016 |
| **Total** | **16** | |

## Appendix B: Compliance Considerations

ADL operates across multiple African jurisdictions. Key data protection regulations to monitor:

| Jurisdiction | Regulation | Key Requirements |
|-------------|-----------|-----------------|
| Cameroon | Law No. 2010/012 on Cybersecurity and Cybercrime | Registration with ANTIC, consent for data collection, breach notification |
| Nigeria | Nigeria Data Protection Regulation (NDPR) 2019 | Consent, data audit, breach notification within 72 hours |
| Kenya | Data Protection Act 2019 | Registration with ODPC, data protection impact assessment |
| Pan-African | African Union Convention on Cyber Security (Malabo Convention) | Framework for member states, cross-border data transfer provisions |
| EU (if EU users) | GDPR | 72-hour breach notification, DPO appointment, privacy by design |

**Recommendation:** Before launching in each new country, conduct a data protection impact assessment (DPIA) specific to that jurisdiction's requirements.

## Appendix C: Security Testing Recommendations

| Test Type | Frequency | Scope | Tool Recommendations |
|-----------|-----------|-------|---------------------|
| Dependency scanning | Every CI build | `package.json` dependencies | `npm audit`, Snyk, Dependabot |
| SAST (Static Analysis) | Every PR | All TypeScript source | ESLint security plugins, Semgrep |
| DAST (Dynamic Analysis) | Weekly in staging | All API endpoints | OWASP ZAP, Burp Suite Community |
| Penetration testing | Quarterly | Full application | External security firm |
| Secret scanning | Every commit | Entire repository | GitHub secret scanning, gitleaks |
| Container/runtime scanning | Monthly | Vercel function runtime | Vercel security dashboard |

---

*This document represents the security posture as of 2026-02-28. All findings are based on actual code review of the ADL repository. The critical vulnerabilities (VULN-001 through VULN-003) require immediate remediation before any production deployment or external access is granted.*
