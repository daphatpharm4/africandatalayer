import type { GpsIntegrityReport } from "../../shared/types";

type NavigatorWithConnection = Navigator & {
  connection?: {
    effectiveType?: string;
    type?: string;
  };
};

async function collectMotionSignals(durationMs: number): Promise<{
  hasAccelerometerData: boolean;
  hasGyroscopeData: boolean;
  accelerometerSampleCount: number;
  motionDetectedDuringCapture: boolean;
}> {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return {
      hasAccelerometerData: false,
      hasGyroscopeData: false,
      accelerometerSampleCount: 0,
      motionDetectedDuringCapture: false,
    };
  }

  return await new Promise((resolve) => {
    let accelerometerSampleCount = 0;
    let hasAccelerometerData = false;
    let hasGyroscopeData = false;
    let motionDetectedDuringCapture = false;

    const onMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity ?? event.acceleration;
      const rotation = event.rotationRate;
      if (acceleration) {
        hasAccelerometerData = true;
        accelerometerSampleCount += 1;
        const magnitude = Math.abs(acceleration.x ?? 0) + Math.abs(acceleration.y ?? 0) + Math.abs(acceleration.z ?? 0);
        if (magnitude > 3) motionDetectedDuringCapture = true;
      }
      if (rotation && (rotation.alpha || rotation.beta || rotation.gamma)) {
        hasGyroscopeData = true;
      }
    };

    window.addEventListener("devicemotion", onMotion);
    window.setTimeout(() => {
      window.removeEventListener("devicemotion", onMotion);
      resolve({
        hasAccelerometerData,
        hasGyroscopeData,
        accelerometerSampleCount,
        motionDetectedDuringCapture,
      });
    }, durationMs);
  });
}

export async function collectGpsIntegrity(position: GeolocationPosition | null): Promise<GpsIntegrityReport> {
  const nav = navigator as NavigatorWithConnection;
  const coords = position?.coords as (GeolocationCoordinates & { isMocked?: boolean }) | undefined;
  const motion = await collectMotionSignals(600);

  return {
    mockLocationDetected: coords?.isMocked === true,
    mockLocationMethod: coords?.isMocked === true ? "Position.isMocked" : null,
    hasAccelerometerData: motion.hasAccelerometerData,
    hasGyroscopeData: motion.hasGyroscopeData,
    accelerometerSampleCount: motion.accelerometerSampleCount,
    motionDetectedDuringCapture: motion.motionDetectedDuringCapture,
    gpsAccuracyMeters: typeof coords?.accuracy === "number" ? coords.accuracy : null,
    networkType: nav.connection?.effectiveType ?? nav.connection?.type ?? null,
    gpsTimestamp: typeof position?.timestamp === "number" ? position.timestamp : null,
    deviceTimestamp: Date.now(),
    timeDeltaMs: typeof position?.timestamp === "number" ? Math.abs(Date.now() - position.timestamp) : null,
  };
}
