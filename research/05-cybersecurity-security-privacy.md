# ADL Cybersecurity: Security Controls, Privacy Framework, and Incident Response
## Bonamoussadi, Douala, Cameroon

**Teammate 5 -- Cybersecurity Expert Deliverable**
**Date:** March 2026

---

## Table of Contents

1. [Threat Model](#1-threat-model)
2. [Security Controls](#2-security-controls)
3. [Privacy and Consent Framework](#3-privacy-and-consent-framework)
4. [Incident Response Plan](#4-incident-response-plan)
5. [Field Agent Security Training](#5-field-agent-security-training)
6. [Compliance Checklist](#6-compliance-checklist)

---

## Existing Security Baseline

Before prescribing controls, here is what ADL already has in place and where the gaps are:

| Layer | Current State | Gap |
|---|---|---|
| **Authentication** | `@auth/core` with Google OAuth + email/password credentials; session-based JWTs; CSRF protection via `csrfToken` | No MFA; no role-based access beyond `isAdmin` boolean; no session timeout enforcement; no account lockout after failed attempts |
| **Authorization** | Single `isAdmin` flag on user session; API routes check `requireUser()` | No granular RBAC (field agent vs. team lead vs. admin vs. data consumer); no per-vertical access control |
| **Data Encryption** | HTTPS in transit (Vercel enforces TLS); Neon PostgreSQL encrypts at rest | No field-level encryption for PII; no client-side encryption before sync; photos stored in Vercel Blob without additional encryption layer |
| **Fraud Detection** | EXIF GPS extraction, haversine distance checks, IP geolocation cross-referencing (`submissionFraud.ts`) | GPS spoofing detection is limited to EXIF/haversine; no device fingerprinting; no behavioral anomaly detection |
| **API Security** | Vercel serverless functions with JWT validation | No explicit rate limiting beyond Vercel defaults; no input validation library; CORS not explicitly configured (relies on Vercel defaults) |
| **Photo Integrity** | Photos uploaded to Vercel Blob with URLs stored in `point_events` | No hash-on-capture; no tamper detection; no chain-of-custody for evidence photos |
| **Offline Security** | IndexedDB queue (`adl_offline_queue`) stores submissions locally | IndexedDB is not encrypted; device theft exposes queued data; no remote wipe capability |
| **Audit Trail** | Event-sourced `point_events` table is append-only | No dedicated security audit log; no login/logout tracking; no admin action logging |
| **Data Protection Compliance** | None formalized | No privacy policy; no consent workflow; no DPO appointed; no data subject rights mechanism; June 2026 deadline approaching |

---

## 1. Threat Model

### 1.1 Methodology

This threat model uses a risk-based approach adapted for ADL's operational context: field agents collecting ground-truth data with consumer Android phones in Bonamoussadi, Douala. Threats are ranked by **Likelihood x Impact** on a 5-point scale each (1=Very Low, 5=Very High), producing a risk score of 1--25.

### 1.2 Threat Registry

#### T1: Device Theft or Loss

| Attribute | Detail |
|---|---|
| **Description** | Field agent's phone is stolen or lost during data collection in Bonamoussadi. Douala has significant petty crime, and agents visibly using phones in commercial areas are targets. |
| **Likelihood** | 4 (High) -- Phone theft is common in Douala's commercial areas; agents use phones openly for photo capture and GPS recording |
| **Impact** | 3 (Medium) -- Offline queue may contain unsynced submissions with GPS coordinates, business names, and photos; session tokens stored on device; but no highly sensitive PII in typical submissions |
| **Risk Score** | **12 / 25** |
| **Assets at Risk** | Unsynced IndexedDB queue, cached session tokens, photos in device gallery, agent's personal data on same device |
| **Existing Mitigations** | None specific to ADL; depends entirely on agent's personal device security |

#### T2: Agent Impersonation

| Attribute | Detail |
|---|---|
| **Description** | Unauthorized person gains access to an agent's credentials and submits fabricated data, or a terminated agent continues submitting. |
| **Likelihood** | 3 (Medium) -- Credential sharing is common in Cameroon's informal work culture; no MFA means stolen password = full access |
| **Impact** | 4 (High) -- Polluted dataset with fraudulent submissions; damages data product credibility; may be undetected if submissions appear plausible |
| **Risk Score** | **12 / 25** |
| **Assets at Risk** | Data integrity, platform reputation, downstream customer trust |
| **Existing Mitigations** | Fraud detection (EXIF/haversine/IP) catches geographically implausible submissions; session-based auth with CSRF protection |

#### T3: Data Interception (Man-in-the-Middle)

| Attribute | Detail |
|---|---|
| **Description** | Submissions intercepted during sync over MTN/Orange mobile networks, particularly on compromised public Wi-Fi or through network-level surveillance. |
| **Likelihood** | 2 (Low) -- Vercel enforces HTTPS/TLS; MitM on mobile data requires sophisticated capability |
| **Impact** | 3 (Medium) -- Business location data, GPS coordinates, and photos could be intercepted; no financial or health PII in typical submissions |
| **Risk Score** | **6 / 25** |
| **Assets at Risk** | Submission payloads (GPS, photos, business details), authentication tokens |
| **Existing Mitigations** | HTTPS enforced by Vercel; `__Secure-` cookie prefix in production; TLS 1.2+ on Vercel edge |

#### T4: GPS Spoofing

| Attribute | Detail |
|---|---|
| **Description** | Agent uses GPS spoofing apps (e.g., Fake GPS Location) to submit data without physically visiting locations, fabricating or recycling previous captures. |
| **Likelihood** | 4 (High) -- GPS spoofing apps are freely available on Android; financial incentive exists if agents are paid per submission; Android does not block mock locations by default |
| **Impact** | 4 (High) -- Fundamentally undermines the ground-truth value proposition; geolocated data becomes unreliable; clients paying for verified field data receive fabricated data |
| **Risk Score** | **16 / 25** |
| **Assets at Risk** | Data product integrity, commercial reputation, client trust |
| **Existing Mitigations** | EXIF GPS extraction and haversine distance check between reported GPS and photo EXIF GPS; IP geolocation cross-reference; Bonamoussadi geofence bounding box |

#### T5: Insider Threats

| Attribute | Detail |
|---|---|
| **Description** | ADL team member (admin, developer) misuses privileged access: bulk data export for sale, unauthorized data modification, or sabotage. |
| **Likelihood** | 2 (Low) -- Small team reduces surface but increases individual impact; economic pressures in Cameroon create motivation |
| **Impact** | 5 (Very High) -- Admin access to Neon PostgreSQL means full database access; Vercel environment variables contain all secrets; no audit trail for admin actions |
| **Risk Score** | **10 / 25** |
| **Assets at Risk** | Entire database, API keys, customer data, business reputation |
| **Existing Mitigations** | Event-sourced model means data modifications create new events (append-only); Vercel dashboard has basic access logs |

#### T6: Physical Threats to Field Agents

| Attribute | Detail |
|---|---|
| **Description** | Agents face physical danger: robbery, harassment by business owners who object to being photographed, confrontation in areas with informal/illegal operations (unlicensed bars, informal drug sellers). |
| **Likelihood** | 3 (Medium) -- Bonamoussadi is middle-class and relatively safe compared to other Douala neighborhoods, but agents photographing businesses can provoke hostile reactions; informal operators are inherently suspicious of documentation |
| **Impact** | 5 (Very High) -- Agent physical safety is paramount; legal liability for ADL; reputational damage; operational disruption if agents refuse to work |
| **Risk Score** | **15 / 25** |
| **Assets at Risk** | Agent safety (non-negotiable), ADL operational continuity, legal exposure |
| **Existing Mitigations** | None formalized |

#### T7: Regulatory Non-Compliance

| Attribute | Detail |
|---|---|
| **Description** | Failure to comply with Cameroon Law No. 2024/017 (data protection) before the June 23, 2026 deadline. ADL collects GPS locations, photos of businesses, and potentially identifiable information without formalized consent or registration. |
| **Likelihood** | 5 (Very High) -- Currently no compliance program exists; deadline is less than 4 months away; cross-border data transfer (Vercel/Neon servers outside Cameroon) adds complexity |
| **Impact** | 4 (High) -- Fines, mandatory data deletion orders, operational shutdown, reputational damage; potential personal liability for data controller |
| **Risk Score** | **20 / 25** |
| **Assets at Risk** | Business continuity, all collected data, financial exposure, executive liability |
| **Existing Mitigations** | None |

#### T8: Third-Party/Supply Chain Risks

| Attribute | Detail |
|---|---|
| **Description** | Compromise or failure of Vercel, Neon PostgreSQL, Vercel Blob, Google OAuth, or Google Gemini AI. Also includes npm supply chain attacks on the 40+ dependencies. |
| **Likelihood** | 2 (Low) -- Vercel and Neon are established providers with strong security postures; but npm supply chain attacks are increasingly common |
| **Impact** | 4 (High) -- Total platform unavailability (Vercel outage); data exposure (Neon breach); authentication bypass (Google OAuth compromise); dependency injection (npm package compromise) |
| **Risk Score** | **8 / 25** |
| **Assets at Risk** | Platform availability, data confidentiality, authentication integrity |
| **Existing Mitigations** | Edge Config fallback for read-only when Postgres unavailable; `package-lock.json` pins dependency versions |

#### T9: Data Exfiltration via API

| Attribute | Detail |
|---|---|
| **Description** | Unauthorized bulk extraction of data through the API by an authenticated user (competitor intelligence gathering) or exploitation of API vulnerabilities. |
| **Likelihood** | 3 (Medium) -- `/api/submissions GET` returns data; no pagination limits documented; any authenticated user can query |
| **Impact** | 3 (Medium) -- Entire Bonamoussadi dataset extracted; competitor gains ADL's data product without paying; but data is observational (not trade secrets) |
| **Risk Score** | **9 / 25** |
| **Assets at Risk** | Commercial value of collected data, competitive advantage |
| **Existing Mitigations** | Authentication required for API access; Vercel's default rate limiting |

### 1.3 Threat Priority Matrix

| Rank | Threat | Risk Score | Priority |
|---|---|---|---|
| 1 | T7: Regulatory Non-Compliance | 20 | **CRITICAL** |
| 2 | T4: GPS Spoofing | 16 | **HIGH** |
| 3 | T6: Physical Threats to Agents | 15 | **HIGH** |
| 4 | T1: Device Theft/Loss | 12 | **HIGH** |
| 5 | T2: Agent Impersonation | 12 | **HIGH** |
| 6 | T5: Insider Threats | 10 | **MEDIUM** |
| 7 | T9: Data Exfiltration via API | 9 | **MEDIUM** |
| 8 | T8: Third-Party/Supply Chain | 8 | **MEDIUM** |
| 9 | T3: Data Interception | 6 | **LOW** |

---

## 2. Security Controls

### 2.1 Mobile Device Security

ADL uses a PWA on consumer Android phones (not company-issued devices), which limits MDM options. Controls must work within this constraint.

#### 2.1.1 Minimum Device Requirements (Enforced at Login)

```typescript
// lib/client/devicePolicy.ts
export interface DeviceComplianceResult {
  compliant: boolean;
  violations: string[];
}

export function checkDeviceCompliance(): DeviceComplianceResult {
  const violations: string[] = [];

  // Check HTTPS context (implies no MitM proxy downgrade)
  if (location.protocol !== 'https:') {
    violations.push('HTTPS required');
  }

  // Check for mock location capability (Android)
  // Note: PWAs cannot directly detect mock locations, but we can
  // check the Geolocation API permission state
  if (!navigator.geolocation) {
    violations.push('Geolocation not available');
  }

  // Check for minimum screen resolution (prevents headless automation)
  if (screen.width < 320 || screen.height < 480) {
    violations.push('Screen resolution too low');
  }

  // Check for IndexedDB availability (required for offline queue)
  if (!window.indexedDB) {
    violations.push('IndexedDB not available');
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}
```

#### 2.1.2 Session and Local Data Protection

| Control | Implementation | Mitigates |
|---|---|---|
| **Session timeout** | Set JWT `maxAge` to 8 hours (one field shift); force re-authentication after inactivity | T1, T2 |
| **Automatic queue flush** | On app foreground and every 5 minutes when online, flush IndexedDB queue to server | T1 (reduce exposure window) |
| **IndexedDB data minimization** | Store only submission payloads in queue; do not cache historical data locally | T1 |
| **Photo purge after sync** | Delete photos from Vercel Blob URL cache after confirmed server receipt | T1 |
| **Remote session revocation** | Admin endpoint to invalidate all sessions for a specific user ID by rotating the per-user `sub` claim | T1, T2 |

#### 2.1.3 Remote Wipe (Application-Level)

Since ADL cannot enforce MDM on personal devices, implement application-level wipe:

```typescript
// lib/client/remoteWipe.ts
export async function executeAppWipe(): Promise<void> {
  // 1. Clear IndexedDB offline queue
  const databases = await indexedDB.databases();
  for (const db of databases) {
    if (db.name) indexedDB.deleteDatabase(db.name);
  }

  // 2. Clear all localStorage and sessionStorage
  localStorage.clear();
  sessionStorage.clear();

  // 3. Unregister service worker
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const reg of registrations) {
    await reg.unregister();
  }

  // 4. Clear caches
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    await caches.delete(name);
  }

  // 5. Redirect to login
  window.location.href = '/login?wiped=true';
}
```

Trigger: The app checks a server-side `wipe_requested` flag on every sync attempt. If set, execute wipe before any other operation.

```typescript
// Added to sync engine check
const statusResponse = await fetch('/api/user/status');
const status = await statusResponse.json();
if (status.wipeRequested) {
  await executeAppWipe();
  return; // Stop sync
}
```

### 2.2 Authentication and Authorization

#### 2.2.1 Multi-Factor Authentication

Add OTP-based MFA for all agent accounts. SMS OTP is the most practical for Cameroon (agents have phone numbers; authenticator apps require explanation and training).

| Step | Implementation |
|---|---|
| **OTP generation** | Server generates 6-digit TOTP, stores hash in `user_profiles.mfa_secret` |
| **OTP delivery** | Send via SMS using a Cameroon-compatible provider (Africa's Talking, Twilio with Cameroon numbers, or MTN/Orange SMS API) |
| **OTP verification** | Verify within 5-minute window; max 3 attempts before lockout |
| **When required** | On every login (not every request -- JWT session handles ongoing auth) |
| **Fallback** | Admin can generate a bypass code for agents who lose phone access; bypass codes are single-use and logged |

**Important consideration for Cameroon:** SMS delivery in Cameroon can be delayed, especially during network congestion. Set OTP validity to 10 minutes (not the typical 5) and allow re-send after 60 seconds.

#### 2.2.2 Role-Based Access Control

Replace the single `isAdmin` boolean with a proper RBAC model:

```sql
-- Migration: Add role column to user_profiles
ALTER TABLE user_profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'field_agent'
  CHECK (role IN ('field_agent', 'team_lead', 'admin', 'data_consumer', 'auditor'));

-- Migration: Add agent-specific fields
ALTER TABLE user_profiles ADD COLUMN assigned_zone TEXT; -- e.g., 'bonamoussadi_a'
ALTER TABLE user_profiles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN last_active_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN deactivated_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN deactivated_by TEXT;
```

**Permission Matrix:**

| Permission | field_agent | team_lead | admin | data_consumer | auditor |
|---|---|---|---|---|---|
| Submit data (own zone) | Yes | Yes | Yes | No | No |
| View own submissions | Yes | Yes | Yes | No | Yes |
| View team submissions | No | Yes | Yes | No | Yes |
| View all submissions | No | No | Yes | Yes (read) | Yes |
| Approve/reject submissions | No | Yes | Yes | No | No |
| Manage agents | No | Yes (own team) | Yes | No | No |
| Export data | No | No | Yes | Yes | Yes |
| View audit logs | No | No | Yes | No | Yes |
| Manage system settings | No | No | Yes | No | No |
| Remote wipe agent | No | No | Yes | No | No |

#### 2.2.3 Session Management Hardening

```typescript
// Additions to lib/auth.ts

// Session configuration
export const SESSION_CONFIG = {
  maxAge: 8 * 60 * 60,        // 8 hours (one field shift)
  updateAge: 30 * 60,          // Refresh token every 30 minutes
  idleTimeout: 60 * 60,        // Force re-auth after 1 hour idle
};

// Account lockout
export const LOCKOUT_CONFIG = {
  maxFailedAttempts: 5,
  lockoutDurationMinutes: 30,
  progressiveDelay: true,      // 1s, 2s, 4s, 8s, 16s between attempts
};
```

### 2.3 Data Encryption

#### 2.3.1 Encryption at Rest

| Layer | Current | Target |
|---|---|---|
| **Neon PostgreSQL** | AES-256 at rest (Neon default) | Sufficient for pilot; add column-level encryption for PII fields in Phase 2 |
| **Vercel Blob (photos)** | Server-side encryption (Vercel default) | Sufficient; photos are of businesses/infrastructure, not individuals |
| **IndexedDB (client)** | No encryption | Encrypt queue payloads with a session-derived key (see below) |

#### 2.3.2 Client-Side Queue Encryption

Encrypt IndexedDB contents so stolen devices yield no readable data:

```typescript
// lib/client/queueEncryption.ts
const ALGORITHM = 'AES-GCM';

export async function deriveKey(sessionToken: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sessionToken),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('adl-queue-v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPayload(
  data: string,
  key: CryptoKey
): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );
  return {
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  };
}

export async function decryptPayload(
  encrypted: { iv: string; ciphertext: string },
  key: CryptoKey
): Promise<string> {
  const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(encrypted.ciphertext), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}
```

#### 2.3.3 Field-Level Encryption for PII

For fields that qualify as personal data under Cameroon Law No. 2024/017 (business owner names, phone numbers, agent identifiers):

```sql
-- Create an encryption key managed via Neon/Supabase secrets
-- Field-level encryption using pgcrypto extension

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Example: encrypting business_owner_name in details JSONB
-- Application layer handles encrypt/decrypt using a server-side key
-- stored in Vercel environment variables (FIELD_ENCRYPTION_KEY)
```

**Implementation approach:** Application-level encryption is preferred over database-level because:
1. Neon PostgreSQL's pgcrypto works but creates key management complexity
2. Server-side Node.js encryption using `crypto.createCipheriv` with AES-256-GCM keeps the key in Vercel env vars
3. Encrypted fields are stored as base64 strings in the JSONB `details` column
4. Decryption happens at query time in the API layer, only for authorized roles

### 2.4 API Security

#### 2.4.1 Rate Limiting

Implement per-user and per-IP rate limiting using Vercel's Edge Middleware or application-level checks:

```typescript
// api/_middleware.ts (Vercel Edge Middleware)
// Rate limit configuration
const RATE_LIMITS = {
  // Submissions: 60 per hour per user (one per minute average)
  'POST /api/submissions': { window: 3600, max: 60 },
  // Auth attempts: 10 per 15 minutes per IP
  'POST /api/auth/callback/credentials': { window: 900, max: 10 },
  // Data reads: 100 per hour per user
  'GET /api/submissions': { window: 3600, max: 100 },
  // Export: 5 per hour per user (data_consumer/admin only)
  'GET /api/export': { window: 3600, max: 5 },
};
```

For the pilot, use an in-memory rate limiter backed by Vercel KV (Redis) or a simple sliding window with PostgreSQL:

```sql
CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);
```

#### 2.4.2 Input Validation

Add Zod schemas for all API inputs (builds on Cloud Architect's recommendation):

```typescript
// lib/shared/validation.ts
import { z } from 'zod';

export const submissionSchema = z.object({
  category: z.enum([
    'pharmacy', 'fuel_station', 'mobile_money',
    'alcohol_outlet', 'billboard', 'transport_road', 'census_proxy'
  ]),
  latitude: z.number().min(4.0755).max(4.0999),   // Bonamoussadi bounds
  longitude: z.number().min(9.7185).max(9.7602),   // Bonamoussadi bounds
  details: z.record(z.unknown()).refine(
    (d) => JSON.stringify(d).length < 50000,
    'Details payload too large'
  ),
  photoUrl: z.string().url().optional(),
  idempotencyKey: z.string().uuid(),
});

// Sanitize all string inputs to prevent XSS/injection
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '')           // Strip HTML angle brackets
    .replace(/[\x00-\x1F]/g, '')    // Strip control characters
    .trim()
    .slice(0, 1000);                // Enforce max length
}
```

#### 2.4.3 CORS Configuration

```typescript
// vercel.json - explicit CORS headers
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "https://africandatalayer.vercel.app" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, PUT, DELETE, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization" },
        { "key": "Access-Control-Max-Age", "value": "86400" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

### 2.5 Photo/Evidence Integrity

#### 2.5.1 Hash-on-Capture

Generate a SHA-256 hash of each photo immediately upon capture, before any upload:

```typescript
// lib/client/photoIntegrity.ts
export async function hashPhoto(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface PhotoEvidence {
  file: File;
  sha256: string;
  capturedAt: string;       // ISO 8601
  deviceInfo: string;       // navigator.userAgent (truncated)
  gpsAtCapture: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
}
```

#### 2.5.2 Server-Side Verification

```typescript
// In api/submissions.ts POST handler
async function verifyPhotoIntegrity(
  photoUrl: string,
  clientHash: string
): Promise<boolean> {
  const response = await fetch(photoUrl);
  const buffer = await response.arrayBuffer();
  const serverHash = createHash('sha256').update(Buffer.from(buffer)).digest('hex');
  return serverHash === clientHash;
}
```

#### 2.5.3 EXIF Metadata Preservation

Preserve EXIF metadata as a separate JSON record for audit purposes, even if the photo itself is re-encoded:

```sql
ALTER TABLE point_events ADD COLUMN photo_metadata JSONB;
-- Contains: { exif_gps, exif_timestamp, exif_device, sha256_hash,
--             capture_gps, capture_timestamp, hash_verified }
```

### 2.6 Network Security

#### 2.6.1 Certificate Pinning (Service Worker)

For the PWA, implement certificate pinning via the service worker to detect MitM attempts:

```typescript
// service-worker.ts addition
self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.url.startsWith('https://africandatalayer.vercel.app/api/')) {
    event.respondWith(
      fetch(event.request).then(response => {
        // Verify the response comes from Vercel's expected certificate
        // In practice, this is handled by the browser's TLS implementation
        // The key control is ensuring the service worker only allows
        // requests to our known-good origin
        if (new URL(event.request.url).origin !== self.location.origin) {
          return new Response('Blocked: cross-origin API request', { status: 403 });
        }
        return response;
      })
    );
  }
});
```

Note: True certificate pinning is not possible in PWAs/browsers (deprecated by Chrome in 2018). The practical alternative is:
1. Strict CORS enforcement (Section 2.4.3)
2. Vercel's automatic HTTPS with HSTS
3. Service worker origin checks
4. Content Security Policy headers

#### 2.6.2 Admin VPN Requirement

For admin operations (database access, Vercel dashboard, Neon console):

| Control | Implementation |
|---|---|
| **Neon IP allowlist** | Configure Neon to only accept connections from known IPs (Vercel serverless IPs + admin VPN IP) |
| **Vercel dashboard** | Enable SSO enforcement when available; use strong passwords + authenticator app |
| **GitHub repository** | Require 2FA on all GitHub accounts with repository access; enable branch protection on `main` |

#### 2.6.3 Security Headers

```typescript
// Comprehensive security headers for vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "0" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(self), geolocation=(self), microphone=()" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://*.public.blob.vercel-storage.com https://tile.openstreetmap.org data:; connect-src 'self' https://africandatalayer.vercel.app; frame-ancestors 'none';"
        }
      ]
    }
  ]
}
```

### 2.7 Security Audit Logging

Create a dedicated audit log table for security-relevant events:

```sql
CREATE TABLE security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'login_success', 'login_failure', 'logout', 'mfa_challenge',
    'mfa_success', 'mfa_failure', 'session_expired', 'session_revoked',
    'account_locked', 'account_unlocked', 'role_changed',
    'agent_activated', 'agent_deactivated', 'remote_wipe_triggered',
    'data_export', 'submission_flagged', 'submission_rejected',
    'admin_action', 'api_rate_limited', 'suspicious_activity'
  )),
  user_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user ON security_audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_type ON security_audit_log(event_type, created_at DESC);

