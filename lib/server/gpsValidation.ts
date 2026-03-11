import { haversineKm } from "./submissionFraud.js";
import type { GpsIntegrityReport, SubmissionLocation } from "../../shared/types.js";

export interface GpsValidationResult {
  score: number;
  flags: string[];
  mockDetected: boolean;
  exifMismatch: boolean;
}

export function validateGps(input: {
  submissionLocation: SubmissionLocation | null;
  photoLocation: SubmissionLocation | null;
  gpsIntegrity: GpsIntegrityReport | null;
}): GpsValidationResult {
  let score = 100;
  const flags: string[] = [];
  let mockDetected = false;
  let exifMismatch = false;

  const { gpsIntegrity, submissionLocation, photoLocation } = input;

  // Mock location detected
  if (gpsIntegrity?.mockLocationDetected) {
    score -= 50;
    flags.push("mock_location_detected");
    mockDetected = true;
  }

  // GPS accuracy = 0 (impossible value)
  if (gpsIntegrity?.gpsAccuracyMeters === 0) {
    score -= 20;
    flags.push("zero_gps_accuracy");
  } else if (gpsIntegrity?.gpsAccuracyMeters !== null && gpsIntegrity?.gpsAccuracyMeters !== undefined) {
    // Low precision (high accuracy value = less precise)
    if (gpsIntegrity.gpsAccuracyMeters > 100) {
      score -= 10;
      flags.push("low_gps_precision");
    }
  }

  // EXIF GPS vs submission GPS mismatch
  if (submissionLocation && photoLocation) {
    const distance = haversineKm(submissionLocation, photoLocation);
    if (distance > 0.5) {
      score -= 30;
      flags.push("exif_gps_mismatch");
      exifMismatch = true;
    }
  }

  // No integrity report at all
  if (!gpsIntegrity) {
    score -= 15;
    flags.push("no_gps_integrity_report");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    flags,
    mockDetected,
    exifMismatch,
  };
}
