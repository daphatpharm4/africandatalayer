# ADL Anti-Fraud Controls: Comprehensive Detection, Scoring, and Operations Framework
## Bonamoussadi, Douala, Cameroon

**Teammate 6 -- Fraud Specialist Deliverable**
**Date:** March 2026

---

## Table of Contents

1. [Fraud Threat Landscape](#1-fraud-threat-landscape)
2. [GPS Spoofing Detection](#2-gps-spoofing-detection)
3. [Duplicate Detection](#3-duplicate-detection)
4. [Timestamp and Photo Validation](#4-timestamp-and-photo-validation)
5. [Confidence Scoring Model](#5-confidence-scoring-model)
6. [Anti-Fraud Operations](#6-anti-fraud-operations)
7. [Incentive Design](#7-incentive-design)

---

## Relationship to Prior Deliverables

This document builds directly on work from Teammates 1-5:

- **Teammate 1 (Local Context):** Informed the fraud risk calibration. Bonamoussadi's middle-class character, ~560 registered businesses, high mobile money kiosk density (100-200 agents), and seasonal flooding patterns all shape what "normal" agent behavior looks like versus anomalous patterns.
- **Teammate 2 (System Design):** The confidence score system defined in Section 6 of the system design (recency 25%, sourceCount 20%, photoEvidence 20%, gpsAccuracy 15%, reviewerApproval 10%, fieldCompleteness 10%) is the foundation. This document extends it with a dedicated **fraud risk score** that feeds into the confidence score as a penalty factor. The event-sourced `point_events` model, `SubmissionFraudCheck` interface, and `ProjectedPoint` projection engine are all preserved and extended.
- **Teammate 5 (Cybersecurity):** The threat model (T4: GPS Spoofing at risk 16/25, T2: Agent Impersonation at 12/25) and the existing `submissionFraud.ts` implementation (EXIF extraction, haversine distance, IP geolocation) are the starting point. This document fills the gaps identified by Teammate 5: no velocity limiting, no photo deduplication, no user trust scoring, no temporal analysis, no duplicate POI detection, no device fingerprint cross-referencing, no field plausibility validation, and XP awarded before validation.
- **Existing Fraud Strategy (docs/team/05-fraud-strategy.md):** The fraud scenario catalog (F-FAB-01 through F-POI-02), detection rules (R-VEL-01 through R-GRA-01), risk scoring model (LocationRisk, PhotoRisk, TemporalRisk, UserRisk, BehavioralRisk), response playbooks (P-FAB through P-POI), and false positive minimization strategies are all incorporated and operationalized here.
- **Database Migration (20260305_fraud_analytics_foundation.sql):** The `submission_image_hashes`, `device_user_map`, `fraud_audit_log`, `admin_reviews`, and `analytics_weekly` tables plus materialized views (`mv_point_summary`, `mv_user_activity`, `mv_daily_stats`) are assumed to be deployed.

Where prior documents define *what* to detect, this document defines *how* to detect it at the algorithmic level, with pseudocode, formulas, decision trees, and operational procedures.

---

## 1. Fraud Threat Landscape

### 1.1 Threat Categorization Matrix

#### Agent-Side Fraud

| ID | Threat | Motivation | Method | Detection Difficulty | Business Impact | Likelihood |
|---|---|---|---|---|---|---|
| A1 | **Fabricated Submissions** | Earn XP (5 pts per CREATE_EVENT) without fieldwork | Submit plausible details + random storefront photo with GPS inside Bonamoussadi geofence (4.0755-4.0999 lat, 9.7185-9.76 lng) | High -- current system only validates field presence and geofence | **Critical** -- phantom POIs route users to nonexistent locations | High |
| A2 | **Duplicate Entries** | Multiply XP from a single visit; drip-feed enrichments | Create a POI, then submit ENRICH_EVENTs for each gap field individually (pharmacy has 3 enrichable fields = 4 submissions = 20 XP from one location) | Low -- temporal clustering of same userId/pointId is visible | Medium -- inflates contribution counts, may or may not corrupt data | High |
| A3 | **GPS Spoofing** | Submit from home without visiting locations | Use Fake GPS / Mock Locations app on Android; navigator.geolocation returns spoofed coords; if photo lacks EXIF GPS (common on feature phones), the cross-check produces null | Medium -- IP geolocation helps but VPN defeats it; current 50km IP threshold is too coarse | **Critical** -- fundamentally undermines ground-truth value proposition | High |
| A4 | **Recycled / Stock Photos** | Avoid fieldwork; reuse one trip's photos across many submissions | Take one photo, submit as evidence for multiple POIs at slightly different coordinates; or download storefronts from Google Maps | Medium -- identical EXIF data across submissions is detectable, but stripped EXIF (screenshots/downloads) bypasses this | High -- multiple fake POIs backed by seemingly legitimate evidence | High |
| A5 | **Collusion Between Agents** | Collectively inflate XP; dominate leaderboard for rewards | User A creates POI, User B enriches, User C enriches further; reverse roles; timed to avoid velocity flags | High -- individual patterns look normal; requires graph analysis of user-to-user and user-to-point relationships | High -- coordinated fraud at scale corrupts both data and incentive structure | Medium |
| A6 | **Ghost Entities** | Create fictional businesses to pad submission counts | Fabricate business names, take photo of blank wall or unrelated storefront, assign plausible attributes | High -- without ground-truth cross-reference, a well-crafted ghost entity is indistinguishable from a real one | **Critical** -- dataset pollution; downstream consumers route users to nonexistent locations | Medium |
| A7 | **Alt Account Farming** | Multiply XP, dominate multiple leaderboard slots, circumvent per-account limits | Register with different emails; current auth has no device-binding or phone verification; `deviceId` stored in localStorage is clearable | Medium -- same deviceId across userIds is a strong signal; same IP and device fingerprint also signals alt farming | High -- undermines one-person-one-account assumption | Medium |
| A8 | **AI-Generated Photos** | Scale fabrication without physical presence | Generate pharmacy/kiosk images using diffusion models; no EXIF data; submit with fabricated coordinates within geofence | High -- AI images lack EXIF but so do many legitimate feature phone photos | **Critical** -- at scale, floods dataset with convincing but fictional POIs | Low (rising) |

#### System-Side Fraud

| ID | Threat | Motivation | Method | Detection Difficulty | Business Impact | Likelihood |
|---|---|---|---|---|---|---|
| S1 | **Data Manipulation by Insiders** | Financial gain (sell data), sabotage, or cover up agent fraud | Admin with Neon PostgreSQL access directly modifies `point_events` rows; bypasses event-sourced append-only model | Medium -- event-sourced model creates audit trail but direct DB access bypasses it; no dedicated security audit log exists | **Critical** -- corrupts the trusted dataset; damages all client relationships | Low |
| S2 | **Unauthorized Bulk Exports** | Sell dataset to competitors; personal profit | Authenticated user queries `/api/submissions GET` without pagination limits; extracts entire Bonamoussadi dataset | Medium -- any authenticated user can query; no per-user export throttling beyond Vercel defaults | High -- competitor gains ADL data product without paying | Medium |
| S3 | **Admin Approval Fraud** | Corrupt admin approves fraudulent submissions to benefit a specific agent | Admin marks fabricated submissions as "approved" in `admin_reviews` table; inflates agent's trust score and XP | High -- requires monitoring admin approval patterns; currently no admin action logging | High -- fraudulent data enters the published dataset with "admin approved" stamp | Low |

#### Client-Side Fraud

| ID | Threat | Motivation | Method | Detection Difficulty | Business Impact | Likelihood |
|---|---|---|---|---|---|---|
| C1 | **Misrepresentation of Data Quality** | Oversell to close deals; inflate perceived coverage | Present low-confidence data (score 30-50) as verified ground-truth to clients; cherry-pick high-quality samples while omitting data gaps | Medium -- requires comparing what was delivered versus actual dataset quality | **Critical** -- client discovers reality, destroys trust, demands refunds, shares negative reviews | Low |
| C2 | **Selective Data Delivery** | Hide unfavorable data from specific clients | Exclude data points that show a client's competitor in a favorable light; or exclude points that reveal regulatory violations for a client's business | High -- requires intent analysis; difficult to distinguish from legitimate data filtering | High -- creates legal and ethical liability | Very Low |

### 1.2 Risk Heat Map

```
                    BUSINESS IMPACT
                    Low    Med    High   Critical
              ┌──────┬──────┬──────┬──────┐
    High      │      │  A2  │ A4,  │ A1,  │
              │      │      │ A5,  │ A3   │
              │      │      │ A7   │      │
    LIKELIHOOD├──────┼──────┼──────┼──────┤
    Medium    │      │      │ S2   │ A6,  │
              │      │      │      │ S1   │
              ├──────┼──────┼──────┼──────┤
    Low       │      │      │ S3   │ A8,  │
              │      │      │      │ C1   │
              └──────┴──────┴──────┴──────┘
```

**Priority Order for Controls:**
1. A1 + A3 (Fabrication + GPS Spoofing) -- Critical impact, High likelihood
2. A4 (Recycled Photos) -- High impact, High likelihood
3. A6 (Ghost Entities) -- Critical impact, Medium likelihood
4. A2 (Duplicate Entries) -- Medium impact, High likelihood, Low detection difficulty
5. A5 + A7 (Collusion + Alt Accounts) -- High impact, Medium likelihood
6. S1 + S2 (Insider threats) -- Critical/High impact, Low/Medium likelihood
7. A8 (AI Photos) -- Critical impact but Low current likelihood

---

## 2. GPS Spoofing Detection

### 2.1 Multi-Layered Detection Architecture

GPS spoofing is ADL's highest-priority fraud vector (Teammate 5's T4: risk score 16/25). The current system checks EXIF GPS against submission GPS (1km threshold) and IP geolocation (50km threshold), but this is insufficient. The following multi-layered system addresses the gaps.

```
GPS SPOOFING DETECTION PIPELINE
================================

Layer 1: CLIENT-SIDE CHECKS (in PWA before submission)
  ├── Mock location API detection
  ├── Sensor data consistency (accelerometer, gyroscope)
  ├── GPS accuracy metadata capture
  └── Network type recording

Layer 2: SERVER-SIDE CHECKS (at submission time)
  ├── EXIF GPS vs submission GPS (existing, 1km threshold)
  ├── IP geolocation vs submission GPS (existing, 50km threshold)
  ├── Velocity analysis (impossible travel between submissions)
  ├── Cell tower / network type consistency
  └── Known location database cross-reference

Layer 3: STATISTICAL ANALYSIS (batch, post-submission)
  ├── Agent movement pattern modeling
  ├── Impossible travel detection across sessions
  ├── GPS coordinate clustering analysis
  ├── Precision anomaly detection
  └── Collusion pattern detection

Output: GPS Confidence Score (0-100)
```

### 2.2 Layer 1: Client-Side Checks

These checks run in the PWA before submission. They cannot prevent a determined attacker (client-side checks are bypassable) but they raise the bar and collect signals for server-side analysis.

```typescript
// lib/client/gpsIntegrity.ts

interface GpsIntegrityReport {
  // Mock location detection
  mockLocationDetected: boolean;
  mockLocationMethod: string | null;

  // Sensor consistency
  hasAccelerometerData: boolean;
  hasGyroscopeData: boolean;
  accelerometerSampleCount: number;
  motionDetectedDuringCapture: boolean;

  // GPS metadata
  gpsAccuracyMeters: number | null;
  gpsProvider: string | null;  // 'gps' | 'network' | 'fused' | 'unknown'
  gpsSatelliteCount: number | null;
  gpsAltitudeMeters: number | null;
  gpsSpeedMps: number | null;
  gpsHeading: number | null;

  // Network context
  networkType: string | null;  // 'wifi' | '4g' | '3g' | '2g' | 'unknown'
  wifiSSID: string | null;     // if on wifi (may be null due to permissions)

  // Timestamps
  gpsTimestamp: number;        // from Position.timestamp
  deviceTimestamp: number;     // Date.now() at capture
  timeDeltaMs: number;         // |gpsTimestamp - deviceTimestamp|
}

async function collectGpsIntegrity(
  position: GeolocationPosition
): Promise<GpsIntegrityReport> {
  const report: GpsIntegrityReport = {
    mockLocationDetected: false,
    mockLocationMethod: null,
    hasAccelerometerData: false,
    hasGyroscopeData: false,
    accelerometerSampleCount: 0,
    motionDetectedDuringCapture: false,
    gpsAccuracyMeters: position.coords.accuracy ?? null,
    gpsProvider: null,
    gpsSatelliteCount: null,
    gpsAltitudeMeters: position.coords.altitude ?? null,
    gpsSpeedMps: position.coords.speed ?? null,
    gpsHeading: position.coords.heading ?? null,
    networkType: null,
    wifiSSID: null,
    gpsTimestamp: position.timestamp,
    deviceTimestamp: Date.now(),
    timeDeltaMs: Math.abs(Date.now() - position.timestamp),
  };

  // ── MOCK LOCATION DETECTION ──
  // Android exposes Position.isMocked in some browsers (Chrome 90+)
  // This is the strongest client-side signal
  const coords = position.coords as GeolocationCoordinates & {
    isMocked?: boolean;
  };
  if (coords.isMocked === true) {
    report.mockLocationDetected = true;
    report.mockLocationMethod = 'Position.isMocked API';
  }

  // Suspiciously perfect coordinates (exact to 6+ decimal places
  // with no trailing noise) suggest programmatic generation
  const latStr = position.coords.latitude.toString();
  const lonStr = position.coords.longitude.toString();
  const latDecimals = latStr.includes('.') ? latStr.split('.')[1].length : 0;
  const lonDecimals = lonStr.includes('.') ? lonStr.split('.')[1].length : 0;
  if (latDecimals <= 4 && lonDecimals <= 4 && position.coords.accuracy === 0) {
    report.mockLocationDetected = true;
    report.mockLocationMethod = 'Suspiciously low precision with zero accuracy';
  }

  // GPS accuracy of exactly 0 or exactly 1 meter is unrealistic
  // for consumer Android phones (typical: 3-30m)
  if (position.coords.accuracy !== null &&
      position.coords.accuracy !== undefined &&
      position.coords.accuracy < 1) {
    report.mockLocationDetected = true;
    report.mockLocationMethod = 'Sub-meter accuracy on consumer device';
  }

  // ── SENSOR DATA COLLECTION ──
  // Collect 2 seconds of accelerometer data to verify physical movement
  try {
    const sensorData = await collectSensorData(2000);
    report.hasAccelerometerData = sensorData.hasAccelerometer;
    report.hasGyroscopeData = sensorData.hasGyroscope;
    report.accelerometerSampleCount = sensorData.sampleCount;
    report.motionDetectedDuringCapture = sensorData.motionDetected;
  } catch {
    // Sensor API not available -- common on low-end phones
    // Not a fraud signal by itself
  }

  // ── NETWORK TYPE ──
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; type?: string };
  }).connection;
  if (connection) {
    report.networkType = connection.effectiveType ?? connection.type ?? 'unknown';
  }

  return report;
}

interface SensorSample {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

async function collectSensorData(durationMs: number): Promise<{
  hasAccelerometer: boolean;
  hasGyroscope: boolean;
  sampleCount: number;
  motionDetected: boolean;
}> {
  return new Promise((resolve) => {
    const samples: SensorSample[] = [];
    let hasAccel = false;
    let hasGyro = false;

    const handler = (event: DeviceMotionEvent) => {
      if (event.accelerationIncludingGravity) {
        hasAccel = true;
        samples.push({
          x: event.accelerationIncludingGravity.x ?? 0,
          y: event.accelerationIncludingGravity.y ?? 0,
          z: event.accelerationIncludingGravity.z ?? 0,
          timestamp: Date.now(),
        });
      }
      if (event.rotationRate) {
        hasGyro = true;
      }
    };

    window.addEventListener('devicemotion', handler);

    setTimeout(() => {
      window.removeEventListener('devicemotion', handler);

      // Motion detection: check if accelerometer values vary
      // A stationary spoofed device will show near-constant values
      // A device being carried shows natural micro-vibrations
      let motionDetected = false;
      if (samples.length >= 5) {
        const xValues = samples.map(s => s.x);
        const variance = computeVariance(xValues);
        // Walking produces variance > 0.1 m/s^2
        // A phone on a desk: variance ~0.01-0.05
        // Spoofed/emulator: variance ~0 or exactly constant
        motionDetected = variance > 0.05;
      }

      resolve({
        hasAccelerometer: hasAccel,
        hasGyroscope: hasGyro,
        sampleCount: samples.length,
        motionDetected,
      });
    }, durationMs);
  });
}

function computeVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => (v - mean) ** 2);
  return squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);
}
```

### 2.3 Layer 2: Server-Side Checks

```typescript
// lib/server/gpsValidation.ts

interface GpsValidationResult {
  gpsConfidenceScore: number;  // 0-100
  flags: GpsFlag[];
  velocityCheckResult: 'ok' | 'flag' | 'block';
  ipMatchResult: 'match' | 'mismatch' | 'unknown';
  exifMatchResult: 'match' | 'mismatch' | 'no_exif';
  mockLocationResult: 'clean' | 'detected' | 'unknown';
}

interface GpsFlag {
  rule: string;
  severity: 'info' | 'warning' | 'critical';
  detail: string;
}

async function validateGps(params: {
  userId: string;
  submissionLocation: SubmissionLocation;
  submissionTime: Date;
  photoExifGps: SubmissionLocation | null;
  ipLocation: SubmissionLocation | null;
  clientGpsIntegrity: GpsIntegrityReport | null;
  isLowEndDevice: boolean;
}): Promise<GpsValidationResult> {
  const flags: GpsFlag[] = [];
  let score = 100;  // Start at 100, deduct for issues

  // ── CHECK 1: Mock location from client report ──
  let mockLocationResult: 'clean' | 'detected' | 'unknown' = 'unknown';
  if (params.clientGpsIntegrity) {
    if (params.clientGpsIntegrity.mockLocationDetected) {
      mockLocationResult = 'detected';
      score -= 50;
      flags.push({
        rule: 'GPS_MOCK_DETECTED',
        severity: 'critical',
        detail: `Mock location detected via: ${params.clientGpsIntegrity.mockLocationMethod}`,
      });
    } else {
      mockLocationResult = 'clean';
    }

    // GPS accuracy sanity check
    const accuracy = params.clientGpsIntegrity.gpsAccuracyMeters;
    if (accuracy !== null) {
      if (accuracy > 100 && !params.isLowEndDevice) {
        score -= 10;
        flags.push({
          rule: 'GPS_LOW_ACCURACY',
          severity: 'warning',
          detail: `GPS accuracy ${accuracy}m exceeds 100m threshold`,
        });
      }
      if (accuracy === 0) {
        score -= 20;
        flags.push({
          rule: 'GPS_ZERO_ACCURACY',
          severity: 'critical',
          detail: 'GPS accuracy reported as 0 -- likely spoofed',
        });
      }
    }

    // GPS timestamp vs device timestamp divergence
    if (params.clientGpsIntegrity.timeDeltaMs > 30000) {
      score -= 10;
      flags.push({
        rule: 'GPS_TIME_DRIFT',
        severity: 'warning',
        detail: `GPS timestamp and device clock differ by ${Math.round(params.clientGpsIntegrity.timeDeltaMs / 1000)}s`,
      });
    }

    // No sensor data on a modern device is suspicious
    if (!params.clientGpsIntegrity.hasAccelerometerData &&
        !params.isLowEndDevice) {
      score -= 5;
      flags.push({
        rule: 'GPS_NO_SENSORS',
        severity: 'info',
        detail: 'No accelerometer data available -- possible emulator',
      });
    }

    // No motion during capture
    if (params.clientGpsIntegrity.hasAccelerometerData &&
        !params.clientGpsIntegrity.motionDetectedDuringCapture &&
        params.clientGpsIntegrity.accelerometerSampleCount >= 10) {
      score -= 5;
      flags.push({
        rule: 'GPS_NO_MOTION',
        severity: 'info',
        detail: 'No physical motion detected during GPS capture',
      });
    }
  } else {
    // No GPS integrity report at all
    score -= 5;
  }

  // ── CHECK 2: EXIF GPS cross-validation (existing logic, extended) ──
  let exifMatchResult: 'match' | 'mismatch' | 'no_exif' = 'no_exif';
  if (params.photoExifGps) {
    const threshold = params.isLowEndDevice ? 2.0 : 1.0; // km
    const dist = haversineKm(params.submissionLocation, params.photoExifGps);
    if (dist <= threshold) {
      exifMatchResult = 'match';
      // Bonus for matching
      score = Math.min(100, score + 5);
    } else {
      exifMatchResult = 'mismatch';
      score -= 30;
      flags.push({
        rule: 'GPS_EXIF_MISMATCH',
        severity: 'critical',
        detail: `Photo EXIF GPS is ${dist.toFixed(2)}km from submission GPS (threshold: ${threshold}km)`,
      });
    }
  } else {
    // No EXIF GPS -- penalize but less for low-end devices
    score -= params.isLowEndDevice ? 5 : 15;
    flags.push({
      rule: 'GPS_NO_EXIF',
      severity: params.isLowEndDevice ? 'info' : 'warning',
      detail: 'Photo has no EXIF GPS data',
    });
  }

  // ── CHECK 3: IP geolocation cross-validation ──
  let ipMatchResult: 'match' | 'mismatch' | 'unknown' = 'unknown';
  if (params.ipLocation) {
    const ipDist = haversineKm(params.ipLocation, params.submissionLocation);
    if (ipDist <= 50) {
      ipMatchResult = 'match';
    } else {
      ipMatchResult = 'mismatch';
      score -= 15;
      flags.push({
        rule: 'GPS_IP_MISMATCH',
        severity: 'warning',
        detail: `IP geolocates ${ipDist.toFixed(0)}km from submission GPS`,
      });
    }
  }

  // ── CHECK 4: Velocity / impossible travel ──
  const velocityResult = await checkVelocity(
    params.userId,
    params.submissionLocation,
    params.submissionTime
  );
  if (velocityResult === 'block') {
    score -= 40;
    flags.push({
      rule: 'GPS_IMPOSSIBLE_TRAVEL',
      severity: 'critical',
      detail: 'Physically impossible speed between consecutive submissions',
    });
  } else if (velocityResult === 'flag') {
    score -= 15;
    flags.push({
      rule: 'GPS_HIGH_VELOCITY',
      severity: 'warning',
      detail: 'Unusually high speed between consecutive submissions',
    });
  }

  return {
    gpsConfidenceScore: Math.max(0, Math.min(100, score)),
    flags,
    velocityCheckResult: velocityResult,
    ipMatchResult,
    exifMatchResult,
    mockLocationResult,
  };
}

// Velocity check with Douala-specific thresholds
async function checkVelocity(
  userId: string,
  currentLocation: SubmissionLocation,
  currentTime: Date
): Promise<'ok' | 'flag' | 'block'> {
  // Fetch the user's last 5 submissions ordered by time
  const recentSubmissions = await getRecentSubmissionsByUser(userId, 5);
  if (recentSubmissions.length === 0) return 'ok';

  const last = recentSubmissions[0];
  const distKm = haversineKm(last.location, currentLocation);
  const timeHours = (currentTime.getTime() - new Date(last.createdAt).getTime()) / 3600000;

  if (timeHours <= 0 && distKm > 0.05) return 'block';
  if (timeHours <= 0) return 'ok';

  const speedKmh = distKm / timeHours;

  // Douala speed thresholds:
  //   Walking: ~5 km/h
  //   Moto-taxi in traffic: ~20-30 km/h
  //   Car on highway: ~60-80 km/h
  //   Maximum reasonable in Douala: 80 km/h (traffic is severe)
  //   Physically impossible: >200 km/h (no highway, no rail)
  if (speedKmh > 200) return 'block';
  if (speedKmh > 80) return 'flag';

  // Also check: >5km apart within 2 minutes
  if (distKm > 5 && timeHours < (2 / 60)) return 'block';

  return 'ok';
}
```

### 2.4 Layer 3: Statistical Anomaly Detection (Batch)

```typescript
// lib/server/gpsAnomalyDetection.ts
// Runs as a scheduled job (daily via Vercel Cron)

interface AgentMovementProfile {
  userId: string;
  totalSubmissions: number;
  uniqueLocations: number;
  averageDistanceBetweenSubmissionsKm: number;
  maxDistanceBetweenConsecutiveSubmissionsKm: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  clusterCount: number;           // Number of distinct location clusters
  primaryClusterCentroid: SubmissionLocation | null;
  submissionRadiusKm: number;     // 95th percentile distance from centroid
  precisionDistribution: {
    exactFourDecimals: number;    // Suspiciously round coordinates
    fiveOrMoreDecimals: number;   // Normal GPS precision
  };
  anomalyFlags: string[];
}

async function analyzeAgentMovementPatterns(
  userId: string,
  windowDays: number = 30
): Promise<AgentMovementProfile> {
  const submissions = await getSubmissionsByUserInWindow(userId, windowDays);
  const profile: AgentMovementProfile = {
    userId,
    totalSubmissions: submissions.length,
    uniqueLocations: 0,
    averageDistanceBetweenSubmissionsKm: 0,
    maxDistanceBetweenConsecutiveSubmissionsKm: 0,
    averageSpeedKmh: 0,
    maxSpeedKmh: 0,
    clusterCount: 0,
    primaryClusterCentroid: null,
    submissionRadiusKm: 0,
    precisionDistribution: { exactFourDecimals: 0, fiveOrMoreDecimals: 0 },
    anomalyFlags: [],
  };

  if (submissions.length < 3) return profile;

  // ── COORDINATE PRECISION ANALYSIS ──
  // Spoofing apps often generate coordinates with suspiciously
  // uniform precision (e.g., always exactly 6 decimal places)
  // or suspiciously round values (4 decimal places = ~11m precision)
  for (const sub of submissions) {
    const latStr = sub.latitude.toString();
    const lonStr = sub.longitude.toString();
    const latDecimals = latStr.includes('.') ? latStr.split('.')[1].replace(/0+$/, '').length : 0;
    const lonDecimals = lonStr.includes('.') ? lonStr.split('.')[1].replace(/0+$/, '').length : 0;
    if (latDecimals <= 4 && lonDecimals <= 4) {
      profile.precisionDistribution.exactFourDecimals++;
    } else {
      profile.precisionDistribution.fiveOrMoreDecimals++;
    }
  }

  // Flag: >80% of coordinates have suspiciously low precision
  const lowPrecisionRatio = profile.precisionDistribution.exactFourDecimals / submissions.length;
  if (lowPrecisionRatio > 0.8 && submissions.length >= 10) {
    profile.anomalyFlags.push('PRECISION_ANOMALY: >80% of GPS coordinates have <=4 decimal places');
  }

  // ── CONSECUTIVE DISTANCE AND SPEED ANALYSIS ──
  const sortedByTime = [...submissions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const distances: number[] = [];
  const speeds: number[] = [];

  for (let i = 1; i < sortedByTime.length; i++) {
    const dist = haversineKm(
      { latitude: sortedByTime[i - 1].latitude, longitude: sortedByTime[i - 1].longitude },
      { latitude: sortedByTime[i].latitude, longitude: sortedByTime[i].longitude }
    );
    distances.push(dist);

    const timeH = (new Date(sortedByTime[i].createdAt).getTime() -
                   new Date(sortedByTime[i - 1].createdAt).getTime()) / 3600000;
    if (timeH > 0) {
      speeds.push(dist / timeH);
    }
  }

  profile.averageDistanceBetweenSubmissionsKm =
    distances.reduce((a, b) => a + b, 0) / distances.length;
  profile.maxDistanceBetweenConsecutiveSubmissionsKm = Math.max(...distances);

  if (speeds.length > 0) {
    profile.averageSpeedKmh = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    profile.maxSpeedKmh = Math.max(...speeds);
  }

  // Flag: impossible max speed
  if (profile.maxSpeedKmh > 200) {
    profile.anomalyFlags.push(
      `IMPOSSIBLE_TRAVEL: Max speed ${profile.maxSpeedKmh.toFixed(0)} km/h`
    );
  }

  // ── LOCATION CLUSTERING (Simple DBSCAN-like) ──
  // Cluster submissions within 200m of each other
  const clusters = clusterLocations(
    sortedByTime.map(s => ({ latitude: s.latitude, longitude: s.longitude })),
    0.2 // 200m cluster radius in km
  );
  profile.clusterCount = clusters.length;

  // Unique locations: clusters + unclustered points
  const uniqueSet = new Set(
    sortedByTime.map(s => `${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`)
  );
  profile.uniqueLocations = uniqueSet.size;

  // Flag: very few unique locations relative to submissions
  if (submissions.length >= 10 && profile.uniqueLocations < submissions.length * 0.3) {
    profile.anomalyFlags.push(
      `LOW_LOCATION_DIVERSITY: ${profile.uniqueLocations} unique locations for ${submissions.length} submissions`
    );
  }

  // Primary cluster centroid
  if (clusters.length > 0) {
    const largest = clusters.sort((a, b) => b.length - a.length)[0];
    profile.primaryClusterCentroid = {
      latitude: largest.reduce((sum, p) => sum + p.latitude, 0) / largest.length,
      longitude: largest.reduce((sum, p) => sum + p.longitude, 0) / largest.length,
    };
  }

  return profile;
}

// Simple clustering: group points within radiusKm of each other
function clusterLocations(
  points: SubmissionLocation[],
  radiusKm: number
): SubmissionLocation[][] {
  const visited = new Set<number>();
  const clusters: SubmissionLocation[][] = [];

  for (let i = 0; i < points.length; i++) {
    if (visited.has(i)) continue;
    visited.add(i);
    const cluster: SubmissionLocation[] = [points[i]];

    for (let j = i + 1; j < points.length; j++) {
      if (visited.has(j)) continue;
      if (haversineKm(points[i], points[j]) <= radiusKm) {
        visited.add(j);
        cluster.push(points[j]);
      }
    }

    if (cluster.length >= 2) {
      clusters.push(cluster);
    }
  }

  return clusters;
}
```

### 2.5 GPS Confidence Scoring Formula

```
GPS_CONFIDENCE_SCORE (0-100)
==============================

Starts at 100, deductions applied:

Signal                              Deduction    Condition
────────────────────────────────────────────────────────────────
Mock location detected              -50          Client reports isMocked=true
GPS accuracy = 0                    -20          Unrealistic for consumer device
GPS accuracy > 100m (non-low-end)   -10          Poor GPS fix
GPS-EXIF mismatch > threshold       -30          Photo taken elsewhere
No EXIF GPS (non-low-end)           -15          Cannot cross-validate
No EXIF GPS (low-end device)        -5           Expected for feature phones
IP-GPS mismatch > 50km              -15          Submitting from different city
Impossible travel (>200 km/h)       -40          Cannot physically move that fast
Suspicious travel (>80 km/h)        -15          Unusual for Douala
GPS time drift > 30 seconds         -10          Stale GPS fix or clock issue
No accelerometer data (non-low-end) -5           Possible emulator
No motion detected during capture   -5           Stationary spoofing

Bonuses:
EXIF GPS matches submission GPS     +5           Strong corroboration
All three sources agree (GPS/EXIF/IP) +5         Maximum confidence

Final score = clamp(score, 0, 100)
```

---

## 3. Duplicate Detection

### 3.1 Photo Duplicate Detection

The existing `submission_image_hashes` table (from the 20260305 migration) stores SHA-256 and perceptual hashes per event. The system below operationalizes it.

```typescript
// lib/server/duplicateDetection.ts

import { createHash } from 'crypto';

// ── EXACT DUPLICATE: SHA-256 ──

function computeSHA256(imageBuffer: Buffer): string {
  return createHash('sha256').update(imageBuffer).digest('hex');
}

// ── PERCEPTUAL HASH: Average Hash (aHash) ──
// Resistant to resizing, minor color changes, compression artifacts
// Suitable for detecting the same photo with minor edits

function computePerceptualHash(imageBuffer: Buffer): string {
  // Step 1: Resize to 8x8 grayscale (64 pixels)
  // Using a simplified approach -- in production, use sharp library
  // sharp(imageBuffer).resize(8, 8).grayscale().raw().toBuffer()
  //
  // Pseudocode for the algorithm:
  //   pixels = resize_to_8x8_grayscale(imageBuffer)
  //   mean = average(pixels)
  //   hash = ''
  //   for each pixel in pixels:
  //     hash += pixel >= mean ? '1' : '0'
  //   return hex(hash)

  // Implementation with sharp:
  // const pixels = await sharp(imageBuffer)
  //   .resize(8, 8, { fit: 'fill' })
  //   .grayscale()
  //   .raw()
  //   .toBuffer();
  //
  // const values = Array.from(pixels);
  // const mean = values.reduce((a, b) => a + b, 0) / values.length;
  // let bits = '';
  // for (const v of values) {
  //   bits += v >= mean ? '1' : '0';
  // }
  // return BigInt('0b' + bits).toString(16).padStart(16, '0');

  // Placeholder -- actual implementation requires sharp
  return 'placeholder_phash';
}

function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return Infinity;
  let distance = 0;
  const n1 = BigInt('0x' + hash1);
  const n2 = BigInt('0x' + hash2);
  let xor = n1 ^ n2;
  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }
  return distance;
}

// ── EXIF FINGERPRINT ──
// Even without perceptual hashing, identical EXIF data across
// different submissions is a strong duplicate signal

interface ExifFingerprint {
  capturedAt: string | null;
  deviceMake: string | null;
  deviceModel: string | null;
  gpsLat: number | null;
  gpsLon: number | null;
}

function computeExifFingerprint(metadata: ExtractedPhotoMetadata): string {
  const fp: ExifFingerprint = {
    capturedAt: metadata.capturedAt,
    deviceMake: metadata.deviceMake,
    deviceModel: metadata.deviceModel,
    gpsLat: metadata.gps?.latitude ?? null,
    gpsLon: metadata.gps?.longitude ?? null,
  };
  return createHash('sha256').update(JSON.stringify(fp)).digest('hex');
}

// ── DUPLICATE CHECK PIPELINE ──

interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType: 'exact' | 'perceptual' | 'exif_match' | 'none';
  matchedEventIds: string[];
  matchedPointIds: string[];
  confidence: number;  // 0-100
  action: 'allow' | 'flag' | 'reject';
  reason: string | null;
}

async function checkPhotoDuplicate(params: {
  imageBuffer: Buffer;
  currentPointId: string;
  currentUserId: string;
  photoMetadata: ExtractedPhotoMetadata;
}): Promise<DuplicateCheckResult> {
  const sha256 = computeSHA256(params.imageBuffer);
  const pHash = computePerceptualHash(params.imageBuffer);
  const exifFp = computeExifFingerprint(params.photoMetadata);

  // ── Step 1: Exact SHA-256 match ──
  const exactMatches = await findSubmissionsByImageHash(sha256);
  if (exactMatches.length > 0) {
    const samePoint = exactMatches.filter(e => e.pointId === params.currentPointId);
    const differentPoint = exactMatches.filter(e => e.pointId !== params.currentPointId);

    if (differentPoint.length > 0) {
      // Same photo used for DIFFERENT entities -- strong fraud signal
      return {
        isDuplicate: true,
        duplicateType: 'exact',
        matchedEventIds: differentPoint.map(e => e.eventId),
        matchedPointIds: [...new Set(differentPoint.map(e => e.pointId))],
        confidence: 99,
        action: 'reject',
        reason: `Exact duplicate photo already used for ${differentPoint.length} other submission(s)`,
      };
    }

    if (samePoint.length > 0) {
      // Same photo for same entity (re-enrichment) -- allow with flag
      return {
        isDuplicate: true,
        duplicateType: 'exact',
        matchedEventIds: samePoint.map(e => e.eventId),
        matchedPointIds: [params.currentPointId],
        confidence: 99,
        action: 'flag',
        reason: 'Same photo resubmitted for the same entity',
      };
    }
  }

  // ── Step 2: Perceptual hash near-match ──
  // Query all perceptual hashes and find close matches
  // In production, use a BK-tree or VP-tree for efficient nearest-neighbor
  const allHashes = await getAllPerceptualHashes();
  for (const existing of allHashes) {
    if (existing.eventId === params.currentPointId) continue;
    const distance = hammingDistance(pHash, existing.perceptualHash);

    // Hamming distance thresholds for 64-bit hash:
    //   0-5: near-identical (same image, different compression)
    //   6-10: similar (same scene, different angle or crop)
    //   >10: different images
    if (distance <= 5 && existing.pointId !== params.currentPointId) {
      return {
        isDuplicate: true,
        duplicateType: 'perceptual',
        matchedEventIds: [existing.eventId],
        matchedPointIds: [existing.pointId],
        confidence: Math.max(60, 95 - distance * 7),
        action: 'flag',
        reason: `Near-duplicate photo detected (hamming distance: ${distance}/64)`,
      };
    }
  }

  // ── Step 3: EXIF fingerprint match ──
  // Same device, same time, same GPS -- different submission
  if (params.photoMetadata.capturedAt && params.photoMetadata.gps) {
    const exifMatches = await findSubmissionsByExifFingerprint(exifFp);
    const otherPoints = exifMatches.filter(e => e.pointId !== params.currentPointId);
    if (otherPoints.length > 0) {
      return {
        isDuplicate: true,
        duplicateType: 'exif_match',
        matchedEventIds: otherPoints.map(e => e.eventId),
        matchedPointIds: [...new Set(otherPoints.map(e => e.pointId))],
        confidence: 80,
        action: 'flag',
        reason: 'Photo has identical EXIF fingerprint (same device, time, GPS) as another submission',
      };
    }
  }

  return {
    isDuplicate: false,
    duplicateType: 'none',
    matchedEventIds: [],
    matchedPointIds: [],
    confidence: 0,
    action: 'allow',
    reason: null,
  };
}
```

### 3.2 Entity Deduplication

```typescript
// lib/server/entityDedup.ts

interface EntityDedupResult {
  isDuplicate: boolean;
  matchType: 'exact_location' | 'proximity_name' | 'cross_agent' | 'temporal' | 'none';
  matchedPointId: string | null;
  confidence: number;
  action: 'allow' | 'suggest_enrich' | 'flag' | 'reject';
  reason: string | null;
}

// Category-specific proximity thresholds (in km)
// Calibrated for Bonamoussadi's commercial density
const PROXIMITY_THRESHOLDS: Record<string, {
  rejectKm: number;      // Auto-reject: almost certainly same entity
  flagKm: number;        // Flag for review: probably same entity
  enrichSuggestKm: number; // Suggest enrichment instead of creation
}> = {
  mobile_money:   { rejectKm: 0.010, flagKm: 0.020, enrichSuggestKm: 0.050 },
  pharmacy:       { rejectKm: 0.030, flagKm: 0.050, enrichSuggestKm: 0.100 },
  fuel_station:   { rejectKm: 0.050, flagKm: 0.100, enrichSuggestKm: 0.200 },
  alcohol_outlet: { rejectKm: 0.015, flagKm: 0.030, enrichSuggestKm: 0.060 },
  billboard:      { rejectKm: 0.010, flagKm: 0.020, enrichSuggestKm: 0.050 },
  transport_road: { rejectKm: 0.020, flagKm: 0.050, enrichSuggestKm: 0.100 },
  census_proxy:   { rejectKm: 0.015, flagKm: 0.030, enrichSuggestKm: 0.060 },
};

async function checkEntityDuplicate(params: {
  category: string;
  location: SubmissionLocation;
  name: string;
  userId: string;
  eventType: 'CREATE_EVENT' | 'ENRICH_EVENT';
}): Promise<EntityDedupResult> {

  // Only check duplicates for CREATE_EVENTs
  if (params.eventType === 'ENRICH_EVENT') {
    return { isDuplicate: false, matchType: 'none', matchedPointId: null,
             confidence: 0, action: 'allow', reason: null };
  }

  const thresholds = PROXIMITY_THRESHOLDS[params.category] ??
    { rejectKm: 0.020, flagKm: 0.050, enrichSuggestKm: 0.100 };

  // Fetch all existing points of the same category within the
  // enrichSuggest radius (widest check radius)
  const nearbyPoints = await findPointsByProximity(
    params.category,
    params.location,
    thresholds.enrichSuggestKm
  );

  if (nearbyPoints.length === 0) {
    return { isDuplicate: false, matchType: 'none', matchedPointId: null,
             confidence: 0, action: 'allow', reason: null };
  }

  // Check each nearby point
  for (const point of nearbyPoints) {
    const distKm = haversineKm(params.location, point.location);
    const nameSimilarity = computeNameSimilarity(params.name, point.name ?? '');

    // ── EXACT LOCATION MATCH ──
    if (distKm < thresholds.rejectKm) {
      return {
        isDuplicate: true,
        matchType: 'exact_location',
        matchedPointId: point.pointId,
        confidence: 95,
        action: 'suggest_enrich',
        reason: `A ${params.category} already exists ${Math.round(distKm * 1000)}m away (${point.name}). Did you mean to enrich it?`,
      };
    }

    // ── PROXIMITY + NAME MATCH ──
    if (distKm < thresholds.flagKm && nameSimilarity > 0.7) {
      return {
        isDuplicate: true,
        matchType: 'proximity_name',
        matchedPointId: point.pointId,
        confidence: 85,
        action: 'suggest_enrich',
        reason: `"${point.name}" already exists ${Math.round(distKm * 1000)}m away with ${Math.round(nameSimilarity * 100)}% name similarity`,
      };
    }

    // ── PROXIMITY FLAG ──
    if (distKm < thresholds.flagKm) {
      return {
        isDuplicate: true,
        matchType: 'proximity_name',
        matchedPointId: point.pointId,
        confidence: 60,
        action: 'flag',
        reason: `Another ${params.category} exists ${Math.round(distKm * 1000)}m away (${point.name}). Possibly a duplicate.`,
      };
    }

    // ── ENRICH SUGGESTION ZONE ──
    if (distKm < thresholds.enrichSuggestKm && nameSimilarity > 0.8) {
      return {
        isDuplicate: true,
        matchType: 'proximity_name',
        matchedPointId: point.pointId,
        confidence: 50,
        action: 'flag',
        reason: `Similar ${params.category} "${point.name}" exists ${Math.round(distKm * 1000)}m away`,
      };
    }
  }

  return { isDuplicate: false, matchType: 'none', matchedPointId: null,
           confidence: 0, action: 'allow', reason: null };
}

// ── NAME SIMILARITY ──
// Normalized Levenshtein distance with preprocessing for
// Cameroonian French business names

function computeNameSimilarity(name1: string, name2: string): number {
  const normalize = (s: string) => s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // Remove accents
    .replace(/[^a-z0-9\s]/g, '')                        // Remove punctuation
    .replace(/\b(pharmacie|pharmacy|station|kiosque|agence|bar|buvette|depot)\b/g, '') // Remove common prefixes
    .replace(/\b(de|du|des|la|le|les|l)\b/g, '')       // Remove articles
    .replace(/\s+/g, ' ')
    .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  if (n1 === n2) return 1.0;
  if (!n1 || !n2) return 0.0;

  // Levenshtein distance
  const len1 = n1.length;
  const len2 = n2.length;
  const matrix: number[][] = Array.from({ length: len1 + 1 }, () =>
    Array(len2 + 1).fill(0)
  );

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = n1[i - 1] === n2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1.0 : 1.0 - matrix[len1][len2] / maxLen;
}

// ── CROSS-AGENT DUPLICATE DETECTION ──
// Detect when multiple agents submit the same entity

async function detectCrossAgentDuplicates(
  category: string,
  windowDays: number = 7
): Promise<Array<{
  pointIds: string[];
  agentIds: string[];
  centroid: SubmissionLocation;
  radiusMeters: number;
  suggestedAction: 'merge' | 'review';
}>> {
  // Find CREATE_EVENTs from different users for the same category
  // within close proximity and recent time window
  const recentCreates = await getRecentCreateEvents(category, windowDays);

  const duplicateClusters: Array<{
    pointIds: string[];
    agentIds: string[];
    centroid: SubmissionLocation;
    radiusMeters: number;
    suggestedAction: 'merge' | 'review';
  }> = [];

  const thresholds = PROXIMITY_THRESHOLDS[category] ??
    { rejectKm: 0.020, flagKm: 0.050, enrichSuggestKm: 0.100 };

  // Group by proximity
  const processed = new Set<string>();
  for (const event of recentCreates) {
    if (processed.has(event.pointId)) continue;

    const nearby = recentCreates.filter(e =>
      e.pointId !== event.pointId &&
      !processed.has(e.pointId) &&
      e.userId !== event.userId && // Different agent
      haversineKm(
        { latitude: event.latitude, longitude: event.longitude },
        { latitude: e.latitude, longitude: e.longitude }
      ) < thresholds.flagKm
    );

    if (nearby.length > 0) {
      const cluster = [event, ...nearby];
      const centroid = {
        latitude: cluster.reduce((s, e) => s + e.latitude, 0) / cluster.length,
        longitude: cluster.reduce((s, e) => s + e.longitude, 0) / cluster.length,
      };
      const maxDist = Math.max(
        ...cluster.map(e =>
          haversineKm(centroid, { latitude: e.latitude, longitude: e.longitude })
        )
      );

      duplicateClusters.push({
        pointIds: cluster.map(e => e.pointId),
        agentIds: [...new Set(cluster.map(e => e.userId))],
        centroid,
        radiusMeters: Math.round(maxDist * 1000),
        suggestedAction: maxDist < thresholds.rejectKm ? 'merge' : 'review',
      });

      cluster.forEach(e => processed.add(e.pointId));
    }
  }

  return duplicateClusters;
}

// ── TEMPORAL DUPLICATE DETECTION ──
// Same entity submitted too frequently by the same or different agents

async function detectTemporalDuplicates(
  pointId: string,
  windowHours: number = 24
): Promise<{
  isDuplicate: boolean;
  recentEventCount: number;
  uniqueAgents: number;
  action: 'allow' | 'throttle' | 'reject';
}> {
  const recentEvents = await getRecentEventsForPoint(pointId, windowHours);

  if (recentEvents.length === 0) {
    return { isDuplicate: false, recentEventCount: 0, uniqueAgents: 0, action: 'allow' };
  }

  const uniqueAgents = new Set(recentEvents.map(e => e.userId)).size;

  // Thresholds:
  // - Same agent enriching same point 3+ times in 24h: throttle
  // - Any agent enriching a point that was enriched <1h ago: flag
  // - 5+ enrichments on same point in 24h from any agents: suspicious
  if (recentEvents.length >= 5) {
    return {
      isDuplicate: true,
      recentEventCount: recentEvents.length,
      uniqueAgents,
      action: 'reject',
    };
  }

  const mostRecent = recentEvents[0];
  const timeSinceLastMs = Date.now() - new Date(mostRecent.createdAt).getTime();
  if (timeSinceLastMs < 3600000) { // Less than 1 hour
    return {
      isDuplicate: true,
      recentEventCount: recentEvents.length,
      uniqueAgents,
      action: 'throttle',
    };
  }

  return {
    isDuplicate: false,
    recentEventCount: recentEvents.length,
    uniqueAgents,
    action: 'allow',
  };
}
```

---

## 4. Timestamp and Photo Validation

### 4.1 Photo Freshness Validation

```typescript
// lib/server/photoValidation.ts

interface PhotoFreshnessResult {
  isFresh: boolean;
  freshnessScore: number;  // 0-100
  capturedAt: string | null;
  submittedAt: string;
  ageMinutes: number | null;
  flags: string[];
}

function validatePhotoFreshness(params: {
  exifCapturedAt: string | null;
  submissionTime: Date;
  serverReceiveTime: Date;
  isLowEndDevice: boolean;
}): PhotoFreshnessResult {
  const flags: string[] = [];
  let freshnessScore = 50; // Neutral starting point
  let ageMinutes: number | null = null;

  if (!params.exifCapturedAt) {
    // No EXIF timestamp -- cannot validate freshness
    freshnessScore = params.isLowEndDevice ? 40 : 25;
    flags.push('NO_EXIF_TIMESTAMP');
    return {
      isFresh: true, // Cannot determine, assume fresh
      freshnessScore,
      capturedAt: null,
      submittedAt: params.submissionTime.toISOString(),
      ageMinutes: null,
      flags,
    };
  }

  const capturedDate = new Date(params.exifCapturedAt);
  const submissionDate = params.submissionTime;

  // Age of photo in minutes
  ageMinutes = (submissionDate.getTime() - capturedDate.getTime()) / 60000;

  // ── FRESHNESS RULES ──

  // Rule 1: Photo timestamp is in the future
  if (ageMinutes < -5) { // Allow 5 minutes of clock skew
    freshnessScore = 10;
    flags.push('FUTURE_TIMESTAMP');
    // Often just a misconfigured phone clock, not fraud
    // But still suspicious
  }

  // Rule 2: Photo taken within last 30 minutes -- very fresh
  else if (ageMinutes >= 0 && ageMinutes <= 30) {
    freshnessScore = 100;
    // Perfect -- photo was just taken
  }

  // Rule 3: Photo taken within last 2 hours -- reasonably fresh
  else if (ageMinutes <= 120) {
    freshnessScore = 80;
    // Agent took photos on a field trip, submitting batch later
  }

  // Rule 4: Photo taken within last 24 hours -- acceptable
  else if (ageMinutes <= 1440) {
    freshnessScore = 60;
    flags.push('PHOTO_STALE_HOURS');
  }

  // Rule 5: Photo is 1-7 days old -- questionable
  else if (ageMinutes <= 10080) {
    freshnessScore = 30;
    flags.push('PHOTO_STALE_DAYS');
  }

  // Rule 6: Photo is more than 7 days old -- likely recycled
  else {
    freshnessScore = 10;
    flags.push('PHOTO_RECYCLED');
  }

  // Rule 7: Photo is more than 1 year old -- definitely recycled
  if (ageMinutes > 525600) {
    freshnessScore = 0;
    flags.push('PHOTO_ANCIENT');
  }

  // ── CLOCK SKEW COMPENSATION ──
  // Many phones in Cameroon have incorrect clocks
  // If the EXIF timestamp is off by exactly N hours (timezone issue),
  // do not penalize
  const hourOffset = Math.round(ageMinutes / 60);
  if (hourOffset >= 1 && hourOffset <= 12 &&
      Math.abs(ageMinutes - hourOffset * 60) < 10) {
    // Likely timezone misconfiguration -- recover some score
    freshnessScore = Math.min(100, freshnessScore + 30);
    flags.push(`LIKELY_TIMEZONE_OFFSET_${hourOffset}H`);
  }

  return {
    isFresh: freshnessScore >= 30,
    freshnessScore,
    capturedAt: params.exifCapturedAt,
    submittedAt: params.submissionTime.toISOString(),
    ageMinutes,
    flags,
  };
}
```

### 4.2 Photo Content Analysis

```typescript
// lib/server/photoContentAnalysis.ts

interface PhotoContentResult {
  contentScore: number;         // 0-100
  isScreenshot: boolean;
  isLikelyOutdoor: boolean;
  matchesExpectedVertical: boolean;
  flags: string[];
}

// ── SCREENSHOT DETECTION ──

interface ImageDimensions {
  width: number;
  height: number;
}

function detectScreenshot(dimensions: ImageDimensions): {
  isScreenshot: boolean;
  confidence: number;
  reason: string | null;
} {
  const { width, height } = dimensions;

  // Common Android screenshot resolutions
  const ANDROID_SCREENSHOT_RESOLUTIONS = [
    [1080, 2400], [1080, 2340], [1080, 2160], [720, 1600],
    [720, 1560], [720, 1520], [720, 1280], [1440, 3200],
    [1440, 3120], [1440, 2960], [1440, 3040],
  ];

  // Common iPhone screenshot resolutions
  const IPHONE_SCREENSHOT_RESOLUTIONS = [
    [1170, 2532], [1284, 2778], [1125, 2436], [1242, 2688],
    [750, 1334], [1080, 1920], [1290, 2796], [1179, 2556],
  ];

  const allScreenshots = [
    ...ANDROID_SCREENSHOT_RESOLUTIONS,
    ...IPHONE_SCREENSHOT_RESOLUTIONS,
  ];

  for (const [sw, sh] of allScreenshots) {
    if ((width === sw && height === sh) || (width === sh && height === sw)) {
      return {
        isScreenshot: true,
        confidence: 70,
        reason: `Dimensions ${width}x${height} match known screenshot resolution`,
      };
    }
  }

  // Camera photos typically have aspect ratios of 4:3 or 16:9
  // Screenshots have unusual aspect ratios like 9:19.5
  const ratio = Math.max(width, height) / Math.min(width, height);
  if (ratio > 2.0) {
    return {
      isScreenshot: true,
      confidence: 50,
      reason: `Aspect ratio ${ratio.toFixed(2)} is atypical for camera photos`,
    };
  }

  return { isScreenshot: false, confidence: 0, reason: null };
}

// ── PHOTO METADATA INTEGRITY ──

interface MetadataIntegrityResult {
  isEdited: boolean;
  isDownloaded: boolean;
  confidence: number;
  flags: string[];
}

function checkMetadataIntegrity(params: {
  exifSoftware: string | null;
  exifMake: string | null;
  exifModel: string | null;
  hasExifGps: boolean;
  hasExifTimestamp: boolean;
  fileSize: number;
  dimensions: ImageDimensions;
  mimeType: string | null;
}): MetadataIntegrityResult {
  const flags: string[] = [];
  let isEdited = false;
  let isDownloaded = false;

  // ── Editing software detection ──
  const editingSoftware = [
    'photoshop', 'gimp', 'lightroom', 'snapseed', 'vsco',
    'canva', 'picsart', 'exiftool', 'imagemagick',
  ];
  if (params.exifSoftware) {
    const sw = params.exifSoftware.toLowerCase();
    for (const editor of editingSoftware) {
      if (sw.includes(editor)) {
        isEdited = true;
        flags.push(`EDITED_WITH_${editor.toUpperCase()}`);
      }
    }
  }

  // ── Download indicators ──
  // Photos downloaded from the internet typically lack:
  // - GPS data (stripped by social media platforms)
  // - Device make/model
  // - Original timestamp
  // But DO have:
  // - Standard web image dimensions (800x600, 1200x800, etc.)
  if (!params.hasExifGps && !params.exifMake && !params.hasExifTimestamp) {
    // Triple-null: very suspicious
    flags.push('NO_DEVICE_METADATA');

    // Common web image dimensions
    const webDimensions = [
      [800, 600], [1024, 768], [1200, 800], [1920, 1080],
      [640, 480], [1280, 720], [960, 640],
    ];
    const { width, height } = params.dimensions;
    for (const [w, h] of webDimensions) {
      if ((width === w && height === h) || (width === h && height === w)) {
        isDownloaded = true;
        flags.push(`WEB_IMAGE_DIMENSIONS_${width}x${height}`);
        break;
      }
    }
  }

  // ── File size anomalies ──
  // Camera photos are typically 2-10 MB
  // Screenshots: 100KB-1MB
  // Downloaded web images: 50KB-500KB
  // AI-generated: varies widely
  if (params.fileSize < 50000) { // < 50KB
    flags.push('VERY_SMALL_FILE');
  } else if (params.fileSize < 200000 && params.dimensions.width > 1000) {
    flags.push('HIGH_COMPRESSION_RATIO');
    isDownloaded = true;
  }

  const confidence = flags.length === 0 ? 0 :
    Math.min(90, flags.length * 25);

  return { isEdited, isDownloaded, confidence, flags };
}

// ── WEATHER/LIGHTING CONSISTENCY ──
// Simple heuristic: check if submission time of day is consistent
// with expected lighting conditions
// (Full implementation would require image brightness analysis)

function checkTimeLightingConsistency(params: {
  submissionTimeUTC: Date;
  exifCapturedAtUTC: string | null;
  category: string;
}): { isConsistent: boolean; flags: string[] } {
  const flags: string[] = [];

  // Cameroon is UTC+1
  const localHour = (params.submissionTimeUTC.getUTCHours() + 1) % 24;

  // Night submissions (23:00-05:00) for outdoor-only verticals
  const outdoorVerticals = ['billboard', 'fuel_station', 'transport_road'];
  if (outdoorVerticals.includes(params.category) && (localHour >= 23 || localHour < 5)) {
    flags.push('NIGHTTIME_OUTDOOR_SUBMISSION');
  }

  // Very early morning (04:00-06:00) is unusual for fieldwork
  if (localHour >= 4 && localHour < 6) {
    flags.push('VERY_EARLY_SUBMISSION');
  }

  return {
    isConsistent: flags.length === 0,
    flags,
  };
}
```

### 4.3 Timestamp Consistency Matrix

```
TIMESTAMP CONSISTENCY DECISION TREE
=====================================

                    ┌─────────────────┐
                    │ Submission       │
                    │ received by      │
                    │ server           │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Compare three   │
                    │ timestamps:     │
                    │ 1. EXIF capture │
                    │ 2. Device clock │
                    │ 3. Server time  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────┐ ┌──────▼──────┐ ┌─────▼──────┐
     │ EXIF exists │ │ EXIF exists │ │ No EXIF    │
     │ All times   │ │ Times       │ │ timestamp  │
     │ within 2h   │ │ diverge >2h │ │            │
     └────────┬────┘ └──────┬──────┘ └─────┬──────┘
              │              │              │
     ┌────────▼────┐ ┌──────▼──────┐ ┌─────▼──────┐
     │ CONSISTENT  │ │ Check for   │ │ Check if   │
     │ Score: 100  │ │ timezone    │ │ low-end    │
     │             │ │ offset      │ │ device     │
     └─────────────┘ └──────┬──────┘ └─────┬──────┘
                             │              │
                    ┌────────┼────────┐     │
                    │        │        │     │
           ┌────────▼──┐ ┌───▼───┐ ┌──▼────▼──┐
           │ Exact Nh  │ │ Not   │ │ Low-end: │
           │ offset    │ │ round │ │ Score 40 │
           │ Score: 70 │ │ hours │ │ Normal:  │
           │ (timezone)│ │       │ │ Score 25 │
           └───────────┘ │       │ └──────────┘
                         │       │
                ┌────────▼──┐    │
                │ >24h gap: │    │
                │ Score: 20 │    │
                │ RECYCLED  │    │
                │ FLAG      │    │
                └───────────┘
```

---

## 5. Confidence Scoring Model

### 5.1 Relationship to Teammate 2's Quality Score

Teammate 2 defined a **Data Quality Confidence Score** (0-100) with six factors: recency (25%), sourceCount (20%), photoEvidence (20%), gpsAccuracy (15%), reviewerApproval (10%), fieldCompleteness (10%). This score measures *how reliable the data is*.

This section defines a separate **Fraud Risk Score** (0-100) that measures *how likely a submission is fraudulent*. The two scores are related but distinct:

```
RELATIONSHIP BETWEEN SCORES
==============================

Fraud Risk Score (this document)
  │  Measures: probability of fraud
  │  Range: 0 (definitely legitimate) to 100 (definitely fraudulent)
  │  Computed: at submission time
  │
  └──► Feeds into ──► Data Quality Confidence Score (Teammate 2)
                        │  Penalty: gpsAccuracy factor reduced when
                        │  fraud risk is high
                        │
                        └──► Determines: auto-approve / review / reject
```

### 5.2 Fraud Risk Score: Input Signals

```
FRAUD RISK SCORE INPUTS
========================

Category          Signal                        Weight    Source
──────────────────────────────────────────────────────────────────
GPS INTEGRITY     GPS confidence score           0.25     Section 2
(25%)             (inverted: 100 - gpsConfidence)

PHOTO INTEGRITY   Photo duplicate check          0.25     Section 3
(25%)             Photo freshness score
                  Metadata integrity check
                  Screenshot detection

TEMPORAL          Submission velocity             0.15     Velocity check
CONSISTENCY       Impossible travel
(15%)             Time-of-day plausibility
                  Offline batch analysis

AGENT HISTORY     Account age                    0.20     User trust profile
(20%)             Prior fraud flags
                  Prior rejections
                  Trust tier
                  Consecutive clean submissions

BEHAVIORAL        Self-enrichment patterns        0.15     Pattern analysis
PATTERNS          Device sharing
(15%)             Category distribution
                  IP reputation
```

### 5.3 Scoring Algorithm

```typescript
// lib/server/fraudScoring.ts

interface FraudRiskComponents {
  gpsRisk: number;           // 0-100
  photoRisk: number;         // 0-100
  temporalRisk: number;      // 0-100
  agentHistoryRisk: number;  // 0-100
  behavioralRisk: number;    // 0-100
}

interface FraudRiskResult {
  compositeScore: number;     // 0-100
  components: FraudRiskComponents;
  action: 'auto_approve' | 'soft_review' | 'hard_review' | 'auto_reject';
  xpAction: 'award' | 'escrow' | 'deny';
  flags: string[];
  confidenceInScore: number;  // 0-100, how confident we are in our own score
}

const WEIGHTS = {
  gps: 0.25,
  photo: 0.25,
  temporal: 0.15,
  agentHistory: 0.20,
  behavioral: 0.15,
};

function computeFraudRiskScore(params: {
  // GPS signals
  gpsValidation: GpsValidationResult;

  // Photo signals
  photoDuplicate: DuplicateCheckResult;
  photoFreshness: PhotoFreshnessResult;
  metadataIntegrity: MetadataIntegrityResult;
  screenshotDetection: { isScreenshot: boolean; confidence: number };

  // Temporal signals
  recentSubmissionCount15min: number;
  recentSubmissionCount1hr: number;
  lastSubmissionLocation: SubmissionLocation | null;
  lastSubmissionTime: Date | null;
  currentLocation: SubmissionLocation;
  currentTime: Date;
  isOfflineBatch: boolean;

  // Agent history signals
  accountAgeDays: number;
  totalSubmissions: number;
  priorFraudFlags: number;
  priorRejections: number;
  userTrustScore: number;
  consecutiveClean: number;

  // Behavioral signals
  selfEnrichmentCount: number;
  samePointEnrichments: number;
  deviceSharedWithOtherUsers: boolean;
  ipIsVpnOrDatacenter: boolean;
}): FraudRiskResult {
  const flags: string[] = [];

  // ── GPS RISK (0-100) ──
  // Invert the GPS confidence score
  const gpsRisk = 100 - params.gpsValidation.gpsConfidenceScore;
  if (gpsRisk > 50) flags.push('HIGH_GPS_RISK');

  // ── PHOTO RISK (0-100) ──
  let photoRisk = 0;

  // Duplicate detection is the strongest photo signal
  if (params.photoDuplicate.action === 'reject') {
    photoRisk += 80;
    flags.push('PHOTO_DUPLICATE_REJECT');
  } else if (params.photoDuplicate.action === 'flag') {
    photoRisk += 40;
    flags.push('PHOTO_DUPLICATE_FLAG');
  }

  // Freshness
  photoRisk += Math.round((100 - params.photoFreshness.freshnessScore) * 0.3);

  // Metadata integrity
  if (params.metadataIntegrity.isEdited) {
    photoRisk += 25;
    flags.push('PHOTO_EDITED');
  }
  if (params.metadataIntegrity.isDownloaded) {
    photoRisk += 30;
    flags.push('PHOTO_DOWNLOADED');
  }

  // Screenshot
  if (params.screenshotDetection.isScreenshot) {
    photoRisk += 20;
    flags.push('SCREENSHOT_DETECTED');
  }

  photoRisk = Math.min(100, photoRisk);

  // ── TEMPORAL RISK (0-100) ──
  let temporalRisk = 0;

  // Velocity (adjusted for offline batches)
  if (!params.isOfflineBatch) {
    if (params.recentSubmissionCount15min > 10) temporalRisk += 50;
    else if (params.recentSubmissionCount15min > 5) temporalRisk += 25;
    else if (params.recentSubmissionCount15min > 3) temporalRisk += 10;
  } else {
    // Offline batch: use relaxed thresholds
    if (params.recentSubmissionCount15min > 20) temporalRisk += 30;
    else if (params.recentSubmissionCount15min > 15) temporalRisk += 15;
  }

  // Impossible travel
  if (params.lastSubmissionLocation && params.lastSubmissionTime) {
    const distKm = haversineKm(params.lastSubmissionLocation, params.currentLocation);
    const timeH = (params.currentTime.getTime() - params.lastSubmissionTime.getTime()) / 3600000;
    if (timeH > 0) {
      const speedKmh = distKm / timeH;
      if (speedKmh > 200) { temporalRisk += 50; flags.push('IMPOSSIBLE_TRAVEL'); }
      else if (speedKmh > 80) { temporalRisk += 25; flags.push('HIGH_VELOCITY'); }
    }
  }

  // Late-night submissions (Cameroon is UTC+1)
  const localHour = (params.currentTime.getUTCHours() + 1) % 24;
  if (localHour >= 23 || localHour < 5) temporalRisk += 10;

  temporalRisk = Math.min(100, temporalRisk);

  // ── AGENT HISTORY RISK (0-100) ──
  let agentHistoryRisk = 0;

  // New account penalty
  if (params.accountAgeDays < 1) agentHistoryRisk += 25;
  else if (params.accountAgeDays < 7) agentHistoryRisk += 15;
  else if (params.accountAgeDays < 30) agentHistoryRisk += 5;

  // No submission history
  if (params.totalSubmissions === 0) agentHistoryRisk += 15;

  // Prior fraud history
  agentHistoryRisk += Math.min(40, params.priorFraudFlags * 10);
  agentHistoryRisk += Math.min(20, params.priorRejections * 5);

  // Inverse of trust score
  agentHistoryRisk += Math.round((100 - params.userTrustScore) * 0.2);

  // Consecutive clean streak bonus (reduces risk)
  if (params.consecutiveClean > 20) agentHistoryRisk = Math.max(0, agentHistoryRisk - 15);
  else if (params.consecutiveClean > 10) agentHistoryRisk = Math.max(0, agentHistoryRisk - 10);

  agentHistoryRisk = Math.min(100, agentHistoryRisk);

  // ── BEHAVIORAL RISK (0-100) ──
  let behavioralRisk = 0;

  if (params.selfEnrichmentCount > 5) behavioralRisk += 30;
  else if (params.selfEnrichmentCount > 2) behavioralRisk += 15;

  if (params.samePointEnrichments > 3) behavioralRisk += 25;

  if (params.deviceSharedWithOtherUsers) behavioralRisk += 15;
  if (params.ipIsVpnOrDatacenter) {
    behavioralRisk += 20;
    flags.push('VPN_OR_DATACENTER_IP');
  }

  behavioralRisk = Math.min(100, behavioralRisk);

  // ── COMPOSITE SCORE ──
  const compositeScore = Math.round(
    WEIGHTS.gps * gpsRisk +
    WEIGHTS.photo * photoRisk +
    WEIGHTS.temporal * temporalRisk +
    WEIGHTS.agentHistory * agentHistoryRisk +
    WEIGHTS.behavioral * behavioralRisk
  );

  // ── DETERMINE ACTION ──
  let action: FraudRiskResult['action'];
  let xpAction: FraudRiskResult['xpAction'];

  if (compositeScore <= 25) {
    action = 'auto_approve';
    xpAction = 'award';
  } else if (compositeScore <= 50) {
    action = 'soft_review';
    xpAction = 'award';      // Award XP but reversible if review finds fraud
  } else if (compositeScore <= 75) {
    action = 'hard_review';
    xpAction = 'escrow';     // Hold XP until admin approves
  } else {
    action = 'auto_reject';
    xpAction = 'deny';
  }

  // ── OVERRIDE: Critical flags force escalation ──
  if (flags.includes('PHOTO_DUPLICATE_REJECT')) {
    action = 'auto_reject';
    xpAction = 'deny';
  }
  if (flags.includes('IMPOSSIBLE_TRAVEL') && gpsRisk > 60) {
    action = 'auto_reject';
    xpAction = 'deny';
  }

  // ── CONFIDENCE IN OUR OWN SCORE ──
  // Higher when we have more signals to work with
  let confidenceInScore = 50;
  if (params.gpsValidation.exifMatchResult !== 'no_exif') confidenceInScore += 15;
  if (params.gpsValidation.ipMatchResult !== 'unknown') confidenceInScore += 10;
  if (params.gpsValidation.mockLocationResult !== 'unknown') confidenceInScore += 10;
  if (params.totalSubmissions > 10) confidenceInScore += 10;
  if (params.photoDuplicate.confidence > 0) confidenceInScore += 5;

  return {
    compositeScore: Math.min(100, Math.max(0, compositeScore)),
    components: {
      gpsRisk,
      photoRisk,
      temporalRisk,
      agentHistoryRisk,
      behavioralRisk,
    },
    action,
    xpAction,
    flags,
    confidenceInScore: Math.min(100, confidenceInScore),
  };
}
```

### 5.4 Score Thresholds and Actions

```
FRAUD RISK SCORE THRESHOLDS
=============================

Score Range    Action            XP Treatment       Review SLA
──────────────────────────────────────────────────────────────
0-25           AUTO-APPROVE      Award immediately   None needed
26-50          SOFT REVIEW       Award (reversible)  Admin reviews within 48h
51-75          HARD REVIEW       Escrowed            Admin must approve within 72h
76-100         AUTO-REJECT       Denied              Logged; agent notified

EXAMPLES:

Score 12 -- Trusted agent, all signals clean
  GPS=5 (EXIF match, IP match, no velocity issue)
  Photo=0 (no duplicates, fresh, clean metadata)
  Temporal=0 (normal pace)
  Agent=5 (established, trusted tier)
  Behavioral=0 (no patterns)
  Composite: 0.25*5 + 0.25*0 + 0.15*0 + 0.20*5 + 0.15*0 = 2.25 -> 2
  Action: AUTO-APPROVE

Score 45 -- New agent, missing EXIF, first day
  GPS=35 (no EXIF GPS, IP matches)
  Photo=25 (no EXIF, not screenshot, not duplicate)
  Temporal=10 (3 submissions in 15 min)
  Agent=55 (brand new account, no history)
  Behavioral=5 (no patterns yet)
  Composite: 0.25*35 + 0.25*25 + 0.15*10 + 0.20*55 + 0.15*5 = 28.0
  Action: SOFT REVIEW (reasonable for a new agent)

Score 82 -- GPS spoofing + duplicate photo
  GPS=70 (mock location detected, no EXIF, IP mismatch)
  Photo=80 (exact duplicate of another submission)
  Temporal=30 (8 submissions in 15 min)
  Agent=40 (3 prior flags)
  Behavioral=20 (device shared)
  Composite: 0.25*70 + 0.25*80 + 0.15*30 + 0.20*40 + 0.15*20 = 55.0
  Override: PHOTO_DUPLICATE_REJECT flag forces AUTO-REJECT
  Action: AUTO-REJECT
```

### 5.5 Agent Reputation System

```typescript
// lib/server/agentReputation.ts

interface AgentTrustProfile {
  userId: string;
  trustScore: number;             // 0-100, starts at 50
  tier: 'new' | 'standard' | 'trusted' | 'elite' | 'suspended';
  totalApproved: number;
  totalFlagged: number;
  totalRejected: number;
  consecutiveClean: number;
  lastFraudFlag: string | null;
  lastActivity: string | null;
  specializations: string[];      // Verticals where agent has proven accuracy
  verifiedZones: string[];        // Geographic zones agent has ground-truth in
}

// ── TIER DEFINITIONS ──

const TIER_RULES = {
  elite: {
    minTrustScore: 85,
    minApproved: 50,
    privileges: [
      'Auto-approve rate: 80% of submissions skip review',
      'Can validate other agents\' submissions (peer review)',
      'Eligible for quality bonuses',
      'Relaxed velocity thresholds (10/15min instead of 5)',
      'Can submit outside assigned zone (with flag)',
    ],
  },
  trusted: {
    minTrustScore: 70,
    minApproved: 20,
    privileges: [
      'Auto-approve rate: 50% of submissions skip review',
      'Normal velocity thresholds',
      'Priority in task assignment',
      'Eligible for leaderboard rewards',
    ],
  },
  standard: {
    minTrustScore: 30,
    minApproved: 0,
    privileges: [
      'Auto-approve rate: 20% of low-risk submissions',
      'Standard velocity thresholds',
      'Full feature access',
    ],
  },
  new: {
    minTrustScore: 0,
    minApproved: 0,
    privileges: [
      'All submissions reviewed',
      'Max 10 submissions per day',
      'Limited to assigned zone only',
      'First 3 submissions get new-user grace period',
    ],
  },
  suspended: {
    minTrustScore: -1,
    minApproved: 0,
    privileges: [
      'All submissions blocked',
      'Must appeal to admin to restore',
      'Cannot earn XP',
    ],
  },
};

// ── TRUST SCORE UPDATE LOGIC ──

function updateAgentTrust(
  profile: AgentTrustProfile,
  event: 'submission_approved' | 'submission_flagged' | 'submission_rejected' |
         'mystery_audit_passed' | 'mystery_audit_failed' | 'peer_validation'
): AgentTrustProfile {
  const updated = { ...profile };

  switch (event) {
    case 'submission_approved':
      updated.totalApproved++;
      updated.consecutiveClean++;
      // Gradual increase: +1 per clean, +2 on streak >10
      const bonus = updated.consecutiveClean > 10 ? 2 : 1;
      updated.trustScore = Math.min(100, updated.trustScore + bonus);
      break;

    case 'submission_flagged':
      updated.totalFlagged++;
      updated.consecutiveClean = 0;
      updated.trustScore = Math.max(0, updated.trustScore - 5);
      updated.lastFraudFlag = new Date().toISOString();
      break;

    case 'submission_rejected':
      updated.totalRejected++;
      updated.consecutiveClean = 0;
      updated.trustScore = Math.max(0, updated.trustScore - 15);
      updated.lastFraudFlag = new Date().toISOString();
      break;

    case 'mystery_audit_passed':
      // Strong positive signal: agent's data verified on the ground
      updated.trustScore = Math.min(100, updated.trustScore + 10);
      updated.consecutiveClean += 5; // Equivalent to 5 clean submissions
      break;

    case 'mystery_audit_failed':
      // Strong negative signal: agent's data found to be wrong on the ground
      updated.trustScore = Math.max(0, updated.trustScore - 25);
      updated.consecutiveClean = 0;
      updated.lastFraudFlag = new Date().toISOString();
      break;

    case 'peer_validation':
      // Another agent confirmed this agent's submission
      updated.trustScore = Math.min(100, updated.trustScore + 1);
      break;
  }

  // ── INACTIVITY DECAY ──
  // Trust decays by 1 point per 30 days of inactivity
  if (updated.lastActivity) {
    const daysSinceActivity = (Date.now() - new Date(updated.lastActivity).getTime()) / 86400000;
    const decayPoints = Math.floor(daysSinceActivity / 30);
    if (decayPoints > 0) {
      updated.trustScore = Math.max(0, updated.trustScore - decayPoints);
    }
  }

  // ── UPDATE TIER ──
  if (updated.trustScore >= TIER_RULES.elite.minTrustScore &&
      updated.totalApproved >= TIER_RULES.elite.minApproved) {
    updated.tier = 'elite';
  } else if (updated.trustScore >= TIER_RULES.trusted.minTrustScore &&
             updated.totalApproved >= TIER_RULES.trusted.minApproved) {
    updated.tier = 'trusted';
  } else if (updated.trustScore >= TIER_RULES.standard.minTrustScore) {
    updated.tier = 'standard';
  } else if (updated.trustScore >= 10) {
    updated.tier = 'new';
  } else {
    updated.tier = 'suspended';
  }

  updated.lastActivity = new Date().toISOString();
  return updated;
}
```

### 5.6 Integration with Teammate 2's Confidence Score

The fraud risk score modifies the confidence score as follows:

```typescript
// Extension to Teammate 2's computeConfidenceScore function

function computeConfidenceScoreWithFraud(
  point: ProjectedPoint,
  referenceDate: Date,
  fraudRiskScore: number  // From computeFraudRiskScore
): number {
  // Compute base confidence score (Teammate 2's formula)
  const baseScore = computeConfidenceScore(point, referenceDate);

  // Apply fraud penalty
  // fraudRiskScore 0-25: no penalty
  // fraudRiskScore 26-50: -5 to -15 points
  // fraudRiskScore 51-75: -15 to -30 points
  // fraudRiskScore 76-100: -30 to -50 points
  let fraudPenalty = 0;
  if (fraudRiskScore > 75) {
    fraudPenalty = 30 + Math.round((fraudRiskScore - 75) * 0.8);
  } else if (fraudRiskScore > 50) {
    fraudPenalty = 15 + Math.round((fraudRiskScore - 50) * 0.6);
  } else if (fraudRiskScore > 25) {
    fraudPenalty = 5 + Math.round((fraudRiskScore - 25) * 0.4);
  }

  return Math.max(0, Math.min(100, baseScore - fraudPenalty));
}
```

---

## 6. Anti-Fraud Operations

### 6.1 Real-Time Alerts

```
ALERT DEFINITIONS
==================

Alert ID    Trigger                                  Priority    Channel
────────────────────────────────────────────────────────────────────────────
FRD-001     Auto-reject triggered                    P2          Slack #fraud-alerts
FRD-002     3+ rejections from same agent in 24h     P1          Slack + Email to ops lead
FRD-003     Mock location detected                   P1          Slack #fraud-alerts
FRD-004     Impossible travel (>200 km/h)            P1          Slack #fraud-alerts
FRD-005     Photo duplicate across different POIs    P2          Slack #fraud-alerts
FRD-006     Agent auto-suspended (trust < 10)        P1          Slack + Email to ops lead
FRD-007     Collusion ring detected (batch analysis) P0          Slack + Email to CEO
FRD-008     >50 submissions from one agent in 1h     P1          Slack #fraud-alerts
FRD-009     VPN/datacenter IP with GPS spoofing      P2          Slack #fraud-alerts
FRD-010     Agent trust score drops below 30         P2          Slack #fraud-alerts
```

### 6.2 Investigation Workflow

```
SUBMISSION FLAGGED FOR REVIEW
==============================

Step 1: TRIAGE (Admin, <15 min)
  ├── Open submission in admin dashboard
  ├── View fraud risk score and component breakdown
  ├── View agent trust profile and submission history
  ├── View the submission photo alongside Google Maps
  │   Street View of the declared GPS coordinates
  └── Quick decision:
      ├── Clearly legitimate → Approve (update agent trust +1)
      ├── Clearly fraudulent → Reject (update agent trust -15)
      └── Ambiguous → Escalate to Step 2

Step 2: INVESTIGATION (Senior admin, <2 hours)
  ├── Pull all submissions from the flagged agent
  ├── Plot submissions on map with timestamps
  ├── Check device fingerprint cross-references
  ├── Review IP history (consistent residential vs datacenter)
  ├── Run perceptual hash comparison against all agent's photos
  ├── Check for collusion patterns (graph query from R-GRA-01)
  └── Decision:
      ├── False positive → Approve + adjust scoring weights
      ├── Confirmed fraud → Execute consequences (Step 3)
      └── Need field verification → Escalate to Step 3

Step 3: FIELD VERIFICATION (Ops team, <48 hours)
  ├── Dispatch a different agent or team lead to the
  │   GPS coordinates of the flagged submission
  ├── Verify: does the entity exist? Is the data accurate?
  ├── Take verification photo with GPS and timestamp
  └── File verification report:
      ├── Entity exists and data is accurate → Approve original
      ├── Entity exists but data is wrong → Flag as data poisoning
      └── Entity does not exist → Confirm fabrication, full audit
```

### 6.3 Agent Performance Monitoring Dashboard

```
DASHBOARD: AGENT PERFORMANCE OVERVIEW
=======================================

┌─────────────────────────────────────────────────────────────┐
│  AGENT: Marie Ngassa          TIER: Trusted (Score: 74)    │
│  Active since: 2026-01-15     Zone: Bonamoussadi A         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SUBMISSIONS (30 days)                                      │
│  ┌──────────────┐                                           │
│  │ Total:   147 │  Creates: 89   Enrichments: 58           │
│  │ Approved: 138│  Flagged:  7   Rejected: 2               │
│  │ Approval: 94%│  Avg Risk Score: 18                      │
│  └──────────────┘                                           │
│                                                             │
│  QUALITY METRICS                                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Photo w/ EXIF GPS:     72% (vs team avg 65%)        │   │
│  │ Photo freshness <2h:   88% (vs team avg 79%)        │   │
│  │ Field completeness:    81% (vs team avg 74%)        │   │
│  │ Peer validations recv: 12                           │   │
│  │ Mystery audit result:  PASSED (2026-02-20)          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  FRAUD SIGNALS (30 days)                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ GPS flags:           2 (both low-accuracy, resolved) │   │
│  │ Photo duplicates:    0                               │   │
│  │ Velocity flags:      3 (offline batch flushes)       │   │
│  │ Self-enrichment:     4 (within acceptable range)     │   │
│  │ Collusion signals:   0                               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  TRUST SCORE HISTORY                                        │
│  100│                                                       │
│   80│          ╭──────────╮      ╭──                        │
│   60│    ╭─────╯          ╰──╮──╯                           │
│   40│╭───╯                   │                              │
│   20│╯                                                      │
│    0│────────────────────────────────                        │
│     Jan    Feb    Mar                                       │
│                                                             │
│  [View All Submissions] [View Map] [Flag Agent] [Export]    │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 Mystery Audits

```
MYSTERY AUDIT PROGRAM
======================

Purpose: Independently verify that submitted data matches physical reality.
         This is the ultimate ground-truth validation -- if a submitted
         pharmacy does not exist when you walk to its GPS coordinates,
         the data (and the agent) cannot be trusted.

Frequency: Weekly during pilot phase, biweekly after stabilization.

Process:
  1. SELECTION (Automated)
     - Select 10 submissions per week for field verification
     - Selection weighted toward:
       a. New agents (first 30 days): 40% of audits
       b. Agents with recent fraud flags: 30% of audits
       c. Random sample across all agents: 30% of audits
     - Never audit more than 2 submissions from the same agent per week
       (to avoid the agent recognizing the pattern)

  2. DISPATCH (Ops manager)
     - Assign audit to a team lead or trusted senior agent
     - Auditor must be different from the original submitter
     - Provide only the GPS coordinates and vertical type
       (NOT the submitted name or details -- auditor must
       independently identify the entity)

  3. FIELD VERIFICATION (Auditor, 20 min per point)
     - Navigate to GPS coordinates
     - Does the claimed entity exist? (Y/N)
     - If yes: is the submitted data accurate?
       - Name correct?
       - Category correct?
       - Key fields correct? (isOpenNow, providers, hasFuelAvailable, etc.)
     - Take a verification photo
     - Record GPS coordinates from auditor's device
     - Note any discrepancies

  4. SCORING (Automated)
     For each audited submission, score on 3 dimensions:

     Existence score:
       Entity exists at GPS location:     100
       Entity exists within 50m:            75
       Entity exists within 200m:           50
       Entity does not exist:                0

     Data accuracy score:
       All fields correct:                 100
       Minor errors (spelling, hours):      75
       Major errors (wrong category, wrong status): 25
       Completely fabricated:                0

     Location accuracy score:
       Auditor GPS within 20m of submission: 100
       Within 50m:                            80
       Within 100m:                           60
       Within 200m:                           40
       Beyond 200m:                            0

     Overall audit score = 0.4 * existence + 0.4 * accuracy + 0.2 * location

  5. CONSEQUENCES
     Audit score 80-100: PASS → Agent trust +10
     Audit score 50-79:  MARGINAL → Agent warned, trust +0
     Audit score 20-49:  FAIL → Agent trust -15, submission rejected
     Audit score 0-19:   CRITICAL FAIL → Agent trust -25,
                         all recent submissions queued for review,
                         possible suspension
```

### 6.5 Consequences Framework

```
PROGRESSIVE DISCIPLINE FRAMEWORK
==================================

Level 0: EDUCATION (Preventive)
  Trigger: Agent onboarding
  Action:  Training on data quality expectations, fraud policy,
           and consequences. Agent signs acknowledgment.

Level 1: AUTOMATED WARNING
  Trigger: First fraud flag OR fraud risk score 51-75
  Action:  In-app notification: "This submission was flagged for
           review. Please ensure you are physically present at the
           location and taking fresh photos."
  Impact:  No XP penalty. Trust score -5. Logged in fraud_audit_log.

Level 2: FORMAL WARNING
  Trigger: 3+ fraud flags in 30 days OR 1 confirmed rejection
  Action:  Direct message from ops manager explaining the issue.
           Agent must acknowledge within 48h or account is paused.
  Impact:  XP escrowed for all submissions for 7 days.
           Trust score -10. Flagged on admin dashboard.

Level 3: TEMPORARY SUSPENSION (7 days)
  Trigger: 3+ confirmed rejections OR mystery audit FAIL
  Action:  Account suspended for 7 days. All submissions during
           suspension period are blocked. Agent notified with
           specific reasons and appeal instructions.
  Impact:  Trust score -25. XP frozen. Cannot earn XP during
           suspension. All submissions from past 14 days queued
           for retroactive review.

Level 4: EXTENDED SUSPENSION (30 days)
  Trigger: Repeat offense after Level 3 OR mystery audit CRITICAL FAIL
  Action:  Account suspended for 30 days. Mandatory retraining
           before reinstatement. All historical submissions audited.
  Impact:  Trust score set to 10 (tier: new). XP recalculated
           excluding flagged submissions.

Level 5: PERMANENT TERMINATION
  Trigger: 3rd suspension OR confirmed systematic fraud OR
           collusion ring participation
  Action:  Account permanently banned. All submissions from this
           agent quarantined for review. Device fingerprint and
           email domain added to watch list.
  Impact:  Trust score set to 0. All data marked as unverified.
           Agent cannot re-register (device fingerprint + email check).

APPEAL PROCESS
  - Agent can appeal any Level 2+ action within 7 days
  - Appeal reviewed by a different admin than the one who flagged
  - If evidence is ambiguous: agent invited to re-verify in the field
  - Appeal decision within 5 business days
  - If overturned: trust score partially restored (+10), XP released
```

### 6.6 Monthly Fraud Report

```
MONTHLY FRAUD REPORT TEMPLATE
================================

Report Period: [Month Year]
Prepared by: [Fraud Analyst]
Distribution: CEO, CTO, Ops Lead

1. EXECUTIVE SUMMARY
   - Total submissions: [N]
   - Fraud rate: [X]% (target: <2%)
   - Detection rate (estimated): [Y]%
   - False positive rate: [Z]% (target: <10%)

2. SUBMISSIONS BY OUTCOME
   ┌─────────────────────────────────────────────┐
   │ Auto-approved:    [N] ([X]% of total)       │
   │ Soft-reviewed:    [N] ([X]%)                │
   │ Hard-reviewed:    [N] ([X]%)                │
   │ Auto-rejected:    [N] ([X]%)                │
   │ Manually rejected after review: [N] ([X]%)  │
   └─────────────────────────────────────────────┘

3. FRAUD BY TYPE
   │ Type                  │ Count │ % of Total │ Trend │
   ├───────────────────────┼───────┼────────────┼───────┤
   │ GPS spoofing          │       │            │ ↑ ↓ → │
   │ Photo duplication     │       │            │       │
   │ Fabricated entity     │       │            │       │
   │ Data poisoning        │       │            │       │
   │ XP gaming             │       │            │       │
   │ Alt account farming   │       │            │       │
   │ Collusion             │       │            │       │

4. AGENT TRUST DISTRIBUTION
   │ Tier       │ Count │ % of Agents │ Avg Submissions │
   ├────────────┼───────┼─────────────┼─────────────────┤
   │ Elite      │       │             │                 │
   │ Trusted    │       │             │                 │
   │ Standard   │       │             │                 │
   │ New        │       │             │                 │
   │ Suspended  │       │             │                 │

5. MYSTERY AUDIT RESULTS
   - Audits conducted: [N]
   - Pass rate: [X]%
   - Most common issue: [description]
   - Agents flagged: [list]

6. SCORING SYSTEM PERFORMANCE
   - Average fraud risk score (all submissions): [X]
   - Score distribution histogram
   - False positive analysis: [N] submissions incorrectly flagged
   - Weight adjustment recommendations: [if any]

7. NOTABLE INCIDENTS
   [Description of any significant fraud events, investigations,
    or pattern changes]

8. RECOMMENDATIONS
   [Specific actions for next month: threshold changes, new rules,
    agent training, etc.]
```

---

## 7. Incentive Design

### 7.1 Payment Model: Quality-Weighted Compensation

The current system awards a flat 5 XP per submission (`BASE_EVENT_XP`). This incentivizes quantity over quality. The revised model ties compensation to data quality.

```
COMPENSATION MODEL: QUALITY-WEIGHTED XP
=========================================

Base XP (per accepted submission):

  Event Type         Base XP    Condition
  ──────────────────────────────────────────────────
  CREATE_EVENT         5        Entity does not exist yet
  ENRICH_EVENT         3        Fills at least one gap field
  VERIFICATION_EVENT   4        Confirms existing entity (new type)

Quality Multiplier (applied to base XP):

  Fraud Risk Score    Multiplier    Effective XP (CREATE)
  ──────────────────────────────────────────────────────
  0-10                1.5x          7.5 XP
  11-25               1.2x          6.0 XP
  26-50               1.0x          5.0 XP (current baseline)
  51-75               0.5x          2.5 XP (escrowed)
  76-100              0.0x          0.0 XP (rejected)

  This means high-quality submissions earn MORE than the current
  flat rate, while suspicious ones earn less. The best agents
  are rewarded for their diligence.

Photo Quality Bonus:

  Photo has EXIF GPS that matches:     +1 XP
  Photo has EXIF timestamp <30 min:    +1 XP
  Photo has device make/model:         +0.5 XP
  Second photo included:               +1 XP

  Maximum photo bonus: +3.5 XP per submission

Weekly Quality Bonus:

  If an agent's weekly approval rate is >95%:   +20 XP
  If an agent's weekly approval rate is >90%:   +10 XP
  If an agent passes a mystery audit:           +50 XP

Monthly Leaderboard Bonus:

  Top agent by quality-adjusted XP:    500 XP + recognition
  Top 3 agents:                        250 XP each
  Top 10 agents:                       100 XP each

  Quality-adjusted XP = Total XP * (approval rate)^2
  This ensures agents who submit 200 items with 70% approval
  rank BELOW agents who submit 100 items with 98% approval.
```

### 7.2 Anti-Gaming Safeguards

```
PREVENTING INCENTIVE MANIPULATION
====================================

Problem 1: Self-enrichment loops
  Current: Agent creates POI (+5 XP), then enriches same POI
           3 times (+15 XP) = 20 XP from one location
  Fix:     Cap enrichments to 2 per agent per point
           After 2 enrichments, additional ones earn 0 XP
           (data still accepted but no reward)

Problem 2: Minimum-effort submissions
  Current: Agent fills only required fields to get XP
  Fix:     Field completeness bonus:
           - All required fields only: base XP
           - 50%+ of enrichable fields filled: +1 XP
           - 80%+ of enrichable fields filled: +2 XP
           - 100% of enrichable fields filled: +3 XP

Problem 3: Territory racing
  Current: No zone assignment; agents compete to CREATE
           the same entities, wasting effort
  Fix:     Assign agents to zones within Bonamoussadi
           (e.g., Zone A, Zone B, Makepe)
           Agent earns full XP only in assigned zone
           Out-of-zone submissions: 50% XP
           Exceptions: agent can request zone reassignment weekly

Problem 4: Alt account farming
  Current: One person creates multiple accounts
  Fix:     Require phone number verification at registration
           (SMS OTP via MTN/Orange -- per Teammate 5's MFA design)
           One phone number = one account
           Same device fingerprint across accounts = flag

Problem 5: Collusion rings
  Current: Groups of agents validate each other's fake data
  Fix:     Peer validation assignments are randomized by the system
           Agent cannot choose which submissions to verify
           Cross-enrichment ratio tracked: if Agent A enriches
           Agent B's points more than 30% of the time, flag both
```

### 7.3 Peer Verification Rewards

```
PEER VERIFICATION SYSTEM
==========================

Purpose: Leverage agents to verify each other's submissions,
         creating a crowdsourced quality layer that scales with
         the agent workforce.

How it works:

  1. System selects submissions needing verification:
     - All submissions with fraud risk score 26-50 (soft review)
     - Random 20% sample of auto-approved submissions
     - All submissions from agents with trust score < 50

  2. System assigns verification task to a nearby agent:
     - Must be a different agent than the original submitter
     - Must be in the same zone or adjacent zone
     - Preferably a 'trusted' or 'elite' tier agent
     - Agent receives push notification: "Verify a nearby [vertical]"

  3. Verification task:
     - Navigate to the GPS coordinates
     - Confirm: entity exists? (Y/N)
     - Confirm: details accurate? (Y/N per field)
     - Take a verification photo
     - Submit verification event (new event type: VERIFY_EVENT)

  4. Rewards:
     - Verifier earns 4 XP per verification
     - If verification confirms original submission:
       original agent gets +1 XP bonus ("peer validated")
     - If verification contradicts original submission:
       original submission flagged for admin review
       verifier gets +6 XP (bonus for catching an issue)

  5. Anti-gaming the verification system:
     - Verifier cannot be the same person as submitter
       (device fingerprint + userId cross-check)
     - Verification must include a new photo from a different device
     - Auto-confirm without field visit: if GPS shows verifier
       was not near the location, verification is rejected
     - Verifier's own trust score affects verification weight
```

### 7.4 Gamification for Accuracy

```
GAMIFICATION ELEMENTS
======================

1. ACCURACY STREAKS
   - Track consecutive submissions with fraud risk score < 25
   - Streaks displayed on agent profile
   - Milestones:
     10 clean submissions:  "Reliable Reporter" badge + 20 XP
     25 clean submissions:  "Data Guardian" badge + 50 XP
     50 clean submissions:  "Ground Truth Champion" badge + 100 XP
     100 clean submissions: "Elite Mapper" badge + 200 XP
   - Streak resets on any rejected submission
   - Flagged submissions do not break streak (only rejections do)

2. VERTICAL MASTERY
   - Track agent performance per vertical
   - After 20 high-quality submissions in one vertical:
     agent earns "Pharmacy Expert" (or Fuel, Mobile Money, etc.)
   - Vertical experts get:
     - Priority assignment for that vertical
     - +1 XP bonus for submissions in their mastered vertical
     - Their submissions in that vertical get -5 fraud risk score

3. ZONE COVERAGE CHALLENGES
   - Weekly challenges: "Map all pharmacies in Zone B"
   - Challenge completion requires:
     - Visit every street in the zone (GPS trail coverage check)
     - Submit all entities found (not just cherry-pick easy ones)
   - Challenge rewards:
     - Zone completion bonus: 100 XP
     - Speed bonus (first to complete): 50 XP

4. QUALITY LEADERBOARD (replaces pure XP leaderboard)
   - Ranking formula:
     Quality Score = (Total XP) * (Approval Rate)^2 * (Vertical Diversity)
   - Where:
     Approval Rate = approved / (approved + rejected)
     Vertical Diversity = (unique verticals submitted) / 7
   - This rewards agents who:
     a. Submit a lot (high XP)
     b. Submit accurately (high approval rate -- squared to penalize errors heavily)
     c. Cover multiple verticals (diversity bonus)

5. TEAM CHALLENGES
   - Group agents into small teams (3-5 people)
   - Team scores aggregate individual quality scores
   - Monthly team challenge with team-level rewards
   - Purpose: create positive peer pressure for quality
   - Team members can see each other's quality metrics
     (but NOT fraud flags -- those remain private)
```

---

## Summary: Implementation Priority

```
IMPLEMENTATION PHASES
======================

PHASE 1 (Weeks 1-2): Foundation
  ✓ Deploy fraud_analytics_foundation.sql migration (already done)
  □ Implement photo SHA-256 hashing at submission time
  □ Store hashes in submission_image_hashes table
  □ Implement basic velocity check (R-VEL-01)
  □ Add submission count per 15-min check to POST /api/submissions
  □ Implement GPS integrity report collection in PWA

PHASE 2 (Weeks 3-4): Core Detection
  □ Implement fraud risk score computation (Section 5.3)
  □ Deploy in SHADOW MODE: compute scores, log them, but do not act
  □ Implement entity deduplication (Section 3.2)
  □ Implement photo freshness validation (Section 4.1)
  □ Implement impossible travel detection (Section 2.3)
  □ Build admin fraud dashboard (Section 6.3)

PHASE 3 (Weeks 5-8): Calibration
  □ Analyze shadow-mode scores against 200+ manually labeled submissions
  □ Adjust component weights using labeled data
  □ Set thresholds that produce <5% false positive rate
  □ Enable enforcement mode with conservative thresholds
    (auto-reject only at fraud risk score 90+)
  □ Implement agent trust score system (Section 5.5)
  □ Implement quality-weighted XP model (Section 7.1)

PHASE 4 (Weeks 9-12): Operations
  □ Launch mystery audit program (Section 6.4)
  □ Implement peer verification system (Section 7.3)
  □ Implement perceptual hashing for near-duplicate detection
  □ Implement collusion graph analysis (batch job)
  □ Implement consequences framework (Section 6.5)
  □ Begin monthly fraud reporting (Section 6.6)
  □ Gradually lower auto-reject threshold from 90 to 76

PHASE 5 (Ongoing): Refinement
  □ Monthly weight recalibration
  □ Photo content analysis (screenshot detection, editing detection)
  □ AI-generated image detection (as models become available)
  □ Statistical anomaly detection batch jobs (Section 2.4)
  □ Gamification features (Section 7.4)
  □ Cross-zone expansion of fraud controls
```

---

## Appendix A: Database Schema Extensions

The following extends the existing `20260305_fraud_analytics_foundation.sql` migration:

```sql
-- Agent trust profiles
CREATE TABLE IF NOT EXISTS agent_trust_profiles (
  user_id TEXT PRIMARY KEY REFERENCES user_profiles(id),
  trust_score INTEGER NOT NULL DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),
  tier TEXT NOT NULL DEFAULT 'new' CHECK (tier IN ('new', 'standard', 'trusted', 'elite', 'suspended')),
  total_approved INTEGER NOT NULL DEFAULT 0,
  total_flagged INTEGER NOT NULL DEFAULT 0,
  total_rejected INTEGER NOT NULL DEFAULT 0,
  consecutive_clean INTEGER NOT NULL DEFAULT 0,
  last_fraud_flag TIMESTAMPTZ,
  last_activity TIMESTAMPTZ,
  specializations TEXT[] DEFAULT '{}',
  verified_zones TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_trust_tier ON agent_trust_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_agent_trust_score ON agent_trust_profiles(trust_score DESC);

-- Mystery audit results
CREATE TABLE IF NOT EXISTS mystery_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_event_id UUID NOT NULL REFERENCES point_events(id),
  original_user_id TEXT NOT NULL,
  auditor_user_id TEXT NOT NULL REFERENCES user_profiles(id),
  existence_score INTEGER NOT NULL CHECK (existence_score >= 0 AND existence_score <= 100),
  accuracy_score INTEGER NOT NULL CHECK (accuracy_score >= 0 AND accuracy_score <= 100),
  location_score INTEGER NOT NULL CHECK (location_score >= 0 AND location_score <= 100),
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  result TEXT NOT NULL CHECK (result IN ('pass', 'marginal', 'fail', 'critical_fail')),
  auditor_latitude FLOAT8 NOT NULL,
  auditor_longitude FLOAT8 NOT NULL,
  verification_photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mystery_audits_original_user ON mystery_audits(original_user_id);
CREATE INDEX IF NOT EXISTS idx_mystery_audits_result ON mystery_audits(result);
CREATE INDEX IF NOT EXISTS idx_mystery_audits_created ON mystery_audits(created_at DESC);

-- Peer verifications
CREATE TABLE IF NOT EXISTS peer_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_event_id UUID NOT NULL REFERENCES point_events(id),
  original_user_id TEXT NOT NULL,
  verifier_user_id TEXT NOT NULL REFERENCES user_profiles(id),
  entity_exists BOOLEAN NOT NULL,
  data_accurate BOOLEAN,
  field_discrepancies JSONB DEFAULT '{}',
  verification_photo_url TEXT,
  verifier_latitude FLOAT8 NOT NULL,
  verifier_longitude FLOAT8 NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peer_verifications_original ON peer_verifications(original_event_id);
CREATE INDEX IF NOT EXISTS idx_peer_verifications_verifier ON peer_verifications(verifier_user_id);

-- Fraud risk score history (for calibration analysis)
CREATE TABLE IF NOT EXISTS fraud_risk_scores (
  event_id UUID PRIMARY KEY REFERENCES point_events(id),
  composite_score INTEGER NOT NULL,
  gps_risk INTEGER NOT NULL,
  photo_risk INTEGER NOT NULL,
  temporal_risk INTEGER NOT NULL,
  agent_history_risk INTEGER NOT NULL,
  behavioral_risk INTEGER NOT NULL,
  action TEXT NOT NULL,
  flags TEXT[] DEFAULT '{}',
  confidence_in_score INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_risk_scores_composite ON fraud_risk_scores(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_risk_scores_action ON fraud_risk_scores(action);
CREATE INDEX IF NOT EXISTS idx_fraud_risk_scores_created ON fraud_risk_scores(created_at DESC);

-- Submission labels (for calibration)
CREATE TABLE IF NOT EXISTS submission_labels (
  event_id UUID PRIMARY KEY REFERENCES point_events(id),
  label TEXT NOT NULL CHECK (label IN ('legitimate', 'suspicious', 'confirmed_fraud')),
  labeler_user_id TEXT NOT NULL REFERENCES user_profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submission_labels_label ON submission_labels(label);
```

## Appendix B: Key Metrics Targets

| Metric | Pilot Target (Month 1-3) | Mature Target (Month 6+) |
|---|---|---|
| Fraud rate | < 5% | < 2% |
| Detection rate (recall) | > 50% | > 70% |
| False positive rate | < 15% | < 5% |
| Auto-approve rate | > 50% | > 70% |
| Median time to detection | < 2 hours | < 30 minutes |
| Median time to resolution | < 72 hours | < 24 hours |
| Mystery audit pass rate | > 80% | > 90% |
| Agent satisfaction score | > 3.5/5 | > 4.0/5 |
| XP-to-quality correlation | r > 0.5 | r > 0.7 |
