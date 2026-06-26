/** Product + cart-item shapes consumed by every UI component. */

/**
 * Unified product shape. Prices are the real Kapruka amounts in `currency`
 * (LKR by default) — never converted locally.
 */
export interface Product {
  id: string;
  name: string;
  brand?: string;
  price: number; // amount in `currency`, exactly as returned by Kapruka
  currency: string; // e.g. "LKR"
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
  url?: string; // product page on kapruka.com
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
