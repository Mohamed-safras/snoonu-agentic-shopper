/**
 * Raw response shapes returned by the Snoonu MCP tools (response_format=json).
 * Mirrors the shapes served by the mock Snoonu MCP server. Kept separate from
 * the app's domain types so adapter mapping stays explicit.
 */

export interface RawPrice {
  amount: number;
  currency: string;
}

export interface RawCategoryRef {
  id?: string;
  name?: string;
  slug?: string;
  path?: string;
}

export interface RawSearchItem {
  id: string;
  name: string;
  summary?: string;
  price: RawPrice;
  compare_at_price?: RawPrice | null;
  in_stock?: boolean;
  stock_level?: string;
  image_url?: string;
  category?: RawCategoryRef;
  rating?: number | null;
  ships_internationally?: boolean;
  url?: string;
}

export interface RawSearchResponse {
  results: RawSearchItem[];
  next_cursor?: string | null;
}

export interface RawVariant {
  id: string;
  name: string;
  sku?: string;
  price?: RawPrice;
  in_stock?: boolean;
  stock_level?: string;
  attributes?: Record<string, string>;
}

export interface RawProduct {
  id: string;
  name: string;
  description?: string;
  description_format?: string;
  summary?: string;
  price: RawPrice;
  compare_at_price?: RawPrice | null;
  in_stock?: boolean;
  stock_level?: string;
  category?: RawCategoryRef;
  variants?: RawVariant[];
  images?: string[];
  url?: string;
  rating?: number | null;
}

export interface RawCategory {
  name: string;
  url: string;
}

export interface RawCategoriesResponse {
  categories: RawCategory[];
}

export interface RawCity {
  name: string;
  aliases?: string[];
}

export interface RawCitiesResponse {
  cities: RawCity[];
  total_matched: number;
  showing: number;
}

export interface RawCheckDelivery {
  city: string;
  now: string;
  checked_date: string;
  available: boolean;
  rate: number;
  currency: string;
  perishable_warning: string | null;
}

/**
 * create_order returns a payment reference + click-to-pay link. Exact field
 * names are handled defensively in the adapter (the order is not trackable
 * until the customer pays and receives the emailed Snoonu order number).
 */
export interface RawCreateOrder {
  order_ref?: string;
  order_id?: string;
  reference?: string;
  pay_url?: string;
  payment_url?: string;
  checkout_url?: string;
  link?: string;
  expires_at?: string;
  total?: RawPrice | number;
  currency?: string;
  [k: string]: unknown;
}
