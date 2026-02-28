# ADL Fraud Detection & Prevention Strategy

**Author:** Teammate 5 -- Fraud Specialist
**Date:** 2026-02-28
**Status:** Living document -- updates with each fraud landscape change
**Predecessors:**
- [01-cloud-architecture.md](./01-cloud-architecture.md) (Cloud Architect)
- [02-system-design.md](./02-system-design.md) (System Design Expert)
- [03-cloud-engineering.md](./03-cloud-engineering.md) (Cloud Engineer)
- [04-cybersecurity.md](./04-cybersecurity.md) (Cybersecurity Expert)
**Scope:** Fraud scenario modeling, detection rules, risk scoring, response playbooks, false positive mitigation, and monitoring for African Data Layer

---

## Table of Contents

1. [Fraud Scenario Catalog](#1-fraud-scenario-catalog)
2. [Detection Rules & Signals](#2-detection-rules--signals)
3. [Risk Scoring Model](#3-risk-scoring-model)
4. [Response Playbooks](#4-response-playbooks)
5. [False Positive Minimization](#5-false-positive-minimization)
6. [Fraud Metrics & Monitoring](#6-fraud-metrics--monitoring)

---

## 1. Fraud Scenario Catalog

### 1.1 Data Fabrication

#### F-FAB-01: Fabricated POI (Phantom Location)

| Field | Detail |
|---|---|
| **Description** | Contributor submits a POI (pharmacy, fuel station, mobile money kiosk) that does not physically exist. They fill in plausible details (name, hours, provider list) but the business is fictional. |
| **Attacker Motivation** | Earn XP (5 points per CREATE_EVENT via `BASE_EVENT_XP` in `api/submissions/index.ts:59`) and climb the leaderboard without doing fieldwork. |
| **Attack Method** | Take a photo of a random storefront or blank wall. Submit with a valid GPS location inside the Bonamoussadi geofence (`shared/geofence.ts` bounds: 4.0755-4.0999 lat, 9.7185-9.76 lng). Fill required fields: name + isOpenNow (pharmacy), providers (mobile_money), name + hasFuelAvailable (fuel_station) per `CREATE_REQUIRED_FIELDS` in `pointProjection.ts:19-23`. |
| **Detection Difficulty** | High. The current system only validates that required fields are present and location is within bounds. There is no ground-truth cross-reference or duplicate detection. |
| **Business Impact** | Critical. Phantom POIs corrupt the dataset. Downstream consumers (fintech apps, logistics platforms, health services) route users to nonexistent locations, destroying platform credibility. |

#### F-FAB-02: Recycled / Copied Photos

| Field | Detail |
|---|---|
| **Description** | Contributor reuses the same photo across multiple submissions, or downloads photos from the internet (Google Maps Street View, social media). |
| **Attacker Motivation** | Avoid fieldwork while farming XP. A single field trip yields photos reused across dozens of fabricated submissions. |
| **Attack Method** | Take one photo on-site, then submit it as evidence for multiple different POIs by changing the location coordinates slightly. Alternatively, download storefront images from Google Maps. |
| **Detection Difficulty** | Medium. The current system extracts EXIF metadata (`submissionFraud.ts:95-127`) including GPS, capture timestamp, device make/model. Photos reused across submissions would share identical EXIF data. However, stripped EXIF (common in screenshots/downloads) bypasses this entirely. |
| **Business Impact** | High. Multiple fake POIs backed by "evidence" that appears legitimate at casual inspection. |

#### F-FAB-03: AI-Generated / Synthetic Data

| Field | Detail |
|---|---|
| **Description** | Contributor uses AI image generation to create realistic storefront photos, or uses LLMs to generate plausible business details. |
| **Attacker Motivation** | Scale fabrication without any physical presence. |
| **Attack Method** | Generate pharmacy/kiosk storefront images using diffusion models. These images have no EXIF data (GPS, device info all null). Submit with fabricated coordinates within the geofence. |
| **Detection Difficulty** | High. AI-generated images lack EXIF metadata, but so do many legitimate photos from feature phones. The current `extractPhotoMetadata` function returns all nulls for such images -- identical to a legitimate low-end device submission. |
| **Business Impact** | Critical. At scale, this could flood the dataset with convincing but entirely fictional POIs. |

### 1.2 XP Gaming

#### F-XP-01: Rapid-Fire Submissions

| Field | Detail |
|---|---|
| **Description** | Contributor submits dozens of submissions in rapid succession to accumulate XP quickly. |
| **Attacker Motivation** | Climb leaderboard (`api/leaderboard/index.ts` ranks by XP then contribution count). Top positions may unlock real rewards via the rewards catalog. |
| **Attack Method** | Use the offline queue (`lib/client/offlineQueue.ts`) to batch-prepare submissions while "offline," then flush all at once via `flushOfflineQueue`. The queue has no rate limiting -- it simply iterates all pending items sequentially. Server-side, XP is awarded immediately on insertion: `profile.XP = (profile.XP ?? 0) + BASE_EVENT_XP` (`api/submissions/index.ts:679`). |
| **Detection Difficulty** | Low. Temporal clustering is easily detectable -- many submissions from the same userId within a short window. |
| **Business Impact** | Medium. Leaderboard pollution discourages legitimate contributors. XP inflation devalues the reward economy. |

#### F-XP-02: Self-Enrichment Loop

| Field | Detail |
|---|---|
| **Description** | Contributor creates a POI (CREATE_EVENT, +5 XP), then enriches the same POI repeatedly (ENRICH_EVENT, +5 XP each) by filling in each gap field individually across separate submissions. |
| **Attacker Motivation** | Multiply XP from a single physical location. A pharmacy has 3 enrichable fields (openingHours, isOpenNow, isOnDuty per `ENRICHABLE_FIELDS`); a fuel station has 6 fields. One visit could yield 7 submissions = 35 XP. |
| **Attack Method** | Submit CREATE_EVENT with minimal required fields. Then submit separate ENRICH_EVENTs for each gap. The system validates that each enrichment fills "at least one currently missing field" (`api/submissions/index.ts:558`) but does not penalize drip-feeding. |
| **Detection Difficulty** | Low. Pattern is visible: same userId, same pointId, multiple ENRICH_EVENTs in a short period. |
| **Business Impact** | Medium. Inflates contribution counts and XP. May or may not produce bad data (the enrichment data itself could be legitimate). |

#### F-XP-03: Collusion Rings

| Field | Detail |
|---|---|
| **Description** | A group of contributors coordinate to validate each other's fake submissions, or systematically enrich each other's POIs with fabricated data. |
| **Attacker Motivation** | Collectively inflate XP to dominate leaderboard and claim rewards. |
| **Attack Method** | User A creates a POI. User B enriches it. User C enriches it further. Reverse roles for the next POI. Submissions are timed to avoid velocity flags. |
| **Detection Difficulty** | High. Individual submission patterns look normal. Detection requires graph analysis of user-to-user and user-to-point relationships. |
| **Business Impact** | High. Coordinated fraud at scale corrupts both data quality and the incentive structure. |

#### F-XP-04: Alt Account Farming

| Field | Detail |
|---|---|
| **Description** | Single person registers multiple accounts and submits from all of them. |
| **Attacker Motivation** | Multiply XP earnings, dominate multiple leaderboard slots, or circumvent per-account limits (if implemented). |
| **Attack Method** | Register with different email addresses. The current auth system (`lib/auth.ts` -> Supabase auth) has no device-binding or phone verification. The `deviceId` from `lib/client/deviceProfile.ts` is stored in localStorage (`adl_device_id` key) and sent as `clientDevice.deviceId` in submissions, but is not validated server-side for uniqueness across accounts. |
| **Detection Difficulty** | Medium. Same deviceId appearing across multiple userIds is a strong signal. Same IP, same device fingerprint (memory, CPU cores, user agent) across accounts also signals alt farming. |
| **Business Impact** | High. Undermines the one-person-one-account assumption. Corrupts leaderboard integrity. |

### 1.3 Location Spoofing

#### F-LOC-01: GPS Spoofing App

| Field | Detail |
|---|---|
| **Description** | Contributor uses a GPS spoofing app (Fake GPS, Mock Locations on Android) to submit from a fabricated location without being physically present. |
| **Attacker Motivation** | Submit POIs in areas they have never visited. Claim to have surveyed distant neighborhoods. |
| **Attack Method** | Enable mock locations on Android. Set GPS to coordinates within Bonamoussadi bounds. Submit a photo (possibly taken elsewhere). The `navigator.geolocation` API returns the spoofed coordinates. The current system compares submission GPS to photo EXIF GPS (`submissionFraud.ts:157-172`), but if the photo lacks EXIF GPS (common on feature phones), this check produces null. |
| **Detection Difficulty** | Medium. Cross-referencing with IP geolocation helps -- the current system fetches IP location via `ipapi.co` (`api/submissions/index.ts:223-240`). A 50km IP-to-photo threshold (`IP_PHOTO_MATCH_KM = 50`) catches coarse mismatches. However, a VPN user in the same city defeats this. |
| **Business Impact** | High. Allows remote fabrication of an entire neighborhood's data without physical presence. |

#### F-LOC-02: VPN / Proxy IP Masking

| Field | Detail |
|---|---|
| **Description** | Contributor uses a VPN with an exit node in Cameroon to mask their real IP location. |
| **Attacker Motivation** | Submit from a different country while appearing to be in Douala. |
| **Attack Method** | Connect to a Cameroon-based VPN server. The `x-vercel-forwarded-for` or `x-forwarded-for` header now shows a Cameroonian IP. The `fetchIpLocation` function resolves it to a Douala-area coordinate, passing the 50km IP match threshold. |
| **Detection Difficulty** | Medium. VPN exit IPs are often in known ranges (data center ASNs). The current system does not check ASN type. |
| **Business Impact** | Medium. Enables remote fraud but requires combining with other techniques (photo fraud, GPS spoofing) to create a complete fake submission. |

#### F-LOC-03: EXIF Stripping / Manipulation

| Field | Detail |
|---|---|
| **Description** | Contributor strips or modifies EXIF metadata from photos before submission. |
| **Attacker Motivation** | Remove evidence of the photo being taken elsewhere, or inject false GPS coordinates into EXIF. |
| **Attack Method** | Use exiftool or similar to strip all metadata (GPS, timestamp, device info all become null). Or inject Bonamoussadi GPS coordinates into a photo taken in another city. The current `extractPhotoMetadata` (`submissionFraud.ts:95-127`) trusts EXIF data at face value -- there is no tampering detection. |
| **Detection Difficulty** | Hard (stripping), Medium (injection -- injected EXIF often has telltale inconsistencies like impossible capture dates or mismatched software tags). |
| **Business Impact** | High. Defeats the primary photo-location cross-validation mechanism. |

### 1.4 Photo Fraud

#### F-PHO-01: Stock Photos / Internet Images

| Field | Detail |
|---|---|
| **Description** | Contributor submits stock photos or images downloaded from the internet as evidence of a POI visit. |
| **Attacker Motivation** | Create fake submissions without visiting any location. |
| **Attack Method** | Download a pharmacy storefront image from Google Images. Convert to base64, submit as `imageBase64`. The image will have no EXIF data (stripped by web platforms). The current system uploads to Vercel Blob via `put()` (`api/submissions/index.ts:186-193`) without content analysis. |
| **Detection Difficulty** | Medium with tooling (reverse image search, perceptual hashing), High without. Currently there is zero image content analysis. |
| **Business Impact** | Critical. Completely fabricated evidence backing fabricated POIs. |

#### F-PHO-02: Screenshot Submissions

| Field | Detail |
|---|---|
| **Description** | Contributor takes a screenshot of Google Maps, another mapping app, or a previous ADL submission and submits it as their photo evidence. |
| **Attacker Motivation** | "Prove" they visited a location using someone else's data. |
| **Attack Method** | Screenshot a Google Maps storefront photo. The screenshot has the device's EXIF (capture time = now, GPS = current location if enabled) but shows a different location's content. The current system checks GPS match but not image content. |
| **Detection Difficulty** | Medium. Screenshots have distinctive characteristics: exact screen resolution dimensions, UI overlays, navigation bars. Image dimension analysis could flag these. |
| **Business Impact** | High. Creates plausible-looking but derivative evidence. |

#### F-PHO-03: Same Photo Across Multiple Submissions

| Field | Detail |
|---|---|
| **Description** | Contributor uses the exact same photo file for multiple different POI submissions. |
| **Attacker Motivation** | Minimize effort while maximizing XP from fabricated POIs. |
| **Attack Method** | Submit identical base64 image data for multiple CREATE_EVENTs at different coordinates. The current system uploads each to Vercel Blob with a unique path (`submissions/${eventId}-${Date.now()}.${ext}`) but never compares image content across submissions. |
| **Detection Difficulty** | Low (exact match via hash), Medium (near-duplicate with minor edits). Currently not implemented. |
| **Business Impact** | High. Clear indicator of fabrication -- a unique storefront photo should correspond to a unique physical location. |

### 1.5 Account Abuse

#### F-ACC-01: Multi-Account Farming

| Field | Detail |
|---|---|
| **Description** | Same person operates multiple accounts, distributing submissions across them to avoid per-account velocity detection. |
| **Attacker Motivation** | Evade rate limits, dominate leaderboard with multiple entries, hedge against account bans. |
| **Attack Method** | Register N accounts with different emails. Alternate submissions across accounts. The `deviceId` in `lib/client/deviceProfile.ts:94-116` is stored per-browser in localStorage -- clearing storage or using incognito generates a new ID. |
| **Detection Difficulty** | Medium. Device fingerprint correlation (same `deviceMemoryGb`, `hardwareConcurrency`, `platform`, `userAgent` pattern) across accounts is a signal. Same IP submissions across different userIds is another. |
| **Business Impact** | High. Multiplies fraud capacity per attacker. |

#### F-ACC-02: Automated Bot Submissions

| Field | Detail |
|---|---|
| **Description** | Attacker scripts the submission API directly, bypassing the web UI entirely. |
| **Attacker Motivation** | Submit at massive scale. Hundreds of fabricated POIs per hour. |
| **Attack Method** | Obtain auth token (the current system uses Supabase auth). Script POST requests to `/api/submissions/` with fabricated payloads. The `imageBase64` field accepts any valid base64-encoded image. No CAPTCHA, no proof-of-work, no browser fingerprint verification on the server side. The offline queue's `idempotencyKey` is client-generated (`crypto.randomUUID()`) and not validated server-side for format. |
| **Detection Difficulty** | Low to Medium. Bots often have: no `clientDevice` data, consistent user agent strings, impossibly fast submission rates, programmatic patterns in field values. |
| **Business Impact** | Critical. Can flood the database with thousands of fake POIs in minutes. |

#### F-ACC-03: Credential Sharing

| Field | Detail |
|---|---|
| **Description** | Multiple people share a single account to accumulate XP faster or to let unskilled users submit on behalf of a "leader." |
| **Attacker Motivation** | Pool effort into a single leaderboard position for maximum reward. |
| **Attack Method** | Share login credentials. Multiple devices submit under one userId. Different `deviceId` values, different IP addresses, different device fingerprints -- all for one account. |
| **Detection Difficulty** | Medium. Multiple distinct device profiles for one userId, geographically dispersed simultaneous submissions. |
| **Business Impact** | Medium. Data quality may be acceptable if all sharers are legitimate field agents, but it violates platform terms and inflates individual rankings. |

### 1.6 Data Poisoning

#### F-POI-01: Intentionally Wrong Data

| Field | Detail |
|---|---|
| **Description** | Contributor submits real POIs but with deliberately incorrect details: wrong prices, wrong hours, wrong availability status. |
| **Attacker Motivation** | Vandalism, competitor sabotage (marking a competitor's station as "no fuel available"), or simply carelessness incentivized by XP-per-submission rather than XP-per-accuracy. |
| **Attack Method** | Visit a real fuel station. Submit a legitimate photo. But report `hasFuelAvailable: false` when fuel is available, or set `pricesByFuel.super` to a wildly incorrect value. The current system validates field presence (`listCreateMissingFields`) but not field plausibility. |
| **Detection Difficulty** | Very High for subtle errors (off-by-10% price), Medium for extreme values (fuel price of 1 XAF or 100,000 XAF). |
| **Business Impact** | Critical. Correct-looking submissions with wrong data are the hardest fraud type to detect and the most damaging to data consumers. |

#### F-POI-02: Competitor Sabotage

| Field | Detail |
|---|---|
| **Description** | A competitor registers as a contributor and systematically marks rival businesses as closed, out of stock, or unavailable. |
| **Attacker Motivation** | Redirect customers away from competitors. |
| **Attack Method** | Enrich rival POIs with `isOpenNow: false`, `hasFuelAvailable: false`, `hasMin50000XafAvailable: false`. Provide a legitimate-looking photo of the closed sign or simply a storefront image. |
| **Detection Difficulty** | High. Requires detecting that a specific user disproportionately submits negative availability data for a subset of POIs. |
| **Business Impact** | Critical. Directly harms businesses and platform trust. |

---

## 2. Detection Rules & Signals

### 2.1 Current Implementation Analysis

The current fraud detection system in `lib/server/submissionFraud.ts` provides:

**What it catches today:**

1. **Photo-to-submission GPS mismatch**: Compares EXIF GPS coordinates from the photo against the submission's declared GPS location. Threshold: 1km (`DEFAULT_SUBMISSION_GPS_MATCH_THRESHOLD_KM`). If the photo was taken >1km from the declared location, the submission is rejected with HTTP 400 (`api/submissions/index.ts:504`).

2. **Photo-to-IP GPS mismatch**: Compares EXIF GPS against IP-geolocated coordinates. Threshold: 50km (`IP_PHOTO_MATCH_KM`). Rejects if the photo location does not match IP location.

3. **Metadata preservation**: Extracts and stores device make, model, capture timestamp, GPS coordinates from EXIF. This is stored in `details.fraudCheck` on each event for later forensic review.

4. **Geofence enforcement**: Non-admin submissions must fall within Bonamoussadi bounds (`shared/geofence.ts`). Rejects submissions outside the bounding box.

5. **Admin forensics dashboard**: The `view=admin_events` endpoint (`api/submissions/index.ts:418-424`) builds `AdminSubmissionEvent` objects that include fraud check data, user profiles, and photo metadata for manual review.

**What it misses:**

| Gap | Severity | Description |
|---|---|---|
| No velocity / rate limiting | Critical | A user can submit 100 events per minute. No per-user, per-device, or per-IP rate limiting exists. |
| No photo deduplication | Critical | Same image can be submitted for multiple POIs. No perceptual hash or exact hash comparison. |
| No user trust scoring | High | All users are treated equally regardless of history. A new account and a 6-month veteran get identical treatment. |
| No temporal analysis | High | No check for impossible travel (submissions 50km apart within 5 minutes). |
| No duplicate POI detection | High | Two CREATE_EVENTs at the same GPS coordinates for the same category are both accepted. |
| No EXIF-absent penalty | Medium | Photos without EXIF metadata (stripped, screenshots, AI-generated) receive the same treatment as photos with full metadata. The `submissionGpsMatch` is simply `null`. |
| No device fingerprint cross-referencing | Medium | The `clientDevice.deviceId` is stored but never queried across submissions or users. |
| No image content analysis | Medium | No screenshot detection, no reverse image search, no AI-generated image detection. |
| No enrichment pattern analysis | Medium | Self-enrichment loops (same user, same point, multiple enrichments) are unchecked. |
| No IP reputation checking | Medium | No ASN/datacenter detection for VPN/proxy identification. |
| No field plausibility validation | High | Fuel price of 0 XAF or 1,000,000 XAF passes validation. |
| No cross-user graph analysis | High | Collusion rings are invisible. |
| XP awarded before validation | Critical | XP is added to profile immediately on submission (`api/submissions/index.ts:678-681`). There is no pending/review state. |

### 2.2 Detection Rules by Scenario

#### Rule R-VEL-01: Submission Velocity (addresses F-XP-01, F-ACC-02)

**Signals:**
- Count of submissions per userId in the last N minutes
- Count of submissions per deviceId in the last N minutes
- Count of submissions per IP address in the last N minutes

**Detection Logic:**

```sql
-- Per-user velocity check (run before accepting submission)
SELECT COUNT(*) AS recent_count
FROM point_events
WHERE user_id = :userId
  AND created_at > NOW() - INTERVAL '15 minutes';

-- Flag if > 5 submissions in 15 min
-- Auto-block if > 15 submissions in 15 min
```

```typescript
// Server-side rate limiter (add to api/submissions/index.ts POST handler)
const VELOCITY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const VELOCITY_FLAG_THRESHOLD = 5;
const VELOCITY_BLOCK_THRESHOLD = 15;

async function checkVelocity(userId: string): Promise<'ok' | 'flag' | 'block'> {
  const recentEvents = await getRecentEventsByUser(userId, VELOCITY_WINDOW_MS);
  if (recentEvents.length >= VELOCITY_BLOCK_THRESHOLD) return 'block';
  if (recentEvents.length >= VELOCITY_FLAG_THRESHOLD) return 'flag';
  return 'ok';
}
```

**Thresholds:**
- 5 submissions / 15 min -> flag for review, allow submission
- 15 submissions / 15 min -> auto-block, return HTTP 429
- 50 submissions / hour -> auto-suspend account

**Confidence:** 90% for bot detection at block threshold. 60% at flag threshold (legitimate field agents doing a sweep could hit 5/15min).

#### Rule R-DUP-01: Photo Deduplication (addresses F-PHO-03, F-FAB-02)

**Signals:**
- SHA-256 hash of the uploaded image buffer
- Perceptual hash (pHash) of the image for near-duplicate detection

**Detection Logic:**

```typescript
import { createHash } from 'crypto';

function computeImageHash(imageBuffer: Buffer): string {
  return createHash('sha256').update(imageBuffer).digest('hex');
}

// At submission time:
const imageHash = computeImageHash(parsedPhoto.imageBuffer);
const existingWithSameHash = await findSubmissionsByImageHash(imageHash);

if (existingWithSameHash.length > 0) {
  // Exact duplicate photo
  const isSamePoint = existingWithSameHash.some(e => e.pointId === pointId);
  if (!isSamePoint) {
    // Same photo used for DIFFERENT points = strong fraud signal
    return errorResponse("This photo has already been used for another submission", 400);
  }
}
```

**Thresholds:**
- Exact hash match for different pointId -> auto-reject
- Exact hash match for same pointId (re-enrichment) -> allow with flag
- Perceptual hash similarity >95% for different pointId -> flag for review

**Confidence:** 99% for exact duplicates. 80% for perceptual near-duplicates.

#### Rule R-GEO-01: Impossible Travel (addresses F-LOC-01, F-ACC-03)

**Signals:**
- Sequential submissions from the same userId with GPS coordinates and timestamps
- Calculated speed between consecutive submissions

**Detection Logic:**

```typescript
async function checkImpossibleTravel(
  userId: string,
  currentLocation: SubmissionLocation,
  currentTime: Date
): Promise<'ok' | 'flag' | 'block'> {
  const lastSubmission = await getLastSubmissionByUser(userId);
  if (!lastSubmission) return 'ok';

  const distanceKm = haversineKm(lastSubmission.location, currentLocation);
  const timeHours = (currentTime.getTime() - new Date(lastSubmission.createdAt).getTime()) / 3600000;

  if (timeHours <= 0) return 'block'; // Same timestamp, different location

  const speedKmh = distanceKm / timeHours;

  // In Douala: walking ~5km/h, moto-taxi ~30km/h, car ~60km/h
  // Max reasonable: 80km/h in urban Cameroon
  if (speedKmh > 200) return 'block';  // Physically impossible
  if (speedKmh > 80) return 'flag';     // Suspicious
  return 'ok';
}
```

**Thresholds:**
- Speed > 80 km/h between consecutive submissions -> flag
- Speed > 200 km/h -> auto-block (physically impossible in Douala traffic)
- Two submissions > 5km apart within 2 minutes -> auto-block

**Confidence:** 95% at block threshold (200 km/h is not achievable on Douala roads). 70% at flag threshold (a moto-taxi on the highway could plausibly reach 80 km/h).

#### Rule R-EXIF-01: Missing EXIF Metadata Penalty (addresses F-FAB-03, F-LOC-03, F-PHO-01)

**Signals:**
- Whether `extractPhotoMetadata` returns null for GPS, capturedAt, deviceMake, deviceModel
- `clientDevice.isLowEnd` from device profile (mitigates false positives for feature phones)

**Detection Logic:**

```typescript
function computeExifTrustScore(
  extracted: ExtractedPhotoMetadata,
  clientDevice: ClientDeviceInfo | null
): number {
  let score = 100;

  if (!extracted.gps) score -= 30;
  if (!extracted.capturedAt) score -= 20;
  if (!extracted.deviceMake) score -= 15;
  if (!extracted.deviceModel) score -= 15;

  // Mitigate for known low-end devices that legitimately strip EXIF
  if (clientDevice?.isLowEnd && score < 50) {
    score = Math.min(score + 20, 50); // Partial recovery, but still flagged
  }

  return Math.max(0, score);
}
```

**Thresholds:**
- EXIF trust score >= 70 -> no action
- EXIF trust score 40-69 -> flag, increase review priority
- EXIF trust score < 40 -> flag + require secondary verification (second photo, manual review)

**Confidence:** 50%. Many legitimate African-market phones produce images with minimal EXIF. This signal must always be combined with others.

#### Rule R-PROX-01: Duplicate POI Detection (addresses F-FAB-01)

**Signals:**
- Haversine distance between new submission and existing points of the same category
- Name similarity (Levenshtein distance or fuzzy match)

**Detection Logic:**

```typescript
async function checkDuplicatePoi(
  category: SubmissionCategory,
  location: SubmissionLocation,
  name: string,
  existingPoints: ProjectedPoint[]
): Promise<'ok' | 'flag' | 'block'> {
  const sameCategory = existingPoints.filter(p => p.category === category);

  for (const point of sameCategory) {
    const distanceKm = haversineKm(location, point.location);

    // Two pharmacies within 20 meters is almost certainly a duplicate
    if (distanceKm < 0.02) return 'block';

    // Within 50 meters with similar name -> flag
    if (distanceKm < 0.05) {
      const existingName = point.details?.name ?? '';
      if (fuzzyNameMatch(name, existingName) > 0.7) return 'block';
      return 'flag';
    }

    // Within 100 meters -> flag
    if (distanceKm < 0.1) return 'flag';
  }

  return 'ok';
}
```

**Thresholds:**
- Same category within 20m -> auto-reject (suggest enrichment instead)
- Same category within 50m with similar name -> auto-reject
- Same category within 100m -> flag for review
- Same category within 200m -> add to submission risk score

**Confidence:** 85% at 20m/same-category. 70% at 50m. In dense urban Douala, multiple mobile money kiosks within 100m is legitimate, so the 100m threshold is a flag, not a block.

#### Rule R-DEV-01: Device Fingerprint Cross-Reference (addresses F-ACC-01, F-XP-04)

**Signals:**
- `clientDevice.deviceId` from `lib/client/deviceProfile.ts`
- `clientDevice.userAgent`, `deviceMemoryGb`, `hardwareConcurrency`, `platform`
- EXIF `deviceMake`, `deviceModel` from photo metadata

**Detection Logic:**

```typescript
async function checkDeviceCrossReference(
  userId: string,
  deviceId: string,
  deviceFingerprint: string // hash of userAgent + memory + cpu + platform
): Promise<'ok' | 'flag'> {
  // Check if this deviceId has been used by other userIds
  const userIdsForDevice = await getUserIdsByDeviceId(deviceId);
  const otherUsers = userIdsForDevice.filter(id => id !== userId);

  if (otherUsers.length > 0) return 'flag'; // Multiple accounts on same device

  // Check if this device fingerprint matches other accounts
  const userIdsForFingerprint = await getUserIdsByFingerprint(deviceFingerprint);
  const fpOtherUsers = userIdsForFingerprint.filter(id => id !== userId);

  if (fpOtherUsers.length >= 2) return 'flag'; // 3+ accounts with same fingerprint

  return 'ok';
}
```

**Thresholds:**
- Same deviceId used by 2+ userIds -> flag both accounts
- Same deviceId used by 3+ userIds -> auto-suspend newest accounts
- Same device fingerprint across 3+ userIds -> flag for alt-account investigation

**Confidence:** 75%. Shared devices are common in Africa (family members, cybercafe computers). The flag-not-block approach is intentional.

#### Rule R-ENR-01: Self-Enrichment Pattern (addresses F-XP-02)

**Signals:**
- Count of ENRICH_EVENTs by the same userId on the same pointId
- Time gap between CREATE_EVENT and ENRICH_EVENTs
- Whether the creating user is also the enriching user

**Detection Logic:**

```typescript
async function checkSelfEnrichment(
  userId: string,
  pointId: string,
  existingEvents: PointEvent[]
): Promise<{ score: number; isSelfEnrich: boolean }> {
  const pointEvents = existingEvents.filter(e => e.pointId === pointId);
  const createEvent = pointEvents.find(e => e.eventType === 'CREATE_EVENT');
  const userEnrichments = pointEvents.filter(
    e => e.eventType === 'ENRICH_EVENT' && e.userId.toLowerCase() === userId.toLowerCase()
  );

  const isSelfEnrich = createEvent?.userId.toLowerCase() === userId.toLowerCase();
  let score = 0;

  if (isSelfEnrich && userEnrichments.length >= 2) score += 30;
  if (userEnrichments.length >= 3) score += 40;

  // Check temporal clustering
  if (createEvent && userEnrichments.length > 0) {
    const createTime = new Date(createEvent.createdAt).getTime();
    const enrichTimes = userEnrichments.map(e => new Date(e.createdAt).getTime());
    const minGap = Math.min(...enrichTimes.map(t => Math.abs(t - createTime)));

    if (minGap < 60000) score += 20; // Enriching within 1 minute of creation
  }

  return { score, isSelfEnrich };
}
```

**Thresholds:**
- Self-enrichment score >= 50 -> flag, cap XP for additional enrichments
- Self-enrichment score >= 70 -> flag + require different user to enrich
- Single user making 3+ enrichments on same point -> block further enrichments from this user on this point

**Confidence:** 80%. Self-enrichment may be legitimate (revisiting a location), but the pattern is suspicious at scale.

#### Rule R-VAL-01: Field Plausibility (addresses F-POI-01, F-POI-02)

**Signals:**
- Fuel prices vs. known market range
- Opening hours format validity
- Provider names against known provider list

**Detection Logic:**

```typescript
const CAMEROON_FUEL_PRICE_RANGE_XAF = {
  super: { min: 500, max: 1000 },    // ~630 XAF/L in 2026
  gasoil: { min: 450, max: 900 },
  kerosene: { min: 400, max: 800 },
};

const KNOWN_MOBILE_MONEY_PROVIDERS = [
  'MTN Mobile Money', 'Orange Money', 'Express Union Mobile',
  'YUP', 'Afriland First Bank', 'UBA'
];

function validateFuelPrice(fuelType: string, priceXaf: number): 'ok' | 'flag' | 'block' {
  const range = CAMEROON_FUEL_PRICE_RANGE_XAF[fuelType];
  if (!range) return 'ok';

  if (priceXaf <= 0 || priceXaf > 10000) return 'block';  // Impossible
  if (priceXaf < range.min * 0.5 || priceXaf > range.max * 2) return 'flag';  // Implausible
  return 'ok';
}
```

**Thresholds:**
- Price <= 0 or > 10,000 XAF -> auto-reject
- Price outside 50%-200% of known market range -> flag
- Unknown mobile money provider not in known list -> flag (but allow, could be new entrant)
- Availability status changed >3 times in 24h for same POI -> flag

**Confidence:** 70% for price validation. Market prices shift, so ranges must be updated periodically.

#### Rule R-IP-01: IP Reputation (addresses F-LOC-02, F-ACC-02)

**Signals:**
- IP address ASN type (residential, datacenter, VPN, Tor)
- Multiple userIds submitting from same IP within short window

**Detection Logic:**

```typescript
// Enhance the existing fetchIpLocation in api/submissions/index.ts
interface EnhancedIpInfo {
  location: SubmissionLocation | null;
  asn: string | null;
  org: string | null;
  isDatacenter: boolean;
  isVpn: boolean;
  isTor: boolean;
}

async function fetchEnhancedIpInfo(ip: string): Promise<EnhancedIpInfo> {
  // Use ipapi.co (already in use) or similar service
  const res = await fetch(`https://ipapi.co/${ip}/json/`);
  const data = await res.json();

  const org = (data.org ?? '').toLowerCase();
  const isDatacenter = org.includes('hosting') || org.includes('cloud') ||
    org.includes('digitalocean') || org.includes('aws') || org.includes('azure');
  const isVpn = org.includes('vpn') || org.includes('private internet') ||
    org.includes('nordvpn') || org.includes('express');

  return {
    location: parseLocation(data),
    asn: data.asn ?? null,
    org: data.org ?? null,
    isDatacenter,
    isVpn,
    isTor: data.is_tor === true,
  };
}
```

**Thresholds:**
- Tor exit node -> auto-block submission
- Known VPN/datacenter ASN -> flag, increase risk score by 25
- 3+ different userIds from same IP in 1 hour -> flag all as potential alt accounts

**Confidence:** 85% for Tor/datacenter. 60% for VPN (many legitimate users in Africa use VPNs for connectivity reasons).

#### Rule R-GRA-01: Collusion Graph Analysis (addresses F-XP-03)

**Signals:**
- User-to-point bipartite graph: which users interact with which points
- Reciprocal enrichment patterns: A enriches B's points AND B enriches A's points
- Temporal coordination: submissions from different users on same points within narrow windows

**Detection Logic:**

```sql
-- Find reciprocal enrichment pairs
WITH enrichments AS (
  SELECT
    e.user_id AS enricher,
    c.user_id AS creator,
    e.point_id
  FROM point_events e
  JOIN point_events c ON e.point_id = c.point_id
    AND c.event_type = 'CREATE_EVENT'
  WHERE e.event_type = 'ENRICH_EVENT'
    AND e.user_id != c.user_id
),
pairs AS (
  SELECT
    enricher AS user_a,
    creator AS user_b,
    COUNT(*) AS a_enriches_b
  FROM enrichments
  GROUP BY enricher, creator
)
SELECT
  p1.user_a,
  p1.user_b,
  p1.a_enriches_b,
  COALESCE(p2.a_enriches_b, 0) AS b_enriches_a
FROM pairs p1
LEFT JOIN pairs p2
  ON p1.user_a = p2.user_b AND p1.user_b = p2.user_a
WHERE p1.a_enriches_b >= 3
  AND COALESCE(p2.a_enriches_b, 0) >= 3
ORDER BY (p1.a_enriches_b + COALESCE(p2.a_enriches_b, 0)) DESC;
```

**Thresholds:**
- Reciprocal enrichment between two users >= 3 times each -> flag both accounts
- 3+ users all enriching each other's points >= 2 times -> escalate as collusion ring
- Cluster of users with >80% of their enrichments going to other cluster members -> auto-flag all

**Confidence:** 75%. Legitimate community behavior (neighbors validating each other's submissions) can look like collusion. Requires manual review.

---

## 3. Risk Scoring Model

### 3.1 Submission Risk Score (0-100)

Every submission receives a composite risk score computed from five trust dimensions. Higher score = higher risk = more likely fraudulent.

```
SubmissionRiskScore = w_loc * LocationRisk
                    + w_pho * PhotoRisk
                    + w_tmp * TemporalRisk
                    + w_usr * UserRisk
                    + w_bhv * BehavioralRisk
```

#### Component Weights (Initial Calibration)

| Component | Weight | Rationale |
|---|---|---|
| Location Trust (LocationRisk) | 0.25 | GPS/IP/EXIF triangulation is the strongest objective signal |
| Photo Trust (PhotoRisk) | 0.25 | Photo evidence is the primary proof of physical presence |
| Temporal Trust (TemporalRisk) | 0.15 | Velocity and timing patterns |
| User Trust (UserRisk) | 0.20 | Account age, history, prior fraud flags |
| Behavioral Trust (BehavioralRisk) | 0.15 | Submission patterns, enrichment behavior |

#### 3.1.1 Location Risk (0-100)

```typescript
function computeLocationRisk(params: {
  submissionLocation: SubmissionLocation | null;
  photoExifGps: SubmissionLocation | null;
  ipLocation: SubmissionLocation | null;
  effectiveLocation: SubmissionLocation;
}): number {
  let risk = 0;

  // No submission GPS provided (using fallback)
  if (!params.submissionLocation) risk += 15;

  // No EXIF GPS in photo
  if (!params.photoExifGps) risk += 20;

  // No IP location resolved
  if (!params.ipLocation) risk += 10;

  // Submission-to-photo GPS mismatch (if both present)
  if (params.submissionLocation && params.photoExifGps) {
    const dist = haversineKm(params.submissionLocation, params.photoExifGps);
    if (dist > 1) risk += 40;       // Beyond 1km threshold
    else if (dist > 0.5) risk += 15; // Marginal
  }

  // IP-to-effective location mismatch
  if (params.ipLocation) {
    const dist = haversineKm(params.ipLocation, params.effectiveLocation);
    if (dist > 50) risk += 30;
    else if (dist > 20) risk += 10;
  }

  return Math.min(100, risk);
}
```

#### 3.1.2 Photo Risk (0-100)

```typescript
function computePhotoRisk(params: {
  hasExifGps: boolean;
  hasExifTimestamp: boolean;
  hasDeviceInfo: boolean;
  imageHash: string;
  existingHashes: Set<string>;
  imageDimensions: { width: number; height: number };
  isLowEndDevice: boolean;
}): number {
  let risk = 0;

  // Photo hash already exists for different point
  if (params.existingHashes.has(params.imageHash)) risk += 80;

  // Missing EXIF metadata
  if (!params.hasExifGps) risk += 15;
  if (!params.hasExifTimestamp) risk += 10;
  if (!params.hasDeviceInfo) risk += 10;

  // Screenshot dimensions (common phone screen resolutions)
  const { width, height } = params.imageDimensions;
  const isScreenshotRatio = (
    (width === 1080 && height === 2400) || // Common Android screenshot
    (width === 1170 && height === 2532) || // iPhone 12/13 screenshot
    (width === 1284 && height === 2778)    // iPhone 12/13 Pro Max screenshot
  );
  if (isScreenshotRatio) risk += 15;

  // Mitigate for low-end devices
  if (params.isLowEndDevice && risk > 0 && risk <= 35) {
    risk = Math.max(0, risk - 10);
  }

  return Math.min(100, risk);
}
```

#### 3.1.3 Temporal Risk (0-100)

```typescript
function computeTemporalRisk(params: {
  recentSubmissionCount15min: number;
  recentSubmissionCount1hr: number;
  lastSubmissionLocation: SubmissionLocation | null;
  lastSubmissionTime: Date | null;
  currentLocation: SubmissionLocation;
  currentTime: Date;
}): number {
  let risk = 0;

  // Velocity
  if (params.recentSubmissionCount15min > 10) risk += 50;
  else if (params.recentSubmissionCount15min > 5) risk += 25;
  else if (params.recentSubmissionCount15min > 3) risk += 10;

  // Impossible travel
  if (params.lastSubmissionLocation && params.lastSubmissionTime) {
    const distKm = haversineKm(params.lastSubmissionLocation, params.currentLocation);
    const hoursElapsed = (params.currentTime.getTime() - params.lastSubmissionTime.getTime()) / 3600000;
    if (hoursElapsed > 0) {
      const speedKmh = distKm / hoursElapsed;
      if (speedKmh > 200) risk += 50;
      else if (speedKmh > 80) risk += 25;
    }
  }

  // Late-night submissions (less likely to be legitimate fieldwork)
  const hour = params.currentTime.getUTCHours() + 1; // UTC+1 for Cameroon
  if (hour >= 23 || hour < 5) risk += 10;

  return Math.min(100, risk);
}
```

#### 3.1.4 User Risk (0-100)

```typescript
function computeUserRisk(params: {
  accountAgeDays: number;
  totalSubmissions: number;
  priorFraudFlags: number;
  priorRejections: number;
  userTrustScore: number; // 0-100, see section 3.2
}): number {
  let risk = 0;

  // New account penalty
  if (params.accountAgeDays < 1) risk += 25;
  else if (params.accountAgeDays < 7) risk += 15;
  else if (params.accountAgeDays < 30) risk += 5;

  // No submission history
  if (params.totalSubmissions === 0) risk += 15;

  // Prior fraud history
  risk += Math.min(40, params.priorFraudFlags * 10);
  risk += Math.min(20, params.priorRejections * 5);

  // Inverse of user trust score
  risk += Math.round((100 - params.userTrustScore) * 0.2);

  return Math.min(100, risk);
}
```

#### 3.1.5 Behavioral Risk (0-100)

```typescript
function computeBehavioralRisk(params: {
  selfEnrichmentCount: number;
  samePointEnrichments: number;
  categoryDistribution: Map<string, number>; // how many of each category
  totalSubmissions: number;
  deviceIdSharedWithOtherUsers: boolean;
  ipSharedWithOtherUsers: boolean;
}): number {
  let risk = 0;

  // Self-enrichment pattern
  if (params.selfEnrichmentCount > 5) risk += 30;
  else if (params.selfEnrichmentCount > 2) risk += 15;

  // Excessive enrichments on single point
  if (params.samePointEnrichments > 3) risk += 25;

  // Monoculture (only submitting one category could indicate targeted farming)
  if (params.totalSubmissions > 10) {
    const maxCategoryPct = Math.max(...params.categoryDistribution.values()) / params.totalSubmissions;
    if (maxCategoryPct > 0.95) risk += 10;
  }

  // Device/IP sharing signals
  if (params.deviceIdSharedWithOtherUsers) risk += 15;
  if (params.ipSharedWithOtherUsers) risk += 10;

  return Math.min(100, risk);
}
```

### 3.2 User Trust Score (0-100)

A long-term reputation score that builds with legitimate contributions and decays with fraud signals.

```typescript
interface UserTrustProfile {
  userId: string;
  trustScore: number;           // 0-100, starts at 50
  totalApproved: number;        // Submissions that passed review
  totalFlagged: number;         // Submissions that were flagged
  totalRejected: number;        // Submissions rejected for fraud
  consecutiveClean: number;     // Streak of unflagged submissions
  lastFraudFlag: string | null; // ISO date
  tier: 'new' | 'standard' | 'trusted' | 'elite' | 'suspended';
}

function updateTrustScore(profile: UserTrustProfile, event: 'approved' | 'flagged' | 'rejected'): void {
  switch (event) {
    case 'approved':
      profile.totalApproved++;
      profile.consecutiveClean++;
      // Gradual increase: +1 per clean submission, +2 if on a streak
      const bonus = profile.consecutiveClean > 10 ? 2 : 1;
      profile.trustScore = Math.min(100, profile.trustScore + bonus);
      break;

    case 'flagged':
      profile.totalFlagged++;
      profile.consecutiveClean = 0;
      // Moderate decrease
      profile.trustScore = Math.max(0, profile.trustScore - 5);
      profile.lastFraudFlag = new Date().toISOString();
      break;

    case 'rejected':
      profile.totalRejected++;
      profile.consecutiveClean = 0;
      // Significant decrease
      profile.trustScore = Math.max(0, profile.trustScore - 15);
      profile.lastFraudFlag = new Date().toISOString();
      break;
  }

  // Update tier
  if (profile.trustScore >= 85 && profile.totalApproved >= 50) profile.tier = 'elite';
  else if (profile.trustScore >= 70 && profile.totalApproved >= 20) profile.tier = 'trusted';
  else if (profile.trustScore >= 30) profile.tier = 'standard';
  else if (profile.trustScore >= 10) profile.tier = 'new';
  else profile.tier = 'suspended';
}
```

**Trust Tiers:**

| Tier | Trust Score | Requirements | Privileges |
|---|---|---|---|
| New | 30-49 | Default for new accounts | All submissions reviewed. Max 10/day. |
| Standard | 50-69 | 10+ approved submissions | Normal rate limits. Flagged only by rules. |
| Trusted | 70-84 | 20+ approved, score >= 70 | Relaxed thresholds. Some submissions auto-approved. |
| Elite | 85-100 | 50+ approved, score >= 85 | Can validate others' submissions. Highest auto-approve rate. |
| Suspended | 0-9 | Triggered by fraud | All submissions blocked. Appeal required. |

**Decay:** Trust score decays by 1 point per 30 days of inactivity to prevent dormant accounts from retaining high trust indefinitely.

### 3.3 Score Thresholds and Actions

| Composite Risk Score | Action | XP Treatment |
|---|---|---|
| 0-25 | **Auto-approve**. Submission accepted, XP awarded immediately. | Full XP (+5) |
| 26-50 | **Soft review**. Submission accepted, XP awarded, added to review queue. Admin reviews within 48h. | Full XP, reversible |
| 51-75 | **Hard review**. Submission accepted but XP held in escrow. Requires admin approval within 72h. | XP escrowed |
| 76-100 | **Auto-reject**. Submission rejected with reason. User notified. | No XP |

**Critical change from current behavior:** Currently XP is awarded immediately and unconditionally (`profile.XP = (profile.XP ?? 0) + BASE_EVENT_XP`). The proposed model introduces XP escrow for medium-high risk submissions.

### 3.4 Weight Calibration Strategy

Phase 1 (Weeks 1-4): Deploy scoring in **shadow mode**. Compute risk scores for all submissions but do not act on them. Log scores alongside submission data.

Phase 2 (Weeks 5-8): Analyze shadow scores against manually labeled data. Admin team reviews a random sample of 100 submissions and labels each as legitimate/suspicious/fraudulent. Use labels to:
- Identify which signals correlate most strongly with actual fraud
- Adjust weights using logistic regression or simple gradient descent
- Set thresholds that produce acceptable false positive rates (<5%)

Phase 3 (Weeks 9-12): Enable enforcement mode with conservative thresholds (auto-reject only at 90+). Gradually lower thresholds as confidence grows.

Phase 4 (Ongoing): Monthly recalibration using the previous month's manual review labels. Track precision/recall for each component.

---

## 4. Response Playbooks

### 4.1 Playbook P-FAB: Data Fabrication Response

**Trigger:** Submission risk score > 75 with LocationRisk > 60 or PhotoRisk > 70.

**Immediate Automated Response:**
1. Reject the submission (HTTP 400 with fraud reason code)
2. Do not award XP
3. Log the rejection with full fraud check payload to `fraud_audit_log` table
4. Increment user's `priorRejections` counter
5. If user has 3+ rejections in 24 hours, auto-suspend account

**Escalation Criteria:**
- User has > 5 lifetime rejections -> escalate to admin queue
- Rejection involves a POI that was previously approved (conflicting data) -> immediate admin review
- Pattern of fabrication detected across multiple related submissions -> escalate as organized fraud

**Investigation Steps:**
1. Pull all submissions from the flagged userId (query `point_events` where `user_id = :flaggedId`)
2. Cross-reference device fingerprints: check if `clientDevice.deviceId` appears under other userIds
3. Review photo evidence: open each photo URL in admin dashboard, compare to Google Maps Street View for the GPS coordinates
4. Check IP history: was this user submitting from consistent IPs (suggesting a real location) or varied datacenter IPs?
5. Interview the user (if contactable): request they resubmit with a video or live photo

**Resolution Options:**

| Action | Criteria | Reversible? |
|---|---|---|
| Warning | First offense, low confidence in fraud determination | Yes |
| XP clawback | Confirmed fabrication, remove XP for fraudulent submissions | Yes via appeal |
| Submission deletion | Confirmed fabrication, admin calls DELETE on event ID | No (soft delete with audit trail) |
| Account suspension (7 days) | 3+ confirmed fabrications | Yes via appeal |
| Permanent ban | Repeated confirmed fabrication after suspension | Via appeal to senior admin |

**Appeal Process:**
1. User submits appeal via in-app form or email
2. Appeal reviewed by different admin than the one who flagged
3. If evidence is ambiguous, user is asked to provide additional proof (return to location, take timestamped video)
4. Appeal decision rendered within 5 business days
5. If overturned, XP restored and trust score partially recovered (+10)

**Evidence Preservation:**
- All photo URLs are retained in Vercel Blob (do not delete blob storage even if submission event is deleted)
- Fraud check payload preserved in `details.fraudCheck` on the event
- Admin actions logged with admin userId, timestamp, and reason in `fraud_audit_log`
- IP addresses and device fingerprints retained for 90 days for forensic analysis

### 4.2 Playbook P-XPG: XP Gaming Response

**Trigger:** TemporalRisk > 50 or BehavioralRisk > 50, or self-enrichment pattern detected.

**Immediate Automated Response:**
1. For velocity violations: rate-limit the user (HTTP 429, "You're submitting too quickly. Please wait 15 minutes.")
2. For self-enrichment: allow the submission but cap XP at 0 for the 4th+ enrichment on the same point by the same user
3. Escrow XP for all flagged submissions pending review

**Escalation Criteria:**
- User hits velocity block threshold (15/15min) -> immediate admin notification
- User has > 20 self-enrichments across all points -> escalate as systematic gaming
- Leaderboard anomaly: user jumps >10 ranks in 24 hours -> manual review

**Investigation Steps:**
1. Analyze temporal distribution of user's submissions (histogram by hour/day)
2. Map enrichment patterns: which points, what fields, what order
3. Compare user's submission rate to median rate for their cohort
4. Check if the enrichment data is actually correct (spot-check against ground truth)

**Resolution Options:**

| Action | Criteria |
|---|---|
| Rate limit enforcement | Velocity violation, resets after cool-off period |
| XP cap per point | Self-enrichment detected, max 2 enrichments earn XP per user per point |
| XP recalculation | Confirmed gaming, recalculate user's XP excluding fraudulent submissions |
| Leaderboard demotion | Confirmed gaming, manually adjust ranking |

### 4.3 Playbook P-LOC: Location Spoofing Response

**Trigger:** LocationRisk > 60 with specific signals: impossible travel, IP mismatch, EXIF GPS mismatch.

**Immediate Automated Response:**
1. For impossible travel (>200 km/h): auto-reject with "Location verification failed"
2. For IP mismatch (datacenter/VPN): flag for review, allow submission but escrow XP
3. For EXIF-submission GPS mismatch: already handled by current code (HTTP 400 rejection at `api/submissions/index.ts:504`)

**Investigation Steps:**
1. Plot the user's submission locations on a map with timestamps to visualize travel patterns
2. Check if the user's device reports mock location capability (Android: `Settings.Secure.ALLOW_MOCK_LOCATION`)
3. Compare IP ASN history -- consistent residential ASN vs. rotating datacenter ASNs
4. For EXIF manipulation: check for EXIF software tag inconsistencies (e.g., "Adobe Photoshop" or "exiftool" as the software field)

**Resolution Options:**

| Action | Criteria |
|---|---|
| Reject submission | Clear GPS spoofing (impossible travel, >200 km/h) |
| Flag + escrow | VPN/proxy detected but data may be legitimate |
| Account review | 3+ location spoofing flags on same account |
| Ban | Confirmed systematic GPS spoofing (developer tools / mock location) |

### 4.4 Playbook P-PHO: Photo Fraud Response

**Trigger:** PhotoRisk > 60, or photo hash duplicate detected.

**Immediate Automated Response:**
1. Exact hash duplicate for different point: auto-reject ("This photo has already been used")
2. Missing all EXIF metadata + not low-end device: flag for review
3. Screenshot dimensions detected: flag for review with "screenshot_suspected" tag

**Investigation Steps:**
1. Reverse image search the photo URL (manual step using Google Images or TinEye)
2. Check image metadata for telltale signs: consistent dimensions across all user submissions (screenshot bot), impossibly high resolution for claimed device, JPEG quality artifacts inconsistent with phone camera
3. Compare photo content to Google Maps Street View for the declared GPS location

**Resolution Options:**

| Action | Criteria |
|---|---|
| Reject | Exact duplicate photo across different POIs |
| Reject | Confirmed stock photo / internet image (reverse image search hit) |
| Flag | Screenshot suspected but content plausible |
| Allow | Low-end device with missing EXIF (Africa-specific accommodation) |

### 4.5 Playbook P-ACC: Account Abuse Response

**Trigger:** Device cross-reference flag (same deviceId on multiple userIds), or bot behavior detected.

**Immediate Automated Response:**
1. Bot detection (no clientDevice, scripted patterns): block with CAPTCHA challenge
2. Multi-account detection: flag all linked accounts, suspend newest accounts
3. Credential sharing: flag account, send security notification to account email

**Investigation Steps:**
1. Build an account linkage graph: deviceId -> userIds, IP -> userIds, fingerprint -> userIds
2. For each cluster of linked accounts, determine the "primary" account (oldest, most submissions)
3. Check if linked accounts are submitting in the same geographic area (shared device at home) or different areas (coordinated fraud)
4. Review submission quality across all linked accounts

**Resolution Options:**

| Action | Criteria |
|---|---|
| Merge accounts | Shared device, appears to be family/legitimate sharing |
| Suspend alt accounts | Confirmed alt-farming, preserve primary account |
| Ban all accounts | Coordinated bot operation |
| CAPTCHA enforcement | Bot suspicion, require human verification |

### 4.6 Playbook P-POI: Data Poisoning Response

**Trigger:** Field plausibility check fails, or conflicting data from multiple sources on same POI.

**Immediate Automated Response:**
1. Impossible field values (price <= 0, price > 10000 XAF): auto-reject
2. Conflicting availability data (3+ status flips in 24h): flag all recent updates for review
3. Implausible values (price outside market range): accept but escrow, flag for review

**Investigation Steps:**
1. Compare the submitted data against other recent submissions for the same POI (consensus analysis)
2. Check if the submitter has a pattern of negative availability reports for specific businesses
3. Cross-reference with external data sources (Google Maps, OpenStreetMap) where available
4. For price data: compare against historical price trends for the same POI

**Resolution Options:**

| Action | Criteria |
|---|---|
| Reject field value | Impossible value (price <= 0) |
| Revert to previous value | Confirmed poisoning, restore last known good data |
| Flag user | Pattern of intentionally wrong data |
| Competitor sabotage investigation | User consistently marks specific businesses as closed |

---

## 5. False Positive Minimization

### 5.1 Legitimate Scenarios That Resemble Fraud

The African mobile context produces many false positive signals that would be definitive fraud indicators in Western markets. Each must be handled carefully.

#### FP-01: New Users Look Like Fraudsters

**The problem:** A brand-new contributor has no submission history, no trust score, a fresh deviceId, and may submit several POIs on their first field trip. Every risk signal fires: UserRisk is high (new account), TemporalRisk is elevated (multiple submissions in quick succession), BehavioralRisk is elevated (no prior pattern).

**Mitigation:**
- New User Grace Period: First 3 submissions from a new account receive a 15-point risk score reduction (equivalent to the new-account penalty being waived for the very first submissions)
- Onboarding flow: guide new users through their first submission with explicit instructions, producing a "tutorial" submission that seeds their trust profile
- Allow up to 5 submissions in the first hour without velocity flags (one-time allowance)

#### FP-02: Poor GPS Accuracy on Feature Phones

**The problem:** Low-end Android phones (Itel, Infinix Smart, Tecno Pop) common in Cameroon have GPS accuracy of 50-100 meters rather than 5-10 meters. This means the GPS-to-EXIF distance could exceed the 1km threshold even for a legitimate submission if the phone provides coordinates from cell tower triangulation rather than true GPS.

**Mitigation:**
- The current `detectLowEndFromHints` function in `lib/client/deviceProfile.ts:74-88` already identifies these devices (itel, android go, go edition, infinix smart, memory <= 2GB)
- When `clientDevice.isLowEnd === true`, increase the submission-to-EXIF GPS match threshold from 1km to 2km
- Weight the LocationRisk score component by 0.7x for low-end devices (reduce its contribution to the composite score)
- Never auto-reject based solely on GPS mismatch for low-end devices; always flag for review instead

#### FP-03: Shared Devices

**The problem:** In many African households, a single smartphone is shared among family members. Multiple people may use the same device to contribute to ADL. This triggers the multi-account detection rule (same deviceId, different userIds).

**Mitigation:**
- Flag but do not auto-suspend when 2 accounts share a deviceId
- Only escalate to suspension at 3+ accounts per device
- Allow users to declare "shared device" in their profile settings, which adjusts the deviceId-based rules
- When shared device is declared, apply per-user rate limits instead of per-device limits
- Track submission patterns: shared device users typically submit at different times of day (different people), while alt-account farmers submit at all hours

#### FP-04: Intermittent Connectivity and Offline Queue Batching

**The problem:** The offline queue in `lib/client/offlineQueue.ts` is designed for intermittent connectivity. A contributor might collect 8 submissions over a 2-hour field trip while offline, then flush them all at once when they find a Wi-Fi hotspot. This looks identical to a rapid-fire bot: 8 submissions arriving within seconds.

**Mitigation:**
- Track the `createdAt` timestamp from the offline queue item (client-side creation time) separately from the server-side `createdAt`
- If the submission payload includes a `queuedAt` timestamp (added by the offline queue), use the time gap between `queuedAt` values for velocity analysis instead of server arrival time
- Require the offline queue to include a sequence number and the total batch size. A batch of 8 that arrives with sequential timestamps spread over 2 hours is treated differently from 8 simultaneous creations
- Add `offlineBatch: boolean` flag to the submission payload. When true, apply relaxed velocity thresholds (15/batch instead of 5/15min)

```typescript
// Proposed addition to SubmissionInput type
interface SubmissionInput {
  // ... existing fields
  queuedAt?: string;         // ISO timestamp from offline queue creation
  offlineBatchId?: string;   // Identifies submissions from the same offline session
  offlineBatchSize?: number; // Total items in this batch
}
```

#### FP-05: Legitimate Dense POI Areas

**The problem:** In Douala's commercial areas (Marche Bonamoussadi, Carrefour Ange Raphael), multiple mobile money kiosks can be within 10 meters of each other. The duplicate POI detection rule (R-PROX-01) would incorrectly flag these as duplicates.

**Mitigation:**
- Category-specific proximity thresholds:
  - `mobile_money`: 10m duplicate threshold (kiosks cluster densely)
  - `pharmacy`: 50m duplicate threshold (rarely adjacent)
  - `fuel_station`: 100m duplicate threshold (large footprint, never adjacent)
- Require name differentiation for close-proximity same-category POIs: two mobile money kiosks within 20m must have different provider names
- Use photo comparison: if two nearby POIs have visually distinct photos, they are likely genuinely different businesses

#### FP-06: Timestamp Anomalies from Incorrect Phone Clocks

**The problem:** Many feature phones in Africa have incorrect system clocks (never set, battery removed and reset, timezone misconfigured). EXIF timestamps may be hours or years off from reality.

**Mitigation:**
- Do not use EXIF timestamp alone as a fraud signal
- Compare EXIF timestamp against server receipt time. If the EXIF timestamp is in the future or more than 24 hours in the past, treat it as "unreliable" rather than "fraudulent"
- For low-end devices, weight the temporal component of the EXIF trust score at 0.5x

### 5.2 Calibration Using Labeled Data

**Data Collection Process:**

1. Random sampling: each week, an admin reviews 50 randomly selected submissions
2. For each submission, the admin labels it: `legitimate`, `suspicious`, `confirmed_fraud`
3. Labels are stored in a `submission_labels` table linked to `event_id`
4. After 4 weeks (200 labeled samples), run the first calibration analysis

**Calibration Metrics:**

```
Precision = TruePositives / (TruePositives + FalsePositives)
Recall    = TruePositives / (TruePositives + FalseNegatives)
F1        = 2 * Precision * Recall / (Precision + Recall)
```

**Target:** Precision >= 0.90, Recall >= 0.70. We strongly prefer not falsely accusing legitimate contributors (high precision) even at the cost of missing some fraud (lower recall).

### 5.3 User Friction Tradeoffs

| Friction Level | Mechanism | When Applied | Impact on Conversion |
|---|---|---|---|
| Zero | No additional checks beyond current validation | Risk score 0-25, trusted/elite users | None |
| Low | Flag for async review, user not aware | Risk score 26-50, standard users | None |
| Medium | "Verifying submission..." delay (2-3 seconds) | Risk score 51-75 | Minimal (perceived as upload time) |
| High | Request second photo or additional details | Risk score 76+, or specific rule triggers | 10-20% drop-off estimated |
| Maximum | CAPTCHA + identity verification | Bot detection, suspended accounts | 50%+ drop-off (intentional for bots) |

**Principle:** For legitimate contributors on low-end devices with poor connectivity, every additional second of friction risks losing the submission entirely (timeout, page refresh, battery death). Fraud detection must be as invisible as possible for the bottom 80% of submissions.

### 5.4 Whitelist / Trust Mechanisms

**Organizational Whitelists:**
- Partner organizations (NGOs, health authorities) that deploy field agents can register their agents for elevated trust. These agents start at trust tier "trusted" instead of "new."
- Whitelist is managed by admin via a `trusted_organizations` table with a list of pre-approved email domains.

**Geographic Trust Zones:**
- Areas where ADL has ground-truth data (e.g., locations personally verified by the founding team in Bonamoussadi) receive lighter scrutiny for enrichments.
- Seed data from `shared/bonamoussadiSeedEvents.ts` (OSM imports) establishes ground-truth anchors. Submissions that enrich these known-good points get a 10-point risk reduction.

**Graduated Trust:**
- Users earn "verified field agent" badge after 50 approved submissions with trust score >= 80
- Verified agents can attest to other users' submissions (peer review mechanism)
- Top 10 leaderboard users receive quarterly manual review of a random sample of their submissions to ensure ongoing quality

---

## 6. Fraud Metrics & Monitoring

### 6.1 Key Performance Indicators

| KPI | Definition | Target | Measurement Frequency |
|---|---|---|---|
| **Fraud Rate** | (Confirmed fraudulent submissions / Total submissions) * 100 | < 2% | Weekly |
| **Detection Rate (Recall)** | (Detected fraud / Total actual fraud) * 100 | > 70% | Monthly (requires labeled data) |
| **False Positive Rate** | (Legitimate submissions incorrectly flagged / Total flagged) * 100 | < 10% | Weekly |
| **Time to Detection** | Median time between submission and fraud flag | < 1 hour (automated) < 48 hours (manual) | Weekly |
| **Resolution Time** | Median time between flag and admin resolution | < 72 hours | Weekly |
| **XP Clawback Rate** | (XP removed due to fraud / Total XP awarded) * 100 | < 1% | Monthly |
| **Appeal Overturn Rate** | (Appeals overturned / Total appeals) * 100 | < 20% (indicates calibration is working) | Monthly |
| **Contributor Churn from False Flags** | Contributors who stop submitting within 7 days of receiving a fraud flag | < 5% | Monthly |

### 6.2 Dashboard Panels

The fraud monitoring dashboard should be accessible to admin users via the existing admin panel architecture.

**Panel 1: Real-Time Fraud Feed**

```
+------------------------------------------------------------------+
| FRAUD FEED (last 24 hours)                    [Auto-refresh: 30s] |
+------------------------------------------------------------------+
| Time     | User          | Type      | Risk | Status   | Action  |
|----------|---------------|-----------|------|----------|---------|
| 14:32    | user_abc123   | F-FAB-01  |  82  | Rejected | [View]  |
| 14:15    | user_def456   | F-XP-01   |  64  | Escrowed | [View]  |
| 13:58    | user_ghi789   | F-PHO-03  |  91  | Rejected | [View]  |
| 13:42    | user_jkl012   | F-LOC-01  |  78  | Flagged  | [View]  |
+------------------------------------------------------------------+
| Today: 12 flagged | 4 rejected | 2 escrowed | 156 clean          |
+------------------------------------------------------------------+
```

**Panel 2: Risk Score Distribution**

Histogram showing the distribution of risk scores across all submissions for the selected time period. Healthy distribution: >80% of submissions score 0-25, <5% score 76+.

```
Risk Score Distribution (Last 7 Days, n=342)
  0-25:  ████████████████████████████████████  278 (81.3%)
 26-50:  ██████                                 42 (12.3%)
 51-75:  ██                                     14  (4.1%)
 76-100: █                                       8  (2.3%)
```

**Panel 3: User Risk Leaderboard (Inverse)**

Top 10 users by cumulative risk score. These are the users most likely to be committing fraud.

```
+--------------------------------------------------+
| HIGHEST RISK USERS                                |
+--------------------------------------------------+
| Rank | User          | Avg Risk | Flags | Trust  |
|------|---------------|----------|-------|--------|
|  1   | user_xxx001   |    72    |   8   |   12   |
|  2   | user_xxx002   |    68    |   6   |   18   |
|  3   | user_xxx003   |    61    |   5   |   25   |
+--------------------------------------------------+
```

**Panel 4: Fraud Type Breakdown**

Pie chart or bar chart showing distribution of fraud types detected over the last 30 days.

**Panel 5: Geographic Hotspot Map**

Heatmap overlay on the existing map component showing where flagged submissions cluster geographically. High-density fraud areas may indicate organized operations.

**Panel 6: Collusion Network Graph**

Interactive graph visualization showing user-to-user connections via shared points, shared devices, and reciprocal enrichments. Clusters of tightly connected users warrant investigation.

### 6.3 Alert Thresholds

| Alert | Condition | Channel | Severity |
|---|---|---|---|
| Fraud spike | Fraud rate > 5% in any 4-hour window | Admin email + dashboard banner | Critical |
| Bot attack | > 50 submissions from single IP in 1 hour | Admin email + auto-block IP | Critical |
| Account compromise | User submitting from new device + new IP + unusual hours | User email + admin notification | High |
| Leaderboard manipulation | Any user gains > 50 XP in 1 hour | Admin dashboard alert | High |
| New collusion ring detected | 3+ users with reciprocal enrichment score > threshold | Admin dashboard + email | Medium |
| Trust score mass decay | > 10 users drop below "standard" tier in 24 hours | Admin dashboard | Medium |
| False positive spike | Appeal overturn rate > 30% in any week | Admin email | High (indicates broken rules) |

### 6.4 Weekly Fraud Review Process

**Schedule:** Every Monday, 10:00 WAT (West Africa Time).

**Attendees:** Admin team (minimum 1 admin, ideally 2 for cross-validation).

**Agenda:**

1. **Metrics Review (10 min)**
   - Review all KPIs from section 6.1
   - Compare to previous week and trailing 4-week average
   - Flag any metric that has moved > 20% from baseline

2. **Flagged Submission Review (20 min)**
   - Review all submissions currently in the review queue (risk score 26-75)
   - For each: approve, reject, or escalate
   - Target: clear 100% of the queue by end of session

3. **Rejected Submission Audit (10 min)**
   - Randomly sample 5 auto-rejected submissions (risk score 76+)
   - Verify that rejections were correct
   - If any rejection was a false positive, adjust the triggering rule

4. **User Account Actions (10 min)**
   - Review any accounts pending suspension/ban
   - Process any pending appeals
   - Review the "highest risk users" panel

5. **Rule Tuning (10 min)**
   - Based on the week's data, are any rules too aggressive (too many false positives) or too lenient (missed fraud)?
   - Propose threshold adjustments
   - Document changes in a `fraud_rule_changelog`

**Output:** Weekly fraud report saved to shared document. Threshold changes applied to production by end of week.

---

## Appendix A: Implementation Priority

The following table ranks each detection mechanism by implementation effort and impact, to guide the engineering team on what to build first.

| Priority | Rule / Mechanism | Effort | Impact | Addresses |
|---|---|---|---|---|
| P0 (Immediate) | Submission velocity rate limiter (R-VEL-01) | Low | Critical | F-XP-01, F-ACC-02 |
| P0 (Immediate) | Photo hash deduplication (R-DUP-01) | Low | Critical | F-PHO-03, F-FAB-02 |
| P0 (Immediate) | Field plausibility validation (R-VAL-01) | Low | High | F-POI-01 |
| P1 (Week 2-3) | XP escrow for medium-risk submissions | Medium | Critical | All scenarios |
| P1 (Week 2-3) | Impossible travel detection (R-GEO-01) | Medium | High | F-LOC-01 |
| P1 (Week 2-3) | Duplicate POI detection (R-PROX-01) | Medium | High | F-FAB-01 |
| P1 (Week 2-3) | Device fingerprint cross-reference (R-DEV-01) | Medium | High | F-ACC-01, F-XP-04 |
| P2 (Week 4-6) | User trust scoring system | High | Critical | All scenarios |
| P2 (Week 4-6) | Self-enrichment pattern detection (R-ENR-01) | Medium | Medium | F-XP-02 |
| P2 (Week 4-6) | IP reputation checking (R-IP-01) | Medium | Medium | F-LOC-02, F-ACC-02 |
| P2 (Week 4-6) | Composite risk scoring model | High | Critical | All scenarios |
| P3 (Week 7-12) | Collusion graph analysis (R-GRA-01) | High | High | F-XP-03 |
| P3 (Week 7-12) | Perceptual image hashing | High | Medium | F-PHO-03, F-FAB-02 |
| P3 (Week 7-12) | Fraud monitoring dashboard | High | Medium | Monitoring |
| P4 (Quarter 2) | AI-generated image detection | Very High | Medium | F-FAB-03 |
| P4 (Quarter 2) | Reverse image search integration | Very High | Medium | F-PHO-01 |
| P4 (Quarter 2) | Offline queue attestation (signed timestamps) | High | Medium | F-XP-01 |

## Appendix B: Proposed Schema Additions

```sql
-- Submission image hashes for deduplication
CREATE TABLE submission_image_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL REFERENCES point_events(id),
  point_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  perceptual_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_image_hashes_sha256 ON submission_image_hashes(sha256_hash);
CREATE INDEX idx_image_hashes_user ON submission_image_hashes(user_id);

-- User trust profiles
CREATE TABLE user_trust_profiles (
  user_id TEXT PRIMARY KEY,
  trust_score INTEGER NOT NULL DEFAULT 50,
  tier TEXT NOT NULL DEFAULT 'new',
  total_approved INTEGER NOT NULL DEFAULT 0,
  total_flagged INTEGER NOT NULL DEFAULT 0,
  total_rejected INTEGER NOT NULL DEFAULT 0,
  consecutive_clean INTEGER NOT NULL DEFAULT 0,
  last_fraud_flag TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fraud audit log
CREATE TABLE fraud_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'flag', 'reject', 'approve', 'suspend', 'ban', 'appeal_granted'
  risk_score INTEGER,
  risk_components JSONB,
  rule_triggered TEXT, -- e.g., 'R-VEL-01', 'R-DUP-01'
  admin_user_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fraud_audit_user ON fraud_audit_log(user_id);
CREATE INDEX idx_fraud_audit_event ON fraud_audit_log(event_id);

-- Device-to-user mapping for cross-reference
CREATE TABLE device_user_map (
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  submission_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (device_id, user_id)
);
CREATE INDEX idx_device_user_device ON device_user_map(device_id);

-- Submission labels for calibration
CREATE TABLE submission_labels (
  event_id TEXT PRIMARY KEY,
  label TEXT NOT NULL, -- 'legitimate', 'suspicious', 'confirmed_fraud'
  labeled_by TEXT NOT NULL,
  labeled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

-- XP escrow for medium-risk submissions
CREATE TABLE xp_escrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  xp_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'held', -- 'held', 'released', 'clawed_back'
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_xp_escrow_user ON xp_escrow(user_id);
CREATE INDEX idx_xp_escrow_status ON xp_escrow(status);
```

## Appendix C: Key Code Changes Required

### C.1 Modify `api/submissions/index.ts` POST Handler

The POST handler at line 453 must be augmented with fraud checks before the submission is accepted. The proposed insertion point is after photo upload (line 585) and before event insertion (line 656):

```typescript
// After line 635 (buildSubmissionFraudCheck), before line 641 (insertPointEvent)
// Insert fraud scoring
const riskScore = await computeSubmissionRiskScore({
  locationParams: { submissionLocation: location, photoExifGps: photoLocation, ipLocation, effectiveLocation: finalLocation },
  photoParams: { imageHash: computeImageHash(parsedPhoto.imageBuffer), hasExifGps: !!photoLocation, /* ... */ },
  temporalParams: { userId: auth.id, currentLocation: finalLocation, currentTime: new Date() },
  userParams: { userId: auth.id },
  behavioralParams: { userId: auth.id, pointId, eventType },
});

if (riskScore.total >= 76) {
  return errorResponse("Submission flagged for quality review", 400, { code: "fraud_risk_high" });
}

// Modify XP logic based on risk score
const xpToAward = riskScore.total <= 25 ? BASE_EVENT_XP : 0; // Escrow for 26+
```

### C.2 Add Image Hash Computation to Photo Upload Flow

Add SHA-256 hashing immediately after `parseImagePayload`:

```typescript
import { createHash } from 'crypto';

// After line 488 (parseImagePayload validation)
const imageHash = createHash('sha256').update(parsedPhoto.imageBuffer).digest('hex');
const duplicateCheck = await findSubmissionsByImageHash(imageHash);
if (duplicateCheck.some(e => e.pointId !== pointId)) {
  return errorResponse("This photo has already been used for another location", 400);
}
```

### C.3 Enhance Offline Queue with Attestation Metadata

Modify `lib/client/offlineQueue.ts` `enqueueSubmission` to include batch metadata:

```typescript
export async function enqueueSubmission(payload: SubmissionInput): Promise<QueueItem> {
  const now = new Date().toISOString();
  // Add queuedAt to the payload so the server can distinguish offline-queued from live submissions
  const enrichedPayload = {
    ...payload,
    queuedAt: now,
    offlineBatchId: getOrCreateCurrentBatchId(),
  };
  // ... rest of function
}
```

---

*This document should be reviewed and updated whenever a new fraud pattern is observed, a detection rule is tuned, or the platform expands to new geographies beyond Bonamoussadi/Douala.*
