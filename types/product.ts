/** Product + cart-item shapes consumed by every UI component. */

/**
 * Unified product shape. Prices are the real Snoonu amounts in `currency`
 * (QAR by default) — never converted locally.
 */
export interface Product {
  id: string;
  name: string;
  brand?: string;
  price: number; // amount in `currency`, exactly as returned by Snoonu
  currency: string; // e.g. "QAR"
  oldPrice?: number; // compare-at / was-price, same currency
  image?: string; // primary direct image URL (from MCP)
  images?: string[];
  category?: string;
  tags?: string[];
  occ?: string[];
  blurb?: string;
  badge?: string;
  rating?: number;
  reviews?: number;
  sold?: number;
  emoji?: string;
  url?: string; // product page on snoonu.com
  inStock?: boolean;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  name: string;
  price?: number;
  currency?: string;
  inStock?: boolean;
  /** Spec attributes from the MCP (e.g. { Material: "Metal", Color: "Grey" }). */
  attributes?: Record<string, string>;
}

export interface CartItem extends Product {
  quantity: number;
}
