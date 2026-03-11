import { query } from "./db.js";

export interface AgentMovementAnalysis {
  userId: string;
  totalSubmissions: number;
  lowPrecisionRate: number;
  uniqueLocationRate: number;
  clusterCount: number;
  flags: string[];
}

export async function analyzeAgentMovementPatterns(
  windowDays = 30,
): Promise<AgentMovementAnalysis[]> {
  const result = await query<{
    user_id: string;
    latitude: number;
    longitude: number;
    gps_accuracy: number | null;
  }>(
    `SELECT
       pe.user_id,
       pe.latitude,
       pe.longitude,
       (pe.details #>> '{gpsIntegrity,gpsAccuracyMeters}')::numeric AS gps_accuracy
     FROM point_events pe
     WHERE pe.created_at > NOW() - make_interval(days => $1::int)
     ORDER BY pe.user_id, pe.created_at`,
    [windowDays],
  );

  const byUser = new Map<string, Array<{ lat: number; lon: number; accuracy: number | null }>>();
  for (const row of result.rows) {
    const entries = byUser.get(row.user_id) ?? [];
    entries.push({
      lat: Number(row.latitude),
      lon: Number(row.longitude),
      accuracy: row.gps_accuracy !== null ? Number(row.gps_accuracy) : null,
    });
    byUser.set(row.user_id, entries);
  }

  const analyses: AgentMovementAnalysis[] = [];

  for (const [userId, points] of byUser) {
    if (points.length < 3) continue;

    const flags: string[] = [];

    // Coordinate precision analysis
    const lowPrecision = points.filter(
      (p) => p.accuracy !== null && p.accuracy > 100,
    ).length;
    const lowPrecisionRate = lowPrecision / points.length;
    if (lowPrecisionRate > 0.8) {
      flags.push("high_low_precision_rate");
    }

    // Location diversity: unique locations within 200m radius
    const uniqueLocations: Array<{ lat: number; lon: number }> = [];
    for (const point of points) {
      const isNearExisting = uniqueLocations.some((existing) => {
        const dlat = point.lat - existing.lat;
        const dlon = point.lon - existing.lon;
        // Rough 200m check (~0.002 degrees)
        return Math.abs(dlat) < 0.002 && Math.abs(dlon) < 0.002;
      });
      if (!isNearExisting) {
        uniqueLocations.push({ lat: point.lat, lon: point.lon });
      }
    }
    const uniqueLocationRate = uniqueLocations.length / points.length;
    if (uniqueLocationRate < 0.3) {
      flags.push("low_location_diversity");
    }

    // Simple cluster detection (DBSCAN-like with 200m radius)
    const clusterRadius = 0.002; // ~200m
    const visited = new Set<number>();
    let clusterCount = 0;
    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue;
      const cluster = [i];
      visited.add(i);
      for (let j = i + 1; j < points.length; j++) {
        if (visited.has(j)) continue;
        const dlat = Math.abs(points[i]!.lat - points[j]!.lat);
        const dlon = Math.abs(points[i]!.lon - points[j]!.lon);
        if (dlat < clusterRadius && dlon < clusterRadius) {
          cluster.push(j);
          visited.add(j);
        }
      }
      if (cluster.length >= 2) clusterCount++;
    }

    analyses.push({
      userId,
      totalSubmissions: points.length,
      lowPrecisionRate: Math.round(lowPrecisionRate * 100) / 100,
      uniqueLocationRate: Math.round(uniqueLocationRate * 100) / 100,
      clusterCount,
      flags,
    });
  }

  return analyses;
}
