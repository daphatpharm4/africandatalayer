# Capture --> Verify --> Score --> Publish SOP

**Document:** workflow/07-validation-sop.md
**Date:** March 2026
**Purpose:** Standard Operating Procedure for the end-to-end data validation pipeline, from field capture to client-facing publication

---

## Quick Reference Card

Keep these five critical thresholds memorized:

| # | Threshold | Value | Meaning |
|:---:|---|:---:|---|
| 1 | **Publication minimum** | Quality Score **>= 40** | Below 40, data is withheld from all client-facing products |
| 2 | **High-confidence** | Quality Score **>= 70** | Qualifies for premium data products and auto-publish |
| 3 | **Auto-reject fraud** | Fraud Score **>= 71** | Submission automatically rejected; XP denied |
| 4 | **GPS reject** | Speed **> 200 km/h** | Impossible travel between consecutive submissions; auto-block |
| 5 | **Photo reject** | Photo age **> 7 days** | Photo older than 7 days is hard-rejected; >24h is flagged |

---

## Pipeline Flowchart

```
  FIELD AGENT (PWA)                    SERVER                           ADMIN
  ==================                   ======                           =====

  +------------------+
  | 1. CAPTURE       |
  | - Select vertical|
  | - Take photo     |
  | - GPS auto-lock  |
  | - Fill fields    |
  +--------+---------+
           |
           v
  +------------------+
  | 2. CLIENT CHECKS |
  | - Mock GPS?      |
  | - GPS accuracy   |
  | - Sensor sample  |
  | - Network type   |
  +--------+---------+
           |
           v
  +------------------+
  | 3. UPLOAD / SYNC |       +-------------------------+
  | - IndexedDB queue+------>| 4. SERVER VALIDATION    |
  | - Idempotency key|       | - GPS pipeline          |
  | - Photo to Blob  |       | - Photo pipeline        |
  | - Exp. backoff   |       | - Entity dedup          |
  +------------------+       | - Fraud risk scoring    |
                             +------------+------------+
                                          |
                                          v
                             +-------------------------+
                             | 5. COMPOSITE SCORING    |
                             | - Quality Score (0-100) |
                             | - Fraud Score (0-100)   |
                             +------------+------------+
                                          |
                          +---------------+---------------+
                          |               |               |
                          v               v               v
                   +-----------+   +------------+   +-----------+
                   | AUTO-     |   | REVIEW     |   | AUTO-     |
                   | APPROVE   |   | QUEUE      |   | REJECT    |
                   | Fraud <21 |   | Fraud      |   | Fraud >=71|
                   | Qual >=70 |   | 21-70      |   +-----------+
                   +-----+-----+   +------+-----+
                         |                |
                         |                v
                         |   +-------------------------+
                         |   | 6. ADMIN REVIEW         |------> APPROVE
                         |   | - Photo + map + flags   |------> REJECT
                         |   | - Agent history check   |------> REQUEST RESUBMIT
                         |   | - Dedup comparison      |------> MERGE (dedup)
                         |   +-------------------------+
                         |                |
                         v                v
                   +---------------------------+
                   | 7. PUBLISH DELTA (Weekly)  |
                   | - Snapshot frozen (Friday) |
                   | - Delta = S(n) - S(n-1)   |
                   | - Z-score anomaly check    |
                   | - API + dashboard + report |
                   +---------------------------+
```

---

## SOP Steps

### Step 1: Capture (Field Agent)

- [ ] 1.1 Open the PWA and select the correct vertical from the 7 categories: `billboard`, `alcohol_outlet`, `census_proxy`, `fuel_station`, `mobile_money`, `pharmacy`, `transport_road`
- [ ] 1.2 Take a photo of the entity (storefront, kiosk, road segment, billboard face, building)
    - [ ] Use the device camera directly (not gallery upload) -- this preserves EXIF data
    - [ ] Ensure the entity name/signage is visible in the photo when possible
    - [ ] For `transport_road`: photograph the road condition or blockage, not just the surroundings
- [ ] 1.3 Wait for GPS lock (the app auto-captures coordinates)
    - [ ] GPS accuracy indicator should show green (<30m) or yellow (<100m)
    - [ ] Do NOT submit if GPS shows red (>100m) -- wait or move to open sky
- [ ] 1.4 Fill required fields (the app shows them via progressive disclosure)
    - [ ] Must-Have fields are marked with an asterisk (*)
    - [ ] Fill Nice-to-Have fields if time permits (see `workflow/06-eighty-twenty-focus.md`)
