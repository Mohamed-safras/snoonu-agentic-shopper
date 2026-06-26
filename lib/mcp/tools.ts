/**
 * Typed call functions for the 7 Snoonu MCP tools. Arguments are passed as
 * flat keyword arguments matching each tool's Python function signature.
 * Inputs are defined in schemas.ts, raw outputs in raw.ts, and mapping to
 * domain types in adapters.ts.
 */
import "server-only";
import { callTool } from "./client";
import { extractPayUrl } from "./adapters";
import {
  createOrderSchema,
  type CreateOrderInput,
  type SearchParams,
} from "./schemas";
import type {
  RawCategoriesResponse,
  RawCheckDelivery,
  RawCitiesResponse,
  RawCreateOrder,
  RawProduct,
  RawSearchResponse,
} from "./raw";

/* --------------------------------- reads --------------------------------- */

export async function searchProducts(
  searchParam: SearchParams,
): Promise<RawSearchResponse> {
  // The mock MCP tool expects the search term under `q`; map our `query` field
  // to it explicitly (don't spread `query` — the tool ignores an unknown arg
  // and returns nothing, so products silently stop rendering).
  const { query, limit, ...rest } = searchParam;
  // The search tool errors above 50, so clamp it. This is the safety net for
  // every caller — never request more than the cap.
  const safeLimit = Math.min(Math.max(1, limit ?? 24), 50);
  const { data } = await callTool("snoonu_search_products", {
    q: query,
    currency: "QAR",
    ...rest,
    limit: safeLimit,
  });
  return (data as RawSearchResponse) ?? { results: [] };
}

export async function getProduct(
  productId: string,
  currency = "QAR",
): Promise<RawProduct | null> {
  const { data } = await callTool("snoonu_get_product", {
    product_id: productId,
    currency,
  });
  return (data as RawProduct) ?? null;
}

export async function listCategories(
  depth = 1,
): Promise<RawCategoriesResponse> {
  const { data } = await callTool("snoonu_list_categories", { depth });
  return (data as RawCategoriesResponse) ?? { categories: [] };
}

export async function listDeliveryCities(
  query?: string,
  limit = 8,
): Promise<RawCitiesResponse> {
  const { data } = await callTool("snoonu_list_delivery_cities", {
    query: query ?? null,
    limit,
  });
  return (
    (data as RawCitiesResponse) ?? { cities: [], total_matched: 0, showing: 0 }
  );
}

export async function checkDelivery(
  city: string,
  deliveryDate?: string,
  productId?: string,
): Promise<RawCheckDelivery | null> {
  const { data } = await callTool("snoonu_check_delivery", {
    city,
    delivery_date: deliveryDate ?? null,
    product_id: productId ?? null,
  });
  return (data as RawCheckDelivery) ?? null;
}

export async function trackOrder(
  orderNumber: string,
): Promise<{ data: unknown; text: string }> {
  const res = await callTool("snoonu_track_order", {
    order_number: orderNumber,
  });
  return { data: res.data, text: res.text };
}

/* -------------------------------- create --------------------------------- */

/** Pull a shopper-friendly reason out of a Snoonu order error — pydantic
 *  validation ("Value error, …"), a coded error ("Error (product_not_found): …"),
 *  or a tool-execution wrapper ("Error executing tool …: …"). */
function cleanOrderError(text: string): string {
  const raw = (text || "").trim();
  const valueError = raw.match(/value error,\s*([^[]+)/i);
  if (valueError) return valueError[1].trim().replace(/\s+/g, " ").slice(0, 200);
  return raw
    .replace(/^.*?error executing tool[^:]*:\s*/i, "")
    .replace(/^error\s*\([^)]*\):\s*/i, "")
    .trim()
    .slice(0, 200);
}

export async function createOrder(
  input: CreateOrderInput,
): Promise<RawCreateOrder> {
  const params = createOrderSchema.parse(input); // throws on invalid → caught upstream
  const { data, text, isError } = await callTool("snoonu_create_order", params);
  const merged: RawCreateOrder =
    data && typeof data === "object" ? { ...(data as RawCreateOrder) } : {};

  // The pay URL is sometimes only inside the human-readable confirmation text
  // (not a structured field) — keep it as a fallback source for extractPayUrl.
  if (text && !merged.pay_url && !merged.payment_url && !merged.checkout_url)
    merged.link = text;

  // The order succeeded ONLY if Snoonu actually created it: a real reference, or
  // a genuine pay URL (extractPayUrl ignores error text that has no URL). A tool
  // error — or a response with neither — is a FAILURE. Surface Snoonu's own
  // reason (product not found, out of stock, date in the past, …) so the shopper
  // knows what to fix, instead of a generic "no payment link" / fake "placed".
  const hasRef = Boolean(
    merged.order_ref || merged.order_id || merged.reference,
  );
  const hasUsablePayLink = Boolean(extractPayUrl(merged));
  if (isError || (!hasRef && !hasUsablePayLink)) {
    throw new Error(cleanOrderError(text) || "Order could not be created.");
  }

  return merged;
}
