# Security Audit — Capacitor Integration

**Date:** 2026-04-15
**Auditor:** Cybersecurity Lead (ADL Subagent)
**Branch:** `feature/capacitor-base`
**Gate Status:** CONDITIONAL PASS

---

## Executive Summary

The Capacitor integration introduces manageable security considerations. No critical vulnerabilities found. Two medium-severity items require monitoring. The CORS wildcard is acceptable given session-based auth, but should be tightened when native origins are known.

---

## Findings

### MEDIUM — M1: CORS Wildcard with Credentials

**File:** `vercel.json:30-31`
**Risk:** Medium likelihood, Medium impact

`Access-Control-Allow-Origin: *` combined with `Access-Control-Allow-Credentials: true` is technically invalid per the CORS spec — browsers will NOT send credentials when the origin is `*`. This means the wildcard currently works because:
1. Native WebViews don't enforce CORS the same way browsers do
2. The `credentials: 'include'` in `apiFetch()` works in same-origin web context

**Impact:** Low — browsers correctly reject credentialed requests to wildcard origins, so there's no browser-based CSRF amplification. Native WebViews bypass CORS enforcement entirely.

**Remediation:** For correctness, consider reflecting the request `Origin` header instead of using `*`. Not blocking for pilot.

**Verification:** Test that `credentials: 'include'` works correctly from both native WebView and browser.

---

### MEDIUM — M2: Hardcoded API URL in Native Context

**File:** `lib/client/native.ts:13`
**Risk:** Low likelihood, Medium impact

```typescript
return 'https://africandatalayer.vercel.app';
```

If an attacker repackages the APK and modifies this URL, all API calls (including auth) route through the attacker's server.

**Mitigating factors:**
- App Store / Play Store distribution provides integrity verification
- Session cookies are domain-scoped to `africandatalayer.vercel.app`
- HTTPS prevents MITM on the legitimate URL

**Remediation:** For production, consider certificate pinning via Capacitor HTTP plugin. Not blocking for pilot with store-only distribution.

---

### LOW — L1: Offline Queue PII at Rest

**File:** `lib/client/offlineQueue.ts:1-10`
**Risk:** Medium likelihood (device theft), Low impact (limited PII)

IndexedDB stores submission payloads including:
- GPS coordinates
- Photo data (base64 or blob URL)
- Category and field values
- Timestamps

**Mitigating factors:**
- 72h TTL auto-purges old items (`MAX_QUEUE_ITEM_AGE_MS`)
- Max 75 items in queue
- Photos are of infrastructure (pharmacies, etc.), not people
- `lib/client/remoteWipe.ts` provides remote wipe capability

**Remediation:** Verify remote wipe is functional end-to-end. Consider IndexedDB encryption for high-risk deployments. Not blocking for pilot.

---

### LOW — L2: Camera EXIF Data Flow

**Files:** `ContributionFlow.tsx:878-893`, server-side `lib/server/submissionFraud.ts`
**Risk:** Low likelihood, Low impact

Capacitor's `CapCamera.getPhoto()` with `correctOrientation: true` may strip or modify EXIF orientation data. The fraud detection pipeline relies on EXIF for:
- Timestamp verification
- GPS cross-checking
- Camera model identification

**Mitigating factors:**
- Server-side EXIF extraction (via `exifr`) processes whatever metadata arrives
- Missing EXIF is itself a fraud signal (the pipeline handles this)
- GPS is independently captured via Capacitor Geolocation plugin

**Remediation:** Test that native camera photos retain sufficient EXIF metadata for fraud detection. Coordinate with Fraud Lead.

---

### LOW — L3: Google OAuth in Native WebView

**File:** `lib/server/auth/handler.ts`, `lib/client/auth.ts`
**Risk:** Low likelihood, Medium impact

Google OAuth redirect flow may behave differently in Capacitor WebView:
- Redirect URI must match Google Cloud Console configuration
- Native WebView may not support popup-based OAuth
- Session cookie domain scoping in WebView context

**Mitigating factors:**
- Credentials-based auth (email/password) works independently of OAuth
- OAuth is secondary auth method for ADL
- Capacitor WebView uses `https://` scheme (configured via `androidScheme: 'https'`)

**Remediation:** Test Google OAuth flow end-to-end in both iOS and Android WebView. If it fails, add native OAuth plugin support. Not blocking for pilot (credentials auth is primary).

---

### INFORMATIONAL — I1: CSP in Native WebView

**File:** `vercel.json:22-23`

CSP headers are served by Vercel and enforced by the browser/WebView. Native WebViews generally respect CSP but behavior varies by OS version and WebView implementation.

**Note:** `minWebViewVersion: 90` in `capacitor.config.ts` ensures a reasonably modern WebView with CSP support on Android.

---

### INFORMATIONAL — I2: Rate Limiting Origin Uniformity

**File:** `lib/server/rateLimit.ts:14-22`

Rate limiting keys on IP address (`x-vercel-forwarded-for`). Native app users behind the same carrier NAT may share IP addresses, potentially causing legitimate users to hit rate limits.

**Note:** Monitor rate limit events from mobile carriers in Cameroon. Adjust window/max values if false positives emerge.

---

### INFORMATIONAL — I3: Push Notifications Token Security

`@capacitor/push-notifications` is installed but not yet implemented. When implemented:
- Store push tokens server-side with user association
- Validate tokens are not reused across accounts
- Implement token refresh on re-authentication

---

## Dependency Audit

| Package | Version | Known CVEs | Status |
|---------|---------|-----------|--------|
| @capacitor/core | ^8.3.0 | None known | OK |
| @capacitor/app | ^8.1.0 | None known | OK |
| @capacitor/camera | ^8.1.0 | None known | OK |
| @capacitor/geolocation | ^8.2.0 | None known | OK |
| @capacitor/network | ^8.0.1 | None known | OK |
| @capacitor/push-notifications | ^8.0.3 | None known | OK |
| @capacitor/splash-screen | ^8.0.1 | None known | OK |
| @capacitor/status-bar | ^8.0.2 | None known | OK |
| @capacitor/cli | ^8.3.0 | None known | OK (dev only) |

---

## Compliance Notes

### Cameroon Data Protection

- GPS coordinates collected with user consent (geolocation permission prompt)
- Photos of public infrastructure (not personal data subjects)
- Privacy policy must disclose: GPS collection, photo metadata extraction, offline data caching
- Privacy policy URL required before App Store / Play Store submission

### Data Minimization

- Offline queue purges after 72h — acceptable
- Photo data transmitted and stored server-side — acceptable for verification purpose
- EXIF metadata used server-side only, never returned to client — correct

---

## Gate Decision

**SECURITY GATE: CONDITIONAL PASS**

Conditions for full pass:
1. Test Google OAuth flow in native WebView (L3)
2. Verify native camera EXIF retention for fraud pipeline (L2)
3. Test remote wipe functionality end-to-end (L1)

None are blocking for development. All must be verified before App Store / Play Store submission.