- [ ] 1.5 Submit -- the event is queued in IndexedDB for offline-first reliability
    - [ ] A GPS integrity report is silently collected (mock location check, sensor sample, network type)
    - [ ] The submission gets an idempotency key to prevent duplicates on retry

### Step 2: Client-Side Checks (Automatic, in PWA)

These run transparently before the submission is queued:

- [ ] 2.1 Mock location API check (Android `isMocked` flag -- Chrome 90+)
- [ ] 2.2 GPS accuracy sanity: flag if accuracy = 0 or < 1m on consumer device
- [ ] 2.3 Sensor data collection: 2-second accelerometer sample to verify physical movement
- [ ] 2.4 Network type recording (`wifi`, `4g`, `3g`, `2g`)
- [ ] 2.5 GPS timestamp vs device clock: flag if drift > 30 seconds

**Note:** Client-side checks are bypassable by a determined attacker. They raise the bar and collect signals for server-side analysis.

### Step 3: Upload / Sync (Automatic)

- [ ] 3.1 IndexedDB queue flushes when connectivity is available
- [ ] 3.2 Exponential backoff on failure (1s, 2s, 4s, 8s, max 60s)
- [ ] 3.3 Photo uploaded to Vercel Blob storage
- [ ] 3.4 Event written to `point_events` table (`CREATE_EVENT` or `ENRICH_EVENT`)
- [ ] 3.5 Idempotency key prevents duplicate writes on retry

### Step 4: Server-Side Validation (Automatic)

All checks run at submission time. Each check produces flags with severity levels (`info`, `warning`, `critical`).

#### 4a. GPS Validation Pipeline

- [ ] 4a.1 EXIF GPS vs submission GPS (threshold: 1km standard, 2km for low-end devices)
- [ ] 4a.2 IP geolocation vs submission GPS (threshold: 50km)
- [ ] 4a.3 Velocity check (time + distance since last submission by same agent):
    - `> 200 km/h` or `> 5km in < 2 min` --> **BLOCK** (auto-reject)
    - `> 80 km/h` --> **FLAG** (queue for review)
    - `<= 80 km/h` --> OK
- [ ] 4a.4 Geofence check: submission must fall within collection zone (Bonamoussadi: 4.0755--4.0999 N, 9.7185--9.7602 E)

#### 4b. Photo Validation Pipeline

- [ ] 4b.1 SHA-256 exact hash check: reject if same photo used for a DIFFERENT entity
- [ ] 4b.2 Perceptual hash (aHash): Hamming distance <= 5 on 64-bit hash = near-duplicate, flag for review
- [ ] 4b.3 EXIF fingerprint dedup: same device + capture time + GPS = flag
- [ ] 4b.4 Photo freshness: **> 7 days old = reject**; > 24 hours old = flag
- [ ] 4b.5 Screenshot detection: no EXIF + specific resolution patterns = flag

#### 4c. Entity Deduplication

- [ ] 4c.1 Proximity check: same vertical within dedup radius (default 25m; roads 50m)
- [ ] 4c.2 Name similarity check for same-vertical entities nearby
- [ ] 4c.3 If duplicate detected: route to merge workflow (not rejection)

#### 4d. Fraud Risk Scoring

Composite fraud risk score computed from 5 categories (see Section "Fraud Risk Score" below).

### Step 5: Composite Scoring

Two independent scores are computed for every submission:

#### A. Data Quality Confidence Score (0--100)

Measures how reliable a data point is. Updated with each event.

```
QUALITY SCORE FORMULA
======================

Factor               Weight    Scoring Rule
-----------------------------------------------------------------
Recency               25%      25 pts if <7d; 22 if <14d; 18 if <30d;
                               12 if <60d; 6 if <90d; 0 if older
Source Count           20%      20 pts if >=5 events; 15 if >=3;
                               10 if >=2; 5 if single observation
Photo Evidence         20%      10 pts primary photo + 5 pts secondary
                               photo + 5 pts if EXIF GPS validated
GPS Accuracy           15%      5 pts base (GPS present) + 5 pts if
                               photo GPS matches + 5 pts if IP matches
Reviewer Approval      10%      10 pts if admin approved; 3 pts if
                               >=2 events but unreviewed; 0 otherwise
Field Completeness     10%      (filled enrichable fields / total
                               enrichable fields) * 10

TOTAL = sum of all factors, clamped to 0-100
```

**Score thresholds:**

| Score | Label | Action |
|:---:|---|---|
| 80--100 | HIGH CONFIDENCE | Auto-publish, no review needed |
| 60--79 | GOOD | Publish, review within 72h |
| 40--59 | MODERATE | Publish with caveat, review within 48h |
| 20--39 | LOW | Do NOT publish; queue for review |
| 0--19 | VERY LOW | Flag for investigation; possible fraud |