-- Retention: 2 years (Cameroon law does not specify, but 2 years is standard practice)
```

---

## 3. Privacy and Consent Framework

### 3.1 Data Inventory and Legal Basis

Under Cameroon Law No. 2024/017, ADL must identify all personal data collected and establish a legal basis for processing.

#### 3.1.1 Personal Data Collected by ADL

| Data Element | Vertical(s) | Personal Data? | Sensitivity | Legal Basis |
|---|---|---|---|---|
| **GPS coordinates of businesses** | All | Yes (if business is identifiable with an individual owner) | Low | Legitimate interest (Article 6) |
| **Photos of business premises** | All | Yes (if individuals are incidentally captured; if business facade identifies an individual) | Medium | Consent (for identifiable individuals); Legitimate interest (for premises only) |
| **Business name** | All | Yes (if sole proprietorship or clearly identified with an individual) | Low | Legitimate interest |
| **Business owner name** | Pharmacy, alcohol, fuel | Yes | Medium | Consent |
| **Business phone number** | Mobile money, pharmacy | Yes | Medium | Consent |
| **Agent GPS tracks** | Internal | Yes (employee monitoring) | Medium | Employment contract (legitimate interest) |
| **Agent identity (name, email, phone)** | Internal | Yes | Medium | Employment contract |
| **Agent device information** | Internal | Yes | Low | Employment contract |
| **Road condition photos** | Transport roads | Potentially (incidental capture of people/vehicles) | Low | Legitimate interest (public interest) |
| **Building photos** | Census proxy | Potentially (incidental capture of residents) | Low | Legitimate interest |

#### 3.1.2 Legal Basis Analysis Under Law No. 2024/017

Cameroon's law recognizes the following legal bases (modeled after GDPR):

1. **Consent (Article 7):** Required when processing has no other legal basis. Must be free, specific, informed, and unambiguous.
2. **Legitimate interest (Article 6):** ADL's primary basis for most business data -- mapping commercial infrastructure serves a legitimate purpose (market intelligence, urban planning, public safety).
3. **Public interest:** Potential basis for road condition and census-proxy data.
4. **Contractual necessity:** Basis for processing agent data under employment/contractor agreements.

**Key legal determination needed:** Whether a photo of a business facade constitutes personal data of the business owner. Under Cameroonian civil law tradition (French-influenced), the answer likely depends on whether the individual is identifiable. For sole proprietorships where the owner's name is on the facade, it qualifies as personal data. For branded chain outlets (Total fuel station, MTN agent point), it likely does not.

### 3.2 Consent Collection Workflow

#### 3.2.1 When Consent Is Required

| Scenario | Consent Required? | Method |
|---|---|---|
| Photo of a branded chain outlet (Total, Orange, MTN) | No -- legitimate interest suffices | No action needed |
| Photo of a sole proprietorship with owner name visible | Yes | Verbal consent + digital record |
| Photo that incidentally captures a person's face | Yes (best practice) | Verbal notice + anonymization option |
| Collecting business owner's phone number | Yes | Verbal consent + digital record |
| Collecting business owner's name | Yes | Verbal consent + digital record |
| GPS location of a business open to the public | No -- publicly observable | No action needed |
| Road condition photo (no identifiable people) | No | No action needed |

#### 3.2.2 Consent Collection Process

```
FIELD AGENT CONSENT WORKFLOW
==============================

