import type { MapScope } from '../../shared/types';

/** Single source of truth for the admin's selected Explorer-map scope, shared by
 *  the Home map's in-map toggle and the Profile screen's scope control so the two
 *  never drift. The scope is persisted per-device in localStorage; a window event
 *  lets a live (mounted) map react immediately when the scope changes elsewhere. */
export const ADMIN_MAP_SCOPE_STORAGE_KEY = 'adl_admin_map_scope';
export const ADMIN_MAP_SCOPE_EVENT = 'adl-map-scope-changed';

export function isMapScope(value: unknown): value is MapScope {
  return value === 'bonamoussadi' || value === 'cameroon' || value === 'global';
}

export function readStoredAdminMapScope(): MapScope {
  if (typeof window === 'undefined') return 'bonamoussadi';
  try {
    const stored = window.localStorage.getItem(ADMIN_MAP_SCOPE_STORAGE_KEY);
    if (isMapScope(stored)) return stored;
  } catch {
    // Ignore storage access failures and fall back to the default admin scope.
  }
  return 'bonamoussadi';
}

/** Persist the chosen scope and notify any mounted map to update immediately. */
export function broadcastAdminMapScope(scope: MapScope): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ADMIN_MAP_SCOPE_STORAGE_KEY, scope);
  } catch {
    // Ignore storage failures; the dispatched event still updates a live map.
  }
  window.dispatchEvent(new CustomEvent<MapScope>(ADMIN_MAP_SCOPE_EVENT, { detail: scope }));
}
