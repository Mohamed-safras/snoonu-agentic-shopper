/**
 * Map raw Kapruka MCP responses → the app's domain types (@/types).
 * Pure functions, no I/O. Prices are passed through untouched (no conversion).
 */
import type {
  RawCheckDelivery,
  RawCity,
  RawCreateOrder,
  RawPrice,
  RawProduct,
  RawSearchItem,
  RawVariant,
} from "./raw";
import type {
  CartItem,
  City,
  DeliveryQuote,
  Order,
  Product,
  ProductVariant,
} from "@/types";
import { isGenericCategory } from "@/lib/catalog/products";

function amount(price?: RawPrice | null): number {
  return price && typeof price.amount === "number" ? price.amount : 0;
}

function currencyOf(price?: RawPrice | null, fallback = "LKR"): string {
  return price?.currency || fallback;
}

/**
 * Real remaining-stock badge, e.g. "3 left" — ONLY when the MCP gives a genuine
 * numeric count. Its bare "low" string is returned for almost every product, so
 * we ignore it rather than stamp a fake "Few left" on the whole catalog.
 */
function stockBadge(stockLevel?: string): string | undefined {
  if (!stockLevel) return undefined;
  const count = parseInt(stockLevel, 10);
  if (Number.isFinite(count) && count > 0) {
    return count <= 10 ? `${count} left` : undefined; // real low count → "3 left"
  }
  return stockLevel.toLowerCase() === "low" ? "Few left" : undefined;
}

// All price-bearing fields Kapruka may use (the discounted selling price often
// sits in a different field than `price`, which can be the regular/MRP).
const PRICE_FIELDS = [
  "price",
  "sale_price",
  "special_price",
  "discounted_price",
  "final_price",
  "selling_price",
  "now_price",
  "current_price",
  "compare_at_price",
  "original_price",
  "mrp",
  "list_price",
  "was_price",
  "market_price",
  "regular_price",
];

/** Collect every positive price amount from the item's known price fields. */
function priceAmounts(item: Record<string, unknown>): number[] {
  const amounts: number[] = [];
  for (const key of PRICE_FIELDS) {
    const value = item[key];
    if (
      value &&
      typeof value === "object" &&
      typeof (value as RawPrice).amount === "number"
    ) {
      amounts.push((value as RawPrice).amount);
    } else if (typeof value === "number") {
      amounts.push(value);
    }
  }
  return amounts.filter((amountValue) => amountValue > 0);
}

/**
 * Resolve the real selling price + original (for discounts). Kapruka exposes the
 * markdown across different fields, so we take the LOWEST price-like value as
 * what the shopper pays and the HIGHEST as the original — matching the Kapruka
 * site (e.g. Rs 10,920 now, Rs 18,200 was, 40% off).
 */
function priceInfo(
  item: Record<string, unknown>,
  fallback: RawPrice,
  stockLevel?: string,
): { price: number; oldPrice?: number; badge?: string } {
  const amounts = priceAmounts(item);
  const fallbackAmount = amount(fallback);
  if (!amounts.length)
    return { price: fallbackAmount, badge: stockBadge(stockLevel) };

  const price = Math.min(...amounts);
  const original = Math.max(...amounts);
  const hasDiscount = original > price;
  const percentage = hasDiscount
    ? Math.round(((original - price) / original) * 100)
    : 0;
  return {
    price,
    oldPrice: hasDiscount ? original : undefined,
    badge:
      percentage >= 3 ? `${percentage}% off` : stockBadge(stockLevel),
  };
}

export function toProductFromSearch(item: RawSearchItem): Product {
  const pricing = priceInfo(
    item as unknown as Record<string, unknown>,
    item.price,
    item.stock_level,
  );
  return {
    id: item.id,
    name: item.name,
    brand: isGenericCategory(item.category?.name)
      ? undefined
      : item.category?.name,
    price: pricing.price,
    currency: currencyOf(item.price),
    oldPrice: pricing.oldPrice,
    image: item.image_url,
    category: (item.category?.slug || item.category?.name || "").toLowerCase(),
    blurb: item.summary,
    badge: pricing.badge,
    rating: typeof item.rating === "number" ? item.rating : undefined,
    inStock: item.in_stock ?? true,
    url: item.url,
  };
}

/** A value that's actually an image / CDN URL rather than a human-readable
 *  attribute. The MCP sometimes returns a colour as a swatch image URL, which
 *  must never surface as a variant name or spec value. */
function isUrlLike(value: string): boolean {
  const candidate = value.trim();
  return (
    /^https?:\/\//i.test(candidate) ||
    /\/s\/files\//i.test(candidate) ||
    /\.(jpe?g|png|webp|gif|svg)(\?|$)/i.test(candidate) ||
    candidate.includes("cdn.")
  );
}

function toVariant(variant: RawVariant, index: number): ProductVariant {
  // Keep only readable attributes (drop swatch/image URLs and blanks).
  const cleanedAttributes: Record<string, string> = {};
  if (variant.attributes) {
    for (const [key, value] of Object.entries(variant.attributes)) {
      if (typeof value === "string" && value.trim() && !isUrlLike(value))
        cleanedAttributes[key] = value.trim();
    }
  }
  // Prefer the MCP's own name; if it's a URL/blank, build one from the readable
  // attributes (e.g. "White / S"), falling back to a numbered option.
  const rawName = (variant.name ?? "").trim();
  const attributeName = Object.values(cleanedAttributes).join(" / ");
  const name =
    rawName && !isUrlLike(rawName)
      ? rawName
      : attributeName || `Option ${index + 1}`;

  return {
    name,
    price: variant.price ? amount(variant.price) : undefined,
    currency: variant.price ? currencyOf(variant.price) : undefined,
    inStock: variant.in_stock,
    attributes: Object.keys(cleanedAttributes).length
      ? cleanedAttributes
      : undefined,
  };
}