Step 1: APPROACH
  - Agent identifies self and ADL
  - Shows ADL identification badge (printed + digital)
  - Explains purpose in French or local language:

    "Bonjour, je m'appelle [Nom] et je travaille pour African Data Layer.
     Nous cartographions les commerces de Bonamoussadi pour aider a
     ameliorer les services dans le quartier. Puis-je prendre une photo
     de votre etablissement et noter quelques informations de base?"

Step 2: INFORM
  - Explain what data will be collected (photo, location, business type)
  - Explain how data will be used (commercial mapping database)
  - Explain data subject rights (access, correction, deletion)
  - Provide ADL contact information for questions
  - Note: agents carry a printed "Fiche d'Information" (info sheet) in
    French with all required information per Article 7

Step 3: RECORD CONSENT
  - In the app, before submitting:
    [x] Consent obtained verbally (checkbox)
    [ ] Consent refused -- submit without PII (checkbox)
    [ ] No consent needed -- public/branded location (checkbox)
  - App records: consent_status, consent_timestamp, agent_id
  - If consent refused: submit GPS + category + non-PII details only;
    do NOT photograph individuals; blur or skip business name if identifiable

Step 4: PROVIDE CONTACT
  - Leave a printed card with:
    - ADL contact email
    - Phone number for data subject requests
    - Reference number (point_id) for the data subject to use when
      exercising rights
