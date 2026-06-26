/** Delivery city + quote types. */

export interface City {
  key: string;
  name: string;
  aliases?: string[];
  region?: string;
  sameDay?: boolean;
  days?: number;
  fee?: number; // LKR flat rate
  lat?: number;
  lng?: number;
}

export interface DeliveryQuote {
  city: string;
  cityName?: string;
  fee: number; // flat delivery rate in `currency`
  currency: string;
  date?: string;
  perishableWarning?: string | null;
  available: boolean;
}