export function toProductFromDetail(product: RawProduct): Product {
  const pricing = priceInfo(
    product as unknown as Record<string, unknown>,
    product.price,
    product.stock_level,
  );
  return {
    id: product.id,
    name: product.name,
    brand: isGenericCategory(product.category?.name)
      ? undefined
      : product.category?.name,
    price: pricing.price,
    currency: currencyOf(product.price),
    oldPrice: pricing.oldPrice,
    image: product.images?.[0],
    images: product.images,
    category: (
      product.category?.slug ||
      product.category?.name ||
      ""
    ).toLowerCase(),
    // Detail view: prefer the FULL description (drawer shows it with show more/less).
    blurb: product.description || product.summary,
    badge: pricing.badge,
    rating: typeof product.rating === "number" ? product.rating : undefined,
    inStock: product.in_stock ?? true,
    url: product.url,
    variants: product.variants?.map(toVariant),
  };
}

export function toCity(raw: RawCity): City {
  return { key: raw.name, name: raw.name, aliases: raw.aliases };
}

export function toQuote(raw: RawCheckDelivery): DeliveryQuote {
  return {
    city: raw.city,
    cityName: raw.city,
    fee: raw.rate,
    currency: raw.currency || "LKR",
    date: raw.checked_date,
    perishableWarning: raw.perishable_warning,
    available: raw.available,
  };
}

const KAPRUKA_BASE = "https://www.kapruka.com";

const stripTrailingPunctuation = (url: string) => url.replace(/[.,;)\]]+$/, "");

/** Normalize a string that may hold a full URL, a protocol-relative URL, a bare
 *  domain+path (no scheme), or a site-relative path → an absolute https URL. */
function pickUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  // 1) A full http(s) URL anywhere in the string.
  const fullUrl = value.match(/https?:\/\/[^\s"'<>)\]]+/i);
  if (fullUrl) return stripTrailingPunctuation(fullUrl[0]);
  // 2) Protocol-relative: //host/path
  const protocolRelative = value.match(
    /\/\/[a-z0-9.-]+\.[a-z]{2,}\/[^\s"'<>)\]]+/i,
  );
  if (protocolRelative)
    return stripTrailingPunctuation("https:" + protocolRelative[0]);
  // 3) Bare domain + path (no scheme): (www.)?domain.tld/path
  const bareDomain = value.match(
    /\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/[^\s"'<>)\]]+/i,
  );
  if (bareDomain) return stripTrailingPunctuation("https://" + bareDomain[0]);
  // 4) Site-relative path.
  const trimmed = value.trim();
  if (trimmed.startsWith("/")) return KAPRUKA_BASE + trimmed;
  return undefined;
}

/** Recursively gather every string value in a response (nested objects/arrays
 *  included) so a pay link buried at any depth is still found. */
function collectStrings(value: unknown, accumulator: string[]): void {
  if (typeof value === "string") accumulator.push(value);
  else if (Array.isArray(value))
    value.forEach((item) => collectStrings(item, accumulator));
  else if (value && typeof value === "object")
    Object.values(value).forEach((item) => collectStrings(item, accumulator));
}

/** Pull the pay link out of a create_order response, tolerating field drift,
 *  missing schemes, relative paths, nesting, and URLs embedded in text — so the
 *  "Pay on Kapruka" button always points at a real, absolute URL. */
export function extractPayUrl(raw: RawCreateOrder): string | undefined {
  // 1) The intended fields, in order of preference.
  for (const field of [raw.pay_url, raw.payment_url, raw.checkout_url, raw.link]) {
    const url = pickUrl(field);
    if (url) return url;
  }
  // 2) Deep-scan every string value; prefer payment-looking URLs.
  const allStrings: string[] = [];
  collectStrings(raw, allStrings);
  const urls = allStrings
    .map(pickUrl)
    .filter((url): url is string => Boolean(url));
  return (
    urls.find((url) =>
      /pay|checkout|gateway|payhere|webxpay|sampath|order|cart/i.test(url),
    ) || urls[0]
  );
}

export function extractOrderRef(raw: RawCreateOrder): string {
  return (
    raw.order_ref ||
    raw.order_id ||
    raw.reference ||
    "KAP-" + Date.now().toString(36).toUpperCase()
  );
}

/** Compose the display Order from a create_order result + local cart context. */
export function buildOrder(
  raw: RawCreateOrder,
  ctx: {
    items: CartItem[];
    currency?: string;
    city?: string | null;
    dateLabel?: string | null;
    sameDay?: boolean;
    gift?: string | null;
    forSelf?: boolean;
    recipientName?: string | null;
    fee?: number;
  },
): Order {
  const currency = ctx.currency || ctx.items[0]?.currency || "LKR";
  const sub = ctx.items.reduce((a, it) => a + it.price * it.quantity, 0);
  const fee = ctx.fee ?? 0;
  return {
    id: extractOrderRef(raw),
    items: ctx.items,
    currency,
    sub,
    fee,
    total: sub + fee,
    city: ctx.city ?? null,
    dateLabel: ctx.dateLabel ?? null,
    sameDay: ctx.sameDay ?? false,
    gift: ctx.gift ?? null,
    forSelf: ctx.forSelf ?? false,
    recipientName: ctx.recipientName ?? null,
    payUrl: extractPayUrl(raw),
    expiresAt: raw.expires_at,
  };
}