```

#### 3.2.3 Consent Data Model

```sql
ALTER TABLE point_events ADD COLUMN consent_status TEXT
  CHECK (consent_status IN (
    'obtained',           -- Verbal consent recorded
    'refused_pii_only',   -- Consent refused; PII stripped
    'not_required',       -- Public/branded location; no PII collected
    'withdrawn'           -- Previously consented, now withdrawn
  ));
ALTER TABLE point_events ADD COLUMN consent_recorded_at TIMESTAMPTZ;
```

### 3.3 Data Subject Rights Implementation

Law No. 2024/017 grants the following rights that ADL must implement:

#### 3.3.1 Right of Access (Article 34)

| Aspect | Implementation |
|---|---|
| **Channel** | Email (privacy@africandatalayer.com) or phone; in-person at ADL office |
| **Identity verification** | Requester must provide the reference number from the card left by the agent, plus a form of identification |
| **Response time** | 30 days maximum (per law) |
| **Format** | JSON export or printed summary in French |
| **Scope** | All data associated with the requester's business or person |

#### 3.3.2 Right of Rectification (Article 35)

| Aspect | Implementation |
|---|---|
| **Channel** | Same as access |
| **Process** | Requester identifies incorrect data; ADL creates an `ENRICH_EVENT` with corrected data; original event preserved for audit |
| **Response time** | 30 days maximum |
| **Notification** | If corrected data has been shared with data consumers, notify them of the correction |

#### 3.3.3 Right of Erasure (Article 36)

| Aspect | Implementation |
|---|---|
| **Channel** | Same as access |
| **Process** | Soft-delete: mark events as `erased` and exclude from projections and snapshots; hard-delete PII fields; retain anonymized location data for statistical purposes |
| **Response time** | 30 days maximum |
| **Exceptions** | ADL may retain anonymized, non-identifiable aggregate data (e.g., "there is a pharmacy at this GPS coordinate" without owner name/photo) |
| **Photo deletion** | Delete photo from Vercel Blob storage; remove `photo_url` from events |

```sql
-- Erasure implementation
ALTER TABLE point_events ADD COLUMN erased_at TIMESTAMPTZ;
ALTER TABLE point_events ADD COLUMN erased_by TEXT;
ALTER TABLE point_events ADD COLUMN erasure_reason TEXT;

-- Erasure procedure (run as a function)
-- 1. Set erased_at, erased_by, erasure_reason
-- 2. Null out: details fields containing PII, photo_url
-- 3. Delete photo from Vercel Blob
-- 4. Log in security_audit_log
-- 5. Rebuild affected snapshots
```

#### 3.3.4 Right to Object (Article 37)

A data subject can object to processing based on legitimate interest. ADL must then either demonstrate compelling legitimate grounds or cease processing that individual's data.

**Process:** Same as erasure, but ADL first evaluates whether the legitimate interest outweighs the data subject's rights. Document the decision.

### 3.4 Data Minimization by Vertical

| Vertical | Required Fields | Explicitly NOT Collected | Rationale |
|---|---|---|---|
| **Pharmacy** | GPS, photo of facade, business name, license status, operating hours | Owner personal phone, employee names, drug inventory, patient information | Mapping commercial presence, not healthcare records |
| **Fuel Station** | GPS, photo, brand, fuel types, services offered | Employee names, sales volumes, security arrangements | Mapping infrastructure, not business intelligence |
| **Mobile Money** | GPS, photo, operator(s), agent status | Agent personal phone, transaction volumes, float amounts, customer information | Mapping access points, not financial data |
| **Alcohol Outlet** | GPS, photo, establishment type, formal/informal status | Owner phone, revenue, supplier information | Mapping presence and type, not business operations |
| **Billboard** | GPS, photo, size, type, content category | Advertiser contract details, pricing, operator revenue | Mapping physical assets, not commercial terms |
| **Transport Road** | GPS, photo, road condition, blockage status | License plates of vehicles, faces of pedestrians | Mapping infrastructure, not surveilling individuals |
| **Census Proxy** | GPS, photo of building, building type, stories, occupancy indicator | Resident names, household composition, income, ethnicity | Mapping density, not conducting a census |

### 3.5 Cross-Border Data Transfer Controls

ADL's infrastructure stores data outside Cameroon:
- **Vercel serverless functions:** Deployed to Vercel's edge network; nearest PoP is likely in Europe (no African PoP yet)
- **Neon PostgreSQL:** Hosted in AWS regions; nearest to Cameroon would be eu-west-1 (Ireland) or eu-central-1 (Frankfurt)
- **Vercel Blob:** Stored in Vercel's cloud storage (US/EU)

Under Law No. 2024/017, cross-border transfers of personal data to countries without "adequate" data protection require additional safeguards.

#### 3.5.1 Transfer Mechanism

Since neither the US nor any EU country has been formally assessed for "adequacy" by Cameroon's nascent Data Protection Authority, ADL should implement:

1. **Standard Contractual Clauses (SCCs):** Draft SCCs for the Vercel and Neon data processing relationships, modeled on EU SCCs (which Cameroon's law is based on).

2. **Data Processing Agreements (DPAs):**
   - Vercel: Review Vercel's existing DPA (available at vercel.com/legal/dpa); ensure it covers Cameroon law requirements
   - Neon: Review Neon's DPA; ensure adequate security commitments
   - Google (OAuth, Gemini): Review Google's data processing terms

3. **Supplementary Measures:**
   - Field-level encryption of PII before it leaves Cameroon (encryption keys held by ADL, not by cloud providers)
   - Data pseudonymization (replace agent names with IDs in stored data)
   - Geographic restriction where possible (prefer EU regions which have stronger data protection alignment)

#### 3.5.2 Data Localization Assessment

| Option | Feasibility | Cost Impact | Recommendation |
|---|---|---|---|
| **Full localization (servers in Cameroon)** | Low -- no major cloud provider has a Cameroon region; local hosting lacks reliability | Very High | Not recommended for pilot |
| **Regional localization (EU region)** | High -- Neon and Vercel both support EU regions | Low | Recommended: Neon EU region + Vercel EU deployment preference |
| **Encryption-based protection** | High -- encrypt PII before upload; keys in ADL control | Low | Recommended: implement immediately |
| **Hybrid** | Medium -- store PII locally, store non-PII in cloud | Medium | Consider for Phase 2 if DPA requires |

### 3.6 Privacy Impact Assessment Template

ADL must conduct a PIA for each vertical before collecting data. Template:

```
PRIVACY IMPACT ASSESSMENT -- [VERTICAL NAME]
==============================================

