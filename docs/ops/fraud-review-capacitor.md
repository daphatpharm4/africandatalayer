# Fraud Pipeline Review — Capacitor Integration

**Date:** 2026-04-15
**Reviewer:** Fraud Strategy Lead (ADL Subagent)
**Branch:** `feature/capacitor-base`
**Gate Status:** CONDITIONAL PASS

---

## Summary

The Capacitor integration does not weaken existing fraud detection, but introduces new attack vectors specific to native mobile distribution that need monitoring. Existing EXIF, GPS, and dedup pipelines are structurally compatible with native submissions.

---

## Existing Detection Compatibility

### 1. EXIF Analysis — COMPATIBLE (needs testing)

**Pipeline:** `lib/server/submissionFraud.ts`

The fraud pipeline uses `exifr` to extract EXIF from uploaded photos. Native camera photos (via `CapCamera.getPhoto()`) differ from browser captures:

| Signal | Browser `<input capture>` | Native `CapCamera.getPhoto()` |
|--------|--------------------------|-------------------------------|
| EXIF present | Yes (most mobile browsers) | Yes (native camera) |
| GPS in EXIF | Depends on browser/permissions | Depends on camera settings |
| Timestamp | Camera timestamp | Camera timestamp |
| Camera model | Device model | Device model |
| Orientation | Raw (may need correction) | Corrected (`correctOrientation: true`) |
| Image format | JPEG typically | JPEG (quality: 85 configured) |

**Risk:** `correctOrientation: true` strips the EXIF orientation tag and applies the rotation to pixels. Other EXIF fields (timestamp, GPS, camera model) should survive. The fraud pipeline should handle missing orientation gracefully.

**Action required:** Run 5 test submissions from native camera through the fraud pipeline. Verify EXIF fields are present and fraud rules trigger correctly.

### 2. GPS Validation — FULLY COMPATIBLE

**Pipeline:** `lib/server/gpsValidation.ts`, `lib/server/gpsAnomalyDetection.ts`

Both native (`CapGeolocation`) and web (`navigator.geolocation`) produce coordinates in the same `{latitude, longitude}` format. The server receives them identically via the submission payload.

GPS validation checks:
- Geofence enforcement (Bonamoussadi bounds) — works the same
- Velocity detection (distance/time between submissions) — works the same
- GPS vs EXIF GPS cross-reference — works if EXIF GPS is present

**Native advantage:** Capacitor Geolocation may provide higher accuracy GPS (native vs browser) which could improve validation, not weaken it.

### 3. Risk Scoring — FULLY COMPATIBLE

**Pipeline:** `lib/server/submissionRisk.ts`

Risk scoring inputs (submission metadata, user trust tier, GPS data, EXIF data, time patterns) are all platform-independent. The scoring engine doesn't check the submission source.

**Opportunity:** Adding a `platform` field to submissions (web/ios/android) could be a useful signal. Not required for pilot.

### 4. Dedup — FULLY COMPATIBLE

**Pipeline:** `lib/server/dedup.ts`

Dedup uses GPS proximity and category matching, not image hashing. Both native and browser submissions provide the same GPS + category data.

### 5. Trust Tiers — FULLY COMPATIBLE

**Pipeline:** `lib/server/userTrust.ts`

Trust tiers are user-level, not platform-level. A user submitting from native vs web earns the same trust. No changes needed.

---

## New Fraud Vectors from Native Distribution

### NV1: APK Repackaging — HIGH RISK

**Threat:** Attacker decompiles the APK, modifies GPS/camera behavior, and distributes a modified app.

**Detection signals:**
- Device fingerprint inconsistencies
- Unusual WebView user agent
- Submission patterns from non-Play-Store installs

**Mitigation:**
- Play Store distribution only (Play Protect checks)
- Future: SafetyNet/Play Integrity API attestation
- Monitor for unusual device profiles

### NV2: Android Emulator Farms — MEDIUM RISK

**Threat:** Automated submission farms using Android emulators with spoofed GPS.

**Detection signals:**
- Known emulator device models (e.g., "generic_x86", "sdk_gphone")
- No accelerometer/gyroscope data
- Identical device fingerprints across "different" agents
- Unrealistic submission velocity

**Mitigation:**
- `lib/client/deviceProfile.ts` captures device characteristics
- Add emulator detection heuristics (check for emulator-specific values)
- Monitor for submission clusters from identical device profiles

### NV3: GPS Spoofing Apps — HIGH RISK (pre-existing, amplified)

**Threat:** Mock location apps on Android (easier on native than browser). Pre-existing attack vector, but native app may make it slightly easier.

**Detection signals (existing):**
- GPS velocity anomalies (already detected)
- GPS vs IP geolocation mismatch
- GPS vs EXIF GPS mismatch

**Mitigation:**
- Existing pipeline handles this well
- Future: Check `android.provider.Settings.Secure.ALLOW_MOCK_LOCATION`
- Native Capacitor can potentially detect mock location providers

### NV4: Screenshot/Photo Injection — LOW RISK

**Threat:** Injecting photos into the native camera pipeline without actually taking them.

**Detection signals:**
- Missing or inconsistent EXIF
- Photo resolution doesn't match device camera specs
- Timestamp anomalies

**Mitigation:**
- Existing EXIF analysis catches most cases
- `CameraSource.Camera` (not `Photos`) restricts to live capture
- Native pipeline doesn't allow gallery selection

### NV5: Multi-Account via Device Reset — LOW RISK

**Threat:** Agent creates multiple accounts by resetting device/app data.

**Detection signals:**
- Same device fingerprint, different user accounts
- Overlapping submission GPS patterns across accounts
- Same EXIF camera signature across accounts

**Mitigation:**
- Device profile correlation (partially in `lib/client/deviceProfile.ts`)
- Future: Device ID persistence via Capacitor Preferences or Keychain

---

## Threshold Adjustments

No immediate threshold changes needed. Current `FRAUD_*` env var thresholds are platform-independent.

**Recommended monitoring additions:**
1. Track `platform` (web/ios/android) per submission for future segmented analysis
2. Alert if native submission fraud rate diverges >2x from web fraud rate
3. Monitor device profile diversity (low diversity = farm risk)

---

## Gate Decision

**FRAUD GATE: CONDITIONAL PASS**

Conditions for full pass:
1. Run 5 test submissions from native camera through full fraud pipeline — verify EXIF extraction works
2. Confirm `CameraSource.Camera` prevents gallery injection in native flow
3. Verify device profile capture works in native WebView context

No threshold changes or code changes required for pilot launch.
