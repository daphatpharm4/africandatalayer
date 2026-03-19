export enum Screen {
  SPLASH = 'SPLASH',
  HOME = 'HOME',
  DETAILS = 'DETAILS',
  AUTH = 'AUTH',
  CONTRIBUTE = 'CONTRIBUTE',
  SUBMISSION_QUEUE = 'SUBMISSION_QUEUE',
  PROFILE = 'PROFILE',
  ANALYTICS = 'ANALYTICS',
  SETTINGS = 'SETTINGS',
  QUALITY = 'QUALITY',
  REWARDS = 'REWARDS',
  ADMIN = 'ADMIN',
  AGENT_PERFORMANCE = 'AGENT_PERFORMANCE',
  DELTA_DASHBOARD = 'DELTA_DASHBOARD'
}

export enum Category {
  PHARMACY = 'PHARMACY',
  FUEL = 'FUEL',
  MOBILE_MONEY = 'MOBILE_MONEY',
  ALCOHOL_OUTLET = 'ALCOHOL_OUTLET',
  BILLBOARD = 'BILLBOARD',
  TRANSPORT_ROAD = 'TRANSPORT_ROAD',
  CENSUS_PROXY = 'CENSUS_PROXY'
}

export type ContributionMode = 'CREATE' | 'ENRICH';

export interface DataPoint {
  id: string;
  name: string;
  type: Category;
  location: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  price?: number;
  fuelType?: string;
  fuelTypes?: string[];
  pricesByFuel?: Record<string, number>;
  currency?: string;
  quality?: string;
  lastUpdated: string;
  updatedAtIso?: string;
  availability: 'High' | 'Low' | 'Out';
  queueLength?: string;
  trustScore: number;
  contributorTrust?: string;
  provider?: string;
  providers?: string[];
  operator?: string;
  merchantId?: string;
  hasCashAvailable?: boolean;
  hasMin50000XafAvailable?: boolean;
  hasFuelAvailable?: boolean;
  openingHours?: string;
  isOpenNow?: boolean;
  isOnDuty?: boolean;
  hours?: string;
  paymentMethods?: string[];
  reliability?: string;
  photoUrl?: string;
  details?: Record<string, unknown>;
  gaps?: string[];
  verified?: boolean;
}

export interface User {
  id: string;
  name: string;
  xp: number;
  trustLevel: number;
  city: string;
  role: 'Reader' | 'Contributor' | 'Senior Contributor';
}