1. DESCRIPTION OF PROCESSING
   - What data is collected:
   - Why it is collected:
   - How it is collected:
   - Who collects it:
   - How long it is retained:
   - Who has access:

2. NECESSITY AND PROPORTIONALITY
   - Is each data element necessary for the stated purpose?
   - Could the purpose be achieved with less data?
   - Is the processing proportionate to the benefit?

3. DATA PROTECTION RISKS
   - Risk of unauthorized access:        [Low/Medium/High]
   - Risk of unauthorized disclosure:     [Low/Medium/High]
   - Risk of data loss:                   [Low/Medium/High]
   - Risk of harm to data subjects:       [Low/Medium/High]
   - Risk of discrimination or profiling: [Low/Medium/High]

4. MITIGATING MEASURES
   - Technical controls:
   - Organizational controls:
   - Consent mechanisms:
   - Retention limits:

5. RESIDUAL RISK ASSESSMENT
   - After mitigations, is the residual risk acceptable? [Yes/No]
   - If No, what additional measures are needed?

6. APPROVAL
   - Prepared by:          Date:
   - Reviewed by DPO:      Date:
   - Approved by:          Date:
```

### 3.7 Data Protection Officer (DPO)

Law No. 2024/017 requires organizations processing personal data to appoint a DPO when:
- Processing is carried out by a public authority
- Core activities involve regular and systematic monitoring of data subjects at large scale
- Core activities involve large-scale processing of special categories of data

ADL likely falls under the second category (systematic mapping of businesses constitutes regular and systematic monitoring of economic activity that can be linked to identifiable individuals).

#### DPO Requirements

| Requirement | ADL Approach |
|---|---|
| **Appointment** | Appoint a named DPO before pilot launch; may be part-time for pilot phase |
| **Qualifications** | Must have knowledge of Cameroonian data protection law; legal background preferred; can be external consultant |
| **Independence** | DPO must not receive instructions regarding the exercise of their tasks; must report directly to highest management |
| **Contact** | DPO contact details must be published and communicated to the Data Protection Authority |
| **Tasks** | Inform and advise ADL on obligations; monitor compliance; cooperate with DPA; serve as contact point for data subjects |
| **Registration** | Register the DPO appointment with the Data Protection Authority (once it is operational) |

**Practical recommendation for pilot:** Engage a Cameroonian lawyer with data protection expertise as an external DPO on a retainer basis. Cost estimate: 200,000 -- 500,000 XAF/month (~300 -- 750 USD). This is more practical than hiring a full-time DPO for a pilot.

### 3.8 Data Retention Policy

| Data Category | Retention Period | Justification | Deletion Method |
|---|---|---|---|
| **Active point_events** | Indefinite (as long as the entity exists) | Core data product; value increases over time | Retained until erasure request or entity confirmed permanently closed |
| **Erased/withdrawn events** | PII deleted immediately; anonymized stub retained 5 years | Legal record of processing history | PII fields nulled; photo deleted; anonymized record retained |
| **Security audit logs** | 2 years | Incident investigation; regulatory compliance | Automated purge after 2 years |
| **Agent employment data** | Duration of engagement + 5 years | Cameroonian labor law record-keeping requirements | Delete after retention period |
| **Consent records** | Duration of data processing + 5 years | Proof of consent for regulatory compliance | Archive after retention period |
| **Photos (Vercel Blob)** | Same as parent point_event | Evidence integrity | Delete when parent event is erased or entity confirmed closed for 1 year |
| **Snapshots** | Indefinite | Historical trend data (core product value) | Anonymize PII in snapshots when source events are erased |

---

## 4. Incident Response Plan

### 4.1 Incident Classification

| Severity | Definition | Examples | Response Time | Escalation |
|---|---|---|---|---|
| **SEV-1: Critical** | Active data breach; agent physical danger; complete platform outage | Database compromise, agent assault, ransomware, unauthorized bulk data export | Immediate (within 30 minutes) | CEO + DPO + legal counsel |
| **SEV-2: High** | Confirmed security incident without active exploitation; significant data exposure risk | Stolen device with unsynced data, compromised agent credentials, Vercel/Neon outage >1 hour | Within 2 hours | CTO + DPO |
| **SEV-3: Medium** | Suspected security incident; limited impact | Unusual API access patterns, failed MFA bypass attempts, single agent impersonation attempt | Within 24 hours | CTO |
| **SEV-4: Low** | Minor security event; no data exposure | Password reset requests, expired certificates, minor phishing attempts targeting agents | Within 72 hours | Engineering lead |

### 4.2 Response Procedures

#### 4.2.1 Device Theft/Loss

```
RUNBOOK: DEVICE THEFT OR LOSS
================================

TRIGGER: Agent reports device stolen or lost

IMMEDIATE (within 30 minutes):
1. Agent calls team lead or ADL emergency number
2. Team lead logs incident in security_audit_log via admin panel
3. Admin triggers remote wipe for the agent's account:
   - Set wipe_requested = true on user_profiles
   - Revoke all active sessions (rotate JWT secret for this user)
   - Mark account as suspended (is_active = false)
4. If device had unsynced submissions:
   - Note the approximate count and recency from agent's memory
   - Mark potentially compromised data window in incident log

WITHIN 24 HOURS:
5. Agent files police report at nearest Douala commissariat
6. ADL receives copy of police report (PV) for records
7. Assess data exposure:
   - Was IndexedDB queue encrypted? (If encryption implemented: LOW risk)
   - How many unsynced submissions were on device?
   - Did any submissions contain PII (business owner names, photos)?
8. If PII was on device and queue was NOT encrypted:
   - This qualifies as a personal data breach under Law No. 2024/017
   - Proceed to regulatory notification procedure (Section 4.2.2)

WITHIN 48 HOURS:
9. Issue replacement access to agent (new account or reactivated with new credentials + MFA)
10. Agent re-collects any lost unsynced data
11. Document lessons learned

SEVERITY: SEV-2 (unless PII exposure confirmed, then SEV-1)
```

#### 4.2.2 Data Breach (Regulatory Notification)

```
RUNBOOK: DATA BREACH NOTIFICATION
====================================

TRIGGER: Confirmed exposure of personal data to unauthorized parties

CLASSIFICATION:
- Unencrypted device theft with PII: BREACH
- Database compromise: BREACH
- API exploitation with data exfiltration: BREACH
- Vercel/Neon provider breach affecting ADL data: BREACH
- Stolen device with encrypted queue, no PII: NOT A BREACH (document and close)

WITHIN 72 HOURS (legal requirement under Law No. 2024/017):
1. DPO prepares breach notification to the Data Protection Authority:
   - Nature of the breach
   - Categories and approximate number of data subjects affected
   - Categories and approximate number of personal data records affected
   - Likely consequences of the breach
   - Measures taken or proposed to address the breach
   - Contact details of the DPO

2. DPO submits notification to:
   - Cameroon Data Protection Authority (once operational)
   - Until DPA is operational: Ministry of Posts and Telecommunications
     (transitional authority for data protection matters)
   - Email + registered letter

3. If breach is likely to result in HIGH risk to data subjects:
   - Notify affected data subjects directly
   - Use communication template (Section 4.3.2)
   - Provide in French
   - Notify via: phone call (primary), email (secondary),
     physical visit to affected business (if feasible)

WITHIN 7 DAYS:
4. Complete internal investigation
5. Implement remediation measures
6. Update DPA with full investigation report