#### B. Fraud Risk Score (0--100)

Measures how likely a submission is fraudulent. Computed at submission time.

```
FRAUD RISK SCORE FORMULA
==========================

Category              Weight    Signals
-----------------------------------------------------------------
GPS Integrity          25%      Inverted GPS confidence score
                               (100 - GPS_CONFIDENCE). Factors:
                               mock location, EXIF mismatch,
                               IP mismatch, velocity, sensors
Photo Integrity        25%      SHA-256 exact duplicate check,
                               perceptual hash (aHash, dist <=5),
                               EXIF fingerprint match, photo
                               freshness (>7d = max risk),
                               screenshot detection
Temporal Consistency   15%      Velocity (>200 km/h = block),
                               time-of-day plausibility,
                               offline batch anomaly analysis
Agent History          20%      Account age, prior fraud flags,
                               prior rejections, trust tier
                               (new / established / veteran),
                               consecutive clean submissions
Behavioral Patterns    15%      Self-enrichment ratio, device
                               sharing across accounts,
                               category distribution anomalies,
                               IP reputation (VPN/datacenter)

TOTAL = weighted sum, clamped to 0-100
```

### Step 6: Auto-Routing Decision

The combination of Fraud Risk Score and Quality Score determines the routing action:

| Fraud Risk Score | Quality Score | Route | XP Action |
|:---:|:---:|---|---|
| 0--20 | >= 70 | **Auto-approve** | Award XP immediately |
| 0--20 | 40--69 | **Soft review** (admin reviews within 48h) | XP held in escrow |
| 21--50 | Any | **Soft review** (admin reviews within 48h) | XP held in escrow |
| 51--70 | Any | **Hard review** (admin must investigate) | XP denied until cleared |
| 71--100 | Any | **Auto-reject** | XP denied |

### Step 7: Admin Review Queue Workflow

#### 7.1 Daily Triage (9:00 AM WAT)

- [ ] Sort the review queue by fraud risk score, highest first
- [ ] Auto-rejected items: verify the log entry, archive (no further action)
- [ ] Auto-approved items: verify the log entry, publish (no further action)
- [ ] **Hard review** items: investigate immediately (see 7.2)
- [ ] **Soft review** items: batch-review after all hard reviews are complete

#### 7.2 Investigation (Per Flagged Submission)

- [ ] View side-by-side: submitted photo | map with GPS pin | submission data | fraud flags
- [ ] Check EXIF metadata panel: capture timestamp, device make/model, GPS coordinates
- [ ] Compare with nearby existing POIs (dedup check -- same name? same photo?)
- [ ] Review agent history: recent submissions, trust score, prior flags, rejection count
- [ ] If GPS flag: does the photo content match the Bonamoussadi neighborhood?
- [ ] If photo flag: compare the flagged photo with the matched photo(s)

#### 7.3 Decision

| Decision | Effect | Agent Impact |
|---|---|---|
| **APPROVE** | Submission enters published dataset | XP released; trust score maintained |
| **REJECT** | Submission archived permanently | XP denied; agent notified with reason; trust score reduced |
| **REQUEST RE-SUBMISSION** | Agent asked to revisit and re-capture | XP held; agent sees specific re-capture instructions |
| **MERGE** | Duplicate submission merged with existing POI as enrichment | Partial XP awarded for enrichment contribution |

#### 7.4 Agent Feedback Loop

- [ ] Rejection reason communicated to the agent via in-app notification
- [ ] Repeated rejections trigger automatic trust score reduction
- [ ] **3 or more confirmed fraud incidents** = agent suspension pending investigation
- [ ] Agents can appeal rejections through the team lead

---

## Spot-Check Audit Protocol

Physical field verification of published data accuracy, conducted independently of the agents who submitted the data.

### Schedule

| Week | Sample Size | Scope |
|:---:|:---:|---|
| Week 3 | 10 random POIs | Initial calibration -- check basic accuracy |
| Week 4 | 10 different random POIs | Expand sample; different zones |
| Week 5 | 15 random POIs | Broader coverage; all active verticals |
| Week 6 | 50 POIs | Comprehensive audit across all verticals and zones |

**Executor:** Field Team Lead (must be independent of the agents who submitted the data being audited)

### Per-POI Audit Checklist

For each audited POI:

