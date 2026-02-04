export type SubmissionCategory = "fuel_station" | "mobile_money";

export interface SubmissionLocation {
  latitude: number;
  longitude: number;
}

export interface SubmissionDetails {
  name?: string;
  fuelType?: string;
  fuelPrice?: number;
  provider?: string;
  [key: string]: unknown;
}

export interface Submission {
  id: string;
  userId: string;
  category: SubmissionCategory;
  location: SubmissionLocation;
  details: SubmissionDetails;
  photoUrl?: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image?: string;
  occupation?: string;
  XP: number;
  passwordHash?: string;
  isAdmin?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  xp: number;
  contributions: number;
  lastContributionAt: string | null;
  lastLocation: string;
}