WITHIN 30 DAYS:
7. Complete post-incident review (Section 4.5)
8. Update security controls based on findings
9. File final report with DPA
```

#### 4.2.3 Agent Compromise (Credential Theft / Impersonation)

```
RUNBOOK: AGENT COMPROMISE
============================

TRIGGER: Suspected unauthorized use of agent credentials

DETECTION SIGNALS:
- Submissions from unusual IP addresses
- Submissions outside assigned zone
- Submissions at unusual hours (e.g., 3 AM)
- Multiple simultaneous sessions for same agent
- GPS patterns inconsistent with walking speed (>50 km/h)
- EXIF/GPS mismatch on photos
- Sudden change in submission volume or pattern

IMMEDIATE:
1. Suspend agent account (is_active = false)
2. Revoke all active sessions
3. Trigger remote wipe
4. Contact the real agent via known phone number to verify

IF IMPERSONATION CONFIRMED:
5. Flag all submissions from suspected compromise window
6. Admin reviews flagged submissions for data integrity
7. Delete or quarantine fraudulent submissions
8. Agent creates new account with new credentials + MFA
9. Investigate how credentials were compromised:
   - Shared credentials? -> Agent training
   - Phishing? -> Security awareness training
   - Malware on device? -> Device inspection
10. If fraudulent data was served to customers, notify them

SEVERITY: SEV-2 (SEV-1 if large volume of fraudulent data was distributed)
```

#### 4.2.4 System Outage

```
RUNBOOK: SYSTEM OUTAGE
=========================

TRIGGER: Platform unavailable for >15 minutes

TRIAGE:
1. Check Vercel status page (vercel.com/status)
2. Check Neon status page (neon.tech/status)
3. Check /api/health endpoint from external monitor
4. Check GitHub Actions for failed deployments

IF VERCEL OUTAGE:
- Field agents continue collecting offline (IndexedDB queue)
- Communicate to team leads: "Continue collecting; data will sync when service restores"
- Monitor Vercel status for resolution
- No action needed unless outage exceeds 24 hours

IF NEON/DATABASE OUTAGE:
- API returns errors; Edge Config fallback serves read-only cached data
- Field agents can still submit (queue locally) but submissions won't persist
- Monitor Neon status
- If >4 hours: consider activating backup database restore procedure

IF ADL APPLICATION BUG:
- Roll back to previous Vercel deployment via Vercel dashboard
- Investigate root cause
- Fix, test, and redeploy

COMMUNICATION:
- Team leads notified within 30 minutes via WhatsApp group
- Field agents notified within 1 hour via team leads
- If >4 hours: post status update to admin dashboard

SEVERITY: SEV-2 (if >1 hour); SEV-3 (if <1 hour)
```

### 4.3 Communication Templates

#### 4.3.1 Internal Incident Alert

```
ALERTE SECURITE ADL -- [SEV-X]
================================
Date/Heure: [YYYY-MM-DD HH:MM UTC]
Type d'incident: [Device theft / Data breach / Agent compromise / Outage]
Description: [Brief description in French]
Impact: [What data/users/operations are affected]
Actions immediates prises: [List actions already taken]
Prochaines etapes: [Next steps and responsible parties]
Point de contact: [Name + phone number]

NE PAS PARTAGER EN DEHORS DE L'EQUIPE ADL.
```

#### 4.3.2 Data Subject Breach Notification (French)

```
NOTIFICATION DE VIOLATION DE DONNEES PERSONNELLES
====================================================

Madame, Monsieur,

Nous vous informons qu'un incident de securite affectant vos donnees
personnelles a ete detecte le [DATE].

Nature de l'incident: [Description]

Donnees concernees: [List of affected data types, e.g., nom commercial,
localisation GPS, photo de facade]

