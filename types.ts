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
  FUEL = 'FUEL',
  MOBILE_MONEY = 'MOBILE_MONEY'
}

export interface DataPoint {
  id: string;
  name: string;
  type: Category;
  location: string;
  price?: number;
  currency?: string;
  quality?: string;
  lastUpdated: string;
  availability: 'High' | 'Low' | 'Out';
  queueLength?: string;
  trustScore: number;
  contributorTrust?: string;
  provider?: string;
  merchantId?: string;
  hours?: string;
  paymentMethods?: string[];
  reliability?: string;
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
