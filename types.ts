export enum Screen {
  SPLASH = 'SPLASH',
  HOME = 'HOME',
  DETAILS = 'DETAILS',
  AUTH = 'AUTH',
  CONTRIBUTE = 'CONTRIBUTE',
  PROFILE = 'PROFILE',
  ANALYTICS = 'ANALYTICS',
  SETTINGS = 'SETTINGS',
  QUALITY = 'QUALITY',
  REWARDS = 'REWARDS',
  ADMIN = 'ADMIN'
}

export enum Category {
  PHARMACY = 'PHARMACY',
  FUEL = 'FUEL',
  MOBILE_MONEY = 'MOBILE_MONEY'
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
  availability: 'High' | 'Low' | 'Out';
  queueLength?: string;
  trustScore: number;
  contributorTrust?: string;
  provider?: string;
  providers?: string[];
  merchantId?: string;
  hasCashAvailable?: boolean;
  hasFuelAvailable?: boolean;
  openingHours?: string;
  isOpenNow?: boolean;
  hours?: string;
  paymentMethods?: string[];
  reliability?: string;
  photoUrl?: string;
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
