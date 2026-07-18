// lib/client/platformPointUi.ts
//
// Pure presentation helpers for the platform point picker (PlatformCollectionFlow)
// and console point badges (ReviewQueueScreen). No fetches, no state — just
// formatting shared by both screens.

export const POINT_STALE_AFTER_DAYS = 30;

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