- [ ] 1. Navigate to the GPS coordinates recorded in the submission
- [ ] 2. **EXISTENCE:** Does the entity physically exist at this location? (Y / N)
- [ ] 3. **NAME:** Does the name match what was submitted? (Y / N / Close)
- [ ] 4. **CATEGORY:** Is the vertical classification correct? (Y / N)
- [ ] 5. **STATUS:** Is the operating status correct (open/closed/blocked)? (Y / N)
- [ ] 6. **PHOTO:** Does the submission photo match what you see? (Y / N)
- [ ] 7. Take an independent verification photo
- [ ] 8. Note any discrepancies in the audit log

### Scoring

| Result | Criteria | Interpretation |
|---|---|---|
| **MATCH** | All 5 criteria verified (existence, name, category, status, photo) | Data point is reliable |
| **PARTIAL** | 3--4 criteria match | Acceptable; may need enrichment event |
| **MISMATCH** | Fewer than 3 criteria match | Data quality failure; investigate root cause |

### Accuracy Thresholds

```
Audit Accuracy = (MATCH + PARTIAL) / Total Audited * 100

Week 3:          >= 80% required
Week 4-5:        >= 85% required
Week 6:          >= 85% required (comprehensive)

CIRCUIT BREAKER: If accuracy drops below 70%:
  --> PAUSE all collection
  --> Retrain agents
  --> Investigate root cause (fraud? training gap? UX confusion?)
  --> Resume only after remediation
```

---

## Publication Criteria

A data point is published (made available to clients via API/dashboard) when ALL of the following are true:

### Standard Publication

- [ ] Data Quality Confidence Score >= 40
- [ ] Fraud Risk Score < 71 (not auto-rejected)
- [ ] Admin review status is `approved` or `auto-approved`
- [ ] Photo evidence is present
- [ ] GPS coordinates are within the designated collection zone
- [ ] At least one required field per vertical is populated

### Premium / High-Confidence Publication

All standard criteria, PLUS:

- [ ] Data Quality Confidence Score >= 70
- [ ] Fraud Risk Score < 21
- [ ] Photo has EXIF GPS matching submission GPS (within 1km)
- [ ] At least one spot-check audit has verified this POI (or same-vertical POIs in same zone)
- [ ] At least one enrichment event exists (data confirmed by multiple sources)

### Delta Publication Cadence

- Weekly snapshot frozen every **Friday at 23:59 WAT** (Vercel Cron)
- Delta computed: new POIs, changed fields, removed/closed entities
- Z-score anomaly detection flags statistical outliers for manual review before publication
- Delta published to API endpoint: `/api/deltas?snapshot=S{n}`
- Client notifications sent for subscribed verticals/zones
- During rainy season (June--October): `transport_road` deltas computed **daily**

---

## Vertical-Specific Field Schemas

For the exact field definitions, required fields, and enrichable fields per vertical, refer to:

```
docs/vertical-delta-templates/
```

The 7 canonical verticals and their key schemas:

| Vertical | Required on Create | Key Enrichable Fields |
|---|---|---|
| `billboard` | name | billboardType, isOccupied, advertiserBrand, condition, size |
| `alcohol_outlet` | name | outletType, isFormal, brandsAvailable, priceRange, openingHours |
| `census_proxy` | buildingType, occupancyStatus | storeyCount, estimatedUnits, hasElectricity, constructionMaterial |
| `fuel_station` | name, hasFuelAvailable | fuelTypes, pricesByFuel, quality, queueLength, paymentMethods |
| `mobile_money` | providers | merchantIdByProvider, isActive, hasFloat, agentType, openingHours |
| `pharmacy` | name, isOpenNow | isOnDuty, isLicensed, hasPrescriptionService, medicineCategories |
| `transport_road` | roadName, condition | isBlocked, blockageType, surfaceType, passableBy, trafficLevel |

---

## Sources

This document synthesizes and operationalizes content from the following research deliverables:

- `research/10-FINAL-STRATEGY-synthesis.md` -- Section 7 (Validation SOP): end-to-end data flow, confidence scoring formula, fraud detection checkpoints, auto-routing rules, review workflow, spot-check audit protocol, publication criteria
- `research/02-system-design-collection-workflow.md` -- Section 6 (Data Quality Scoring): confidence score factors and weights, score computation formula with exact code, score thresholds, score lifecycle and decay, integration points in codebase
- `research/06-fraud-specialist-anti-fraud.md` -- GPS spoofing detection pipeline (multi-layer architecture), GPS confidence scoring formula with deductions/bonuses, duplicate detection (SHA-256, perceptual hash, EXIF fingerprint), velocity thresholds (Douala-specific: 80 km/h flag, 200 km/h block), fraud threat categorization matrix