Consequences probables: [e.g., "Vos informations commerciales pourraient
avoir ete consultees par des personnes non autorisees."]

Mesures prises: [e.g., "Nous avons immediatement securise nos systemes,
revoque les acces compromis, et renforce nos controles de securite."]

Mesures recommandees: [e.g., "Si vous constatez une utilisation
inhabituelle de vos informations, veuillez nous contacter immediatement."]

Vos droits: Conformement a la Loi No. 2024/017 relative a la protection
des donnees a caractere personnel, vous avez le droit d'acceder a vos
donnees, de les faire rectifier ou supprimer. Pour exercer ces droits,
contactez notre Delegue a la Protection des Donnees:

[DPO Name]
Email: privacy@africandatalayer.com
Telephone: [+237 XXX XXX XXX]

Nous vous prions d'agreer, Madame, Monsieur, l'expression de nos
sinceres regrets pour cet incident.

[Signature]
African Data Layer
```

#### 4.3.3 Regulatory Notification to DPA

```
NOTIFICATION DE VIOLATION DE DONNEES A L'AUTORITE DE PROTECTION
=================================================================

A l'attention de: [Autorite de Protection des Donnees Personnelles
du Cameroun / Ministere des Postes et Telecommunications]

De: African Data Layer, [Address]
DPO: [Name], [Contact]
Date de notification: [DATE]

1. NATURE DE LA VIOLATION
   [Description of what happened]

2. DATE ET HEURE DE LA VIOLATION
   Detectee le: [DATE]
   Estimee avoir eu lieu le: [DATE]

3. CATEGORIES DE DONNEES CONCERNEES
   [List: e.g., localisation GPS, photos de facades commerciales,
   noms d'etablissements]

4. NOMBRE APPROXIMATIF DE PERSONNES CONCERNEES
   [Number]

5. NOMBRE APPROXIMATIF D'ENREGISTREMENTS CONCERNES
   [Number]

6. CONSEQUENCES PROBABLES
   [Assessment of likely impact]

7. MESURES PRISES OU PROPOSEES
   [List of remediation actions]

8. COORDONNEES DU DPO
   [Full contact details]

Document soumis conformement a la Loi No. 2024/017 du 23 decembre 2024.
```

### 4.4 Evidence Preservation

During any security incident:

1. **Do not modify production systems** until evidence is collected
2. **Database:** Take an immediate `pg_dump` snapshot before any remediation
3. **Vercel logs:** Export all relevant request logs via Vercel CLI (`vercel logs --output json`)
4. **Security audit logs:** Export all entries from `security_audit_log` for the incident window
5. **Screenshots:** Capture Vercel dashboard, Neon dashboard, and any relevant admin panels
6. **Agent testimony:** Record written statements from affected agents (in French, signed and dated)
7. **Police report:** For physical incidents (theft, assault), obtain a copy of the PV (proces-verbal)
8. **Chain of custody:** All evidence is stored in a dedicated, access-restricted directory with hash verification

### 4.5 Post-Incident Review

Conduct within 7 days of incident resolution:

```
POST-INCIDENT REVIEW TEMPLATE
================================

INCIDENT: [ID] -- [Title]
DATE: [Date of incident]
SEVERITY: [SEV-X]
DURATION: [Time from detection to resolution]

1. TIMELINE
   [Chronological list of events with timestamps]

2. ROOT CAUSE
   [What caused the incident]

3. CONTRIBUTING FACTORS
   [What allowed it to happen or made it worse]

4. DETECTION
   - How was the incident detected?
   - How long between occurrence and detection?
   - Could we have detected it sooner? How?

5. RESPONSE ASSESSMENT
   - Were procedures followed?
   - What worked well?
   - What could be improved?

6. IMPACT
   - Data subjects affected: [count]
   - Data records affected: [count]
   - Business impact: [description]
   - Regulatory impact: [notifications sent]

7. ACTION ITEMS
   [Numbered list of improvements with owners and deadlines]

8. SIGN-OFF
   Reviewed by: [Names]
   Date: [Date]
```

---

## 5. Field Agent Security Training

### 5.1 Training Program Overview

| Module | Duration | Delivery | Frequency |
|---|---|---|---|
| **M1: Device Security** | 45 minutes | In-person, hands-on | At onboarding + annual refresh |
| **M2: Data Handling** | 30 minutes | In-person with scenarios | At onboarding + annual refresh |
| **M3: Consent Collection** | 60 minutes | In-person with role-play | At onboarding + quarterly refresh |
| **M4: Social Engineering** | 30 minutes | In-person with examples | At onboarding + semi-annual refresh |
| **M5: Incident Reporting** | 20 minutes | In-person + quick-reference card | At onboarding + annual refresh |
| **M6: Physical Safety** | 30 minutes | In-person with local context | At onboarding + annual refresh |

**Total onboarding training time:** ~3.5 hours (can be split across 2 days)
**Language:** French (primary), with key terms in English for the app interface
**Assessment:** Short quiz (10 questions) at end of each module; must score 80% to be activated as an agent

### 5.2 Module Details

#### M1: Device Security

**Learning objectives:** Agents can secure their device, enable screen lock, and know what to do if their phone is stolen.

Content:
1. **Screen lock:** Set a 6-digit PIN or fingerprint; do NOT use pattern lock (easy to observe)
2. **App lock:** If available, set app-specific lock on the ADL PWA
3. **Avoid public Wi-Fi:** Use mobile data (MTN/Orange) for syncing; public Wi-Fi in Douala is not secure
4. **Keep phone updated:** Accept Android security updates when prompted
5. **Do not root/jailbreak:** Rooted phones compromise security; ADL may refuse submissions from rooted devices in the future
6. **Charging security:** Do not use public USB charging stations (juice-jacking risk); use personal power banks or wall chargers
7. **What to do if phone is stolen or lost:**
   - Immediately call team lead: [Phone number]
   - Do NOT try to recover the phone yourself
   - File a police report at the nearest commissariat within 24 hours
   - ADL will remotely disable your account and wipe app data

**Hands-on exercise:** Each agent configures screen lock and demonstrates sync while connected to mobile data.

#### M2: Data Handling

**Learning objectives:** Agents understand what data they can and cannot collect, and how to handle it.

**DO:**
- Only collect data for the vertical(s) you are assigned
- Sync your data as frequently as possible (do not accumulate a large offline queue)
- Use the ADL app for all data entry (do not use notes apps, WhatsApp, or paper)
- Report any data errors you notice (wrong location, wrong category)

**DO NOT:**
- Take photos of people's faces (focus on business facades and infrastructure)
- Collect data about people's personal lives, health conditions, or financial details
- Share your login credentials with anyone, including other agents
- Share ADL data with anyone outside ADL (including screenshots of the app)
- Store ADL data outside the app (no WhatsApp photos, no email exports)
- Continue using ADL if your account is suspended (contact team lead)

**Scenario exercise:** Present 5 field situations and ask agents to identify what they should and should not do.

#### M3: Consent Collection

**Learning objectives:** Agents can explain ADL's purpose, collect consent, and handle refusals professionally.

**Role-play scenarios (in French):**

1. **Willing business owner:** Agent approaches, explains, owner agrees, agent records consent and collects data.

2. **Reluctant business owner:** Owner is suspicious. Agent remains calm, explains data subject rights, offers to leave the info card, and respects the refusal. Agent records `consent_refused` and collects only non-PII data (GPS + category).

3. **Informal operator:** Agent approaches an informal mobile money agent who is not registered. Agent explains that ADL maps services to improve access. Does NOT mention regulatory compliance or enforcement. Collects only publicly observable data if consent is not given.

4. **Person objects to being photographed:** Agent apologizes, explains they are only photographing the business facade, and offers to retake the photo when the person has moved. If person insists, agent skips the photo and submits text-only.

5. **Language barrier:** Business owner speaks only a local language (e.g., Pidgin English, Bassa, Duala). Agent uses basic phrases or asks a nearby person to help translate the core message. If cannot communicate, skip the consent-required data and record `consent_refused`.

**Consent script (laminated card for each agent):**

```
SCRIPT DE CONSENTEMENT -- CARTE AGENT ADL
==========================================

[Montrer le badge ADL]

"Bonjour Madame/Monsieur, je suis [Nom], je travaille pour African Data
Layer. Nous cartographions les commerces et services de Bonamoussadi.

Je souhaite prendre une photo de votre etablissement et noter des
informations de base comme le nom, le type d'activite, et la localisation.

Ces informations servent a ameliorer la connaissance des services
disponibles dans le quartier.

Vous avez le droit de refuser. Vous avez aussi le droit de demander a
voir, corriger ou supprimer vos informations a tout moment en nous
contactant.

[Donner la carte de contact ADL]

Acceptez-vous que je prenne ces informations?"

SI OUI: "Merci. Voici une carte avec nos coordonnees et votre numero
de reference si vous avez des questions a l'avenir."

SI NON: "Pas de probleme, je vous remercie. Bonne journee."
```

#### M4: Social Engineering Awareness

**Learning objectives:** Agents recognize manipulation attempts and do not disclose ADL information.

**Scenarios to recognize:**

1. **"I'm from the government, show me your data":** No government official can demand to see ADL data on your phone. Ask for their identification, explain you will report the request to ADL management, and leave. Call your team lead.

2. **"I work for ADL too, let me use your phone":** Never let anyone use your ADL account. Credential sharing is grounds for termination.

3. **"My boss wants to know what you are recording":** Explain ADL's purpose using the standard script. Do not show the app interface or data to anyone.

4. **"Send me the photos on WhatsApp":** ADL data is never shared via WhatsApp, email, or any channel outside the app. Decline politely.

5. **"Give me your login, I forgot mine":** Each agent has their own credentials. They must contact the team lead for password reset. Never share credentials.

#### M5: Incident Reporting

**Quick-reference card (wallet-sized, laminated):**

```
URGENCE ADL -- QUE FAIRE?
============================

TELEPHONE VOLE OU PERDU:
-> Appeler [Team Lead]: +237 XXX XXX XXX
-> Commissariat le plus proche dans 24h

AGRESSION OU MENACE:
-> Quitter les lieux immediatement
-> Appeler le 117 (police)
-> Appeler [Team Lead]: +237 XXX XXX XXX
-> NE PAS revenir seul sur les lieux

PROBLEME AVEC L'APPLICATION:
-> Redemarrer l'application
-> Verifier la connexion internet
-> Appeler [Tech Support]: +237 XXX XXX XXX

QUELQU'UN DEMANDE VOS IDENTIFIANTS:
-> Refuser poliment
-> Signaler a [Team Lead]

VOUS REMARQUEZ DES DONNEES SUSPECTES:
-> Ne pas modifier
-> Signaler a [Team Lead]
```

#### M6: Physical Safety

**Learning objectives:** Agents can assess risk before entering an area and know when to disengage.

**Safety rules:**

1. **Always inform your team lead of your planned route** before starting a shift
2. **Work in pairs** in areas with higher risk (market areas at night, areas near informal operations)
3. **Do not enter private property** without invitation
4. **If someone becomes aggressive, leave immediately.** No data point is worth your safety.
5. **Carry minimal valuables** during field work -- just your phone, ADL badge, and water
6. **Avoid working after dark** unless specifically authorized and paired
7. **During rainy season:** Do not attempt to cross flooded roads; report blocked roads from a safe distance
8. **Know your exits:** Before entering a narrow alley or market, note how you will leave
9. **Dress appropriately:** ADL-branded shirt/vest provides legitimacy but can also make you a target if perceived as "wealthy." Discuss with team lead based on zone.
10. **Trust your instincts:** If a situation feels wrong, leave and report

**Emergency contacts (on badge and phone):**
- Team Lead: +237 XXX XXX XXX
- Police emergency: 117
- Fire/ambulance: 118
- ADL Office: +237 XXX XXX XXX

---

## 6. Compliance Checklist

### Pre-Pilot Launch Checklist (Deadline: Before June 23, 2026)

#### Legal and Regulatory

| # | Task | Owner | Status | Deadline | Notes |
|---|---|---|---|---|---|
| L1 | Appoint a Data Protection Officer (DPO) | CEO | Not started | April 15, 2026 | External consultant recommended; see Section 3.7 |
| L2 | Register as data controller with the DPA (or transitional authority) | DPO | Not started | May 15, 2026 | Submit registration form with description of processing activities |
| L3 | Draft and publish a Privacy Policy (in French) | DPO + Legal | Not started | May 1, 2026 | Must cover all points in Article 7 of Law No. 2024/017; publish on website and in app |
| L4 | Execute Data Processing Agreements with Vercel, Neon, Google | DPO + CTO | Not started | May 15, 2026 | Review existing provider DPAs for Cameroon law compatibility |
| L5 | Prepare Standard Contractual Clauses for cross-border transfers | DPO + Legal | Not started | May 15, 2026 | Required for data stored outside Cameroon |
| L6 | Complete Privacy Impact Assessments for each vertical | DPO | Not started | May 30, 2026 | Use template in Section 3.6; start with P0 verticals (roads, mobile money) |
| L7 | Establish data subject rights procedure (access, rectification, erasure) | DPO + Engineering | Not started | May 30, 2026 | Implement technical capability + documented procedure |
| L8 | Create data retention policy and schedule | DPO | Not started | May 15, 2026 | See Section 3.8 |
| L9 | Prepare breach notification templates | DPO | Not started | May 15, 2026 | See Section 4.3 |
| L10 | Document lawful basis for each data processing activity | DPO | Not started | May 15, 2026 | See Section 3.1.2 |

#### Technical Security

| # | Task | Owner | Status | Deadline | Notes |
|---|---|---|---|---|---|
| S1 | Implement RBAC (replace isAdmin boolean) | Engineering | Not started | April 30, 2026 | See Section 2.2.2; database migration + API changes |
| S2 | Add SMS-based MFA for agent login | Engineering | Not started | May 15, 2026 | See Section 2.2.1; integrate Africa's Talking or Twilio |
| S3 | Implement session timeout (8 hours) and idle timeout (1 hour) | Engineering | Not started | April 30, 2026 | See Section 2.2.3 |
| S4 | Implement account lockout after 5 failed attempts | Engineering | Not started | April 30, 2026 | See Section 2.2.3 |
| S5 | Add consent_status field to point_events | Engineering | Not started | April 30, 2026 | See Section 3.2.3; database migration |
| S6 | Implement application-level remote wipe | Engineering | Not started | May 15, 2026 | See Section 2.1.3 |
| S7 | Add security audit logging table and instrumentation | Engineering | Not started | May 15, 2026 | See Section 2.7 |
| S8 | Implement photo hash-on-capture | Engineering | Not started | May 15, 2026 | See Section 2.5.1 |
| S9 | Configure security headers (CSP, HSTS, X-Frame-Options) | Engineering | Not started | April 30, 2026 | See Section 2.6.3; vercel.json changes |
| S10 | Implement API rate limiting | Engineering | Not started | May 15, 2026 | See Section 2.4.1 |
| S11 | Add Zod input validation to all API endpoints | Engineering | Not started | May 15, 2026 | See Section 2.4.2 |
| S12 | Implement IndexedDB queue encryption | Engineering | Not started | May 30, 2026 | See Section 2.3.2 |
| S13 | Configure explicit CORS policy | Engineering | Not started | April 30, 2026 | See Section 2.4.3 |
| S14 | Implement data subject rights API endpoints (access, erasure) | Engineering | Not started | May 30, 2026 | See Section 3.3 |
| S15 | Deploy Neon database to EU region | Engineering | Not started | April 30, 2026 | Minimizes cross-border transfer risk |

#### Operational

| # | Task | Owner | Status | Deadline | Notes |
|---|---|---|---|---|---|
| O1 | Develop agent consent collection training materials (French) | Operations + DPO | Not started | May 15, 2026 | See Section 5.2 M3 |
| O2 | Print agent badges, consent scripts, and info cards | Operations | Not started | May 30, 2026 | Laminated, French language |
| O3 | Conduct field agent security training (all 6 modules) | Operations + Security | Not started | June 1, 2026 | 3.5 hours per agent; schedule 2 sessions |
| O4 | Create incident response WhatsApp group | Operations | Not started | May 15, 2026 | Team leads + admin + DPO |
| O5 | Establish emergency contact list and print wallet cards | Operations | Not started | May 30, 2026 | See Section 5.2 M5 |
| O6 | Test incident response procedures (tabletop exercise) | Security + Operations | Not started | June 1, 2026 | Run through device theft and data breach scenarios |
| O7 | Document and test data subject rights fulfillment process end-to-end | DPO + Engineering | Not started | June 1, 2026 | Submit a test access/erasure request and verify |
| O8 | Configure external uptime monitoring for /api/health | Engineering | Not started | May 15, 2026 | UptimeRobot or Better Uptime; 5-minute intervals |
| O9 | Set up Sentry error tracking with PII scrubbing rules | Engineering | Not started | May 15, 2026 | Ensure no PII appears in error reports |

### Compliance Confidence Assessment

| Area | Current Readiness | Target by June 23 | Risk if Not Met |
|---|---|---|---|
| **DPO appointment** | 0% | 100% | Cannot demonstrate compliance; regulatory exposure |
| **DPA registration** | 0% | 100% | Operating without registration is a violation |
| **Privacy policy** | 0% | 100% | Agents cannot inform data subjects without it |
| **Consent workflow** | 0% | 100% | Every data point collected without consent is a potential violation |
| **Cross-border transfer safeguards** | 0% | 80% | All data currently stored outside Cameroon without safeguards |
| **Data subject rights** | 0% | 80% | Must be able to respond within 30 days |
| **Breach notification capability** | 0% | 100% | 72-hour legal deadline is non-negotiable |
| **Technical security controls** | 30% (auth exists, fraud detection exists) | 80% | Security gaps increase breach risk |
| **Agent training** | 0% | 100% | Untrained agents will mishandle consent and data |

**Overall assessment:** ADL has approximately 14 weeks until the June 23, 2026 compliance deadline. The work is substantial but achievable if started immediately. The highest priority items are DPO appointment (L1), privacy policy (L3), consent workflow (S5 + O1), and cross-border transfer safeguards (L4 + L5).

---

## Appendix A: Key Provisions of Cameroon Law No. 2024/017

For quick reference by the ADL team:

| Article | Provision | ADL Relevance |
|---|---|---|
| **Art. 2** | Applies to any processing of personal data by a person in Cameroon or using means located in Cameroon | ADL is subject -- agents in Cameroon, data about Cameroon |
| **Art. 5** | Defines personal data as any information relating to an identified or identifiable natural person | Business owner names, photos with faces, phone numbers qualify |
| **Art. 6** | Processing must have a legal basis (consent, contract, legal obligation, public interest, legitimate interest) | ADL relies on legitimate interest (mapping) and consent (PII) |
| **Art. 7** | Consent must be free, specific, informed, and unambiguous; can be withdrawn at any time | Consent workflow required for PII collection |
| **Art. 15-16** | Data controller must register with the DPA before processing | ADL must register before pilot launch |
| **Art. 20** | DPO appointment required in certain circumstances | ADL likely requires a DPO (systematic monitoring) |
| **Art. 28-32** | Cross-border transfers require adequate protection in recipient country or appropriate safeguards | SCCs and DPAs required for Vercel, Neon, Google |
| **Art. 34-37** | Data subject rights: access, rectification, erasure, objection | Must implement technical and organizational measures |
| **Art. 45** | Breach notification to DPA within 72 hours | Incident response plan must be operational |
| **Art. 52-55** | Penalties: fines up to 100 million XAF (~$150,000 USD); imprisonment for certain violations | Material financial and personal risk |
| **Art. 60** | 6-month transitional period for compliance (expires June 23, 2026) | Hard deadline for all controls |

## Appendix B: Third-Party Risk Register

| Provider | Data Processed | Location | DPA Available? | Risk Level | Action Required |
|---|---|---|---|---|---|
| **Vercel** | All API traffic, photos (Blob), serverless function logs, analytics | US (primary), EU (available) | Yes (vercel.com/legal/dpa) | Medium | Review DPA for Cameroon law compatibility; prefer EU deployment |
| **Neon (PostgreSQL)** | All structured data (point_events, user_profiles, snapshots) | US/EU (configurable) | Yes | Medium | Deploy to EU region; review DPA |
| **Google (OAuth)** | User email, name, profile photo (for Google login users) | US/Global | Yes (Google Cloud DPA) | Low | Review DPA; minimal data scope |
| **Google (Gemini AI)** | Search queries from admin interface | US/Global | Yes | Low | Ensure no PII is sent in AI queries; review data retention terms |
| **Africa's Talking / Twilio** | Agent phone numbers (for SMS OTP) | Kenya/US | Yes | Low | Review DPA; data is limited to phone numbers and OTP codes |
| **Sentry** | Error traces, potentially including PII in stack traces | US/EU | Yes | Medium | Enable PII scrubbing; configure to EU region; review DPA |
| **GitHub** | Source code, CI/CD logs | US | Yes | Low | No personal data in code; ensure secrets are not committed |

---

## Sources

- [Cameroon Law No. 2024/017 on Personal Data Protection](https://prc.cm/en/multimedia/documents/10271-law-n-2024-017-of-23-12-2024-web)
- [Key Features of Cameroon Law 2024/017 -- Pollicy](https://pollicy.medium.com/key-features-of-law-2024-017-on-personal-data-protection-in-cameroon-5ee06f79dd1a)
- [Cameroon Data Protection Compliance -- Lex Africa](https://lexafrica.com/2025/10/cameroon-data-protection-law-compliance/)
- [OWASP Mobile Security Testing Guide](https://owasp.org/www-project-mobile-security-testing-guide/)
- [NIST Incident Response Guide (SP 800-61 Rev. 2)](https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final)
- [Vercel Security and DPA](https://vercel.com/security)
- [Neon Security Documentation](https://neon.tech/docs/security)
- [Web Crypto API -- MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Africa's Talking SMS API](https://africastalking.com/sms)
