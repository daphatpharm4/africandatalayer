// lib/client/platformPointUi.ts
//
// Pure presentation helpers for the platform point picker (PlatformCollectionFlow)
// and console point badges (ReviewQueueScreen). No fetches, no state — just
// formatting shared by both screens.

import type { PlatformRecord } from "../../shared/platformTypes.js";

export const POINT_STALE_AFTER_DAYS = 30;

export type CollapsedPlatformPoint = PlatformRecord & {
  chainCount: number;
  /** Every record in the chain, newest first — one entry per survey/update.
   *  Powers the per-update history sections on the point detail. */
  chain: PlatformRecord[];
};

/**
 * Collapse a flat list of approved platform records into ONE representative
 * record per point-chain, mirroring the server's group-by-root
 * (`lib/server/platform/pointLookup.ts`). A record with no `pointId` is a chain
 * root (root = its own id); enrichments carry `pointId = root`. Without this the
 * company map renders one pin PER record, so every daily update of an asset drops
 * a duplicate pin on top of the last one instead of appending to the same point.
 *
 * The newest record (by `createdAt`) becomes the representative (latest state
 * wins); photos aggregate across the chain, newest first, deduped; `chainCount`
 * exposes how many surveys the point has.
 */
export function collapseRecordChains(records: PlatformRecord[]): CollapsedPlatformPoint[] {
  const groups = new Map<string, PlatformRecord[]>();
  for (const record of records) {
    const root = record.pointId ?? record.id;
    const group = groups.get(root);
    if (group) group.push(record);
    else groups.set(root, [record]);
  }

  const points: CollapsedPlatformPoint[] = [];
  for (const group of groups.values()) {
    const byNewest = [...group].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const base = byNewest[0];

    const photos: string[] = [];
    const seen = new Set<string>();
    for (const record of byNewest) {
      for (const photo of record.evidence?.photos ?? []) {
        if (!seen.has(photo)) {
          seen.add(photo);
          photos.push(photo);
        }
      }
    }

    points.push({
      ...base,
      evidence: { ...base.evidence, photos },
      chainCount: group.length,
      chain: byNewest,
    });
  }
  return points;
}

export function formatDistanceMeters(meters: number, _language: "en" | "fr"): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = (meters / 1000).toFixed(1);
  return `${km} km`;
}

export function pointStaleness(updatedAt: string, now: Date): { days: number; stale: boolean } {
  const updated = new Date(updatedAt).getTime();
  const days = Math.max(0, Math.floor((now.getTime() - updated) / 86_400_000));
  return { days, stale: days > POINT_STALE_AFTER_DAYS };
}

export function stalenessLabel(updatedAt: string, now: Date, language: "en" | "fr"): string {
  const { days } = pointStaleness(updatedAt, now);
  if (days === 0) return language === "fr" ? "mis à jour aujourd'hui" : "updated today";
  return language === "fr" ? `mis à jour il y a ${days} jours` : `updated ${days} days ago`;
}
