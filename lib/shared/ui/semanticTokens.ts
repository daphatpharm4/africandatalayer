export const OPERATIONAL_STATUSES = [
  'idle', 'loading', 'success', 'warning', 'error',
  'offline', 'syncing', 'verified', 'flagged',
] as const;

export type OperationalStatus = (typeof OPERATIONAL_STATUSES)[number];
export type SemanticTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export const TYPOGRAPHY_ROLES = [
  'pageTitle', 'sectionTitle', 'primaryMetric', 'body',
  'secondaryBody', 'metadata', 'label', 'caption',
] as const;
export type TypographyRole = (typeof TYPOGRAPHY_ROLES)[number];

export const MAP_ANNOTATION_STATES = [
  'default', 'selected', 'verified', 'flagged', 'cluster', 'uncertainty', 'route',
] as const;
export type MapAnnotationState = (typeof MAP_ANNOTATION_STATES)[number];

export const UI_FOUNDATION = {
  spacing: [4, 8, 12, 16, 24, 32],
  radius: { control: 12, card: 16, panel: 24, pill: 9999 },
  minimumTarget: { field: 48, console: 44 },
  motionMs: { instant: 140, fast: 220, base: 320, slow: 560 },
  borderWidth: { default: 1, strong: 2 },
  iconSize: { compact: 16, control: 20, feature: 24 },
  elevation: ['flat', 'raised', 'overlay'],
} as const;

export interface StatusPresentation {
  tone: SemanticTone;
  icon: 'circle' | 'loader' | 'check' | 'triangle' | 'x' | 'wifi-off' | 'refresh' | 'shield-check' | 'flag';
}

const presentationByStatus: Record<OperationalStatus, StatusPresentation> = {
  idle: { tone: 'neutral', icon: 'circle' },
  loading: { tone: 'info', icon: 'loader' },
  success: { tone: 'success', icon: 'check' },
  warning: { tone: 'warning', icon: 'triangle' },
  error: { tone: 'danger', icon: 'x' },
  offline: { tone: 'warning', icon: 'wifi-off' },
  syncing: { tone: 'info', icon: 'refresh' },
  verified: { tone: 'success', icon: 'shield-check' },
  flagged: { tone: 'danger', icon: 'flag' },
};

const classesByTone: Record<SemanticTone, { badge: string; panel: string; text: string }> = {
  neutral: { badge: 'border-gray-200 bg-gray-100 text-ink', panel: 'border-gray-200 bg-white', text: 'text-ink' },
  primary: { badge: 'border-navy-border bg-navy-wash text-navy', panel: 'border-navy-border bg-navy-wash', text: 'text-navy' },
  success: { badge: 'border-forest/30 bg-forest-wash text-forest-dark', panel: 'border-forest/30 bg-forest-wash', text: 'text-forest-dark' },
  warning: { badge: 'border-amber/30 bg-amber-wash text-amber-dark', panel: 'border-amber/30 bg-amber-wash', text: 'text-amber-dark' },
  danger: { badge: 'border-danger/30 bg-red-50 text-danger', panel: 'border-danger/30 bg-red-50', text: 'text-danger' },
  info: { badge: 'border-navy-border bg-navy-light text-navy', panel: 'border-navy-border bg-navy-light', text: 'text-navy' },
};

export function getStatusPresentation(status: OperationalStatus): StatusPresentation {
  return presentationByStatus[status];
}

export function getToneClasses(tone: SemanticTone) {
  return classesByTone[tone];
}
