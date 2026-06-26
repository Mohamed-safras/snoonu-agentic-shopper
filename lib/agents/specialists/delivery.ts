/**
 * Delivery specialist — resolves Snoonu delivery cities and fetches real
 * flat-rate quotes (with perishable warnings) for a city + date. Pure MCP.
 */
import "server-only";
import { checkDelivery, listDeliveryCities } from "@/lib/mcp/tools";
import { toCity, toQuote } from "@/lib/mcp/adapters";
import type { City, DeliveryQuote } from "@/types";

export async function findCities(query: string, limit = 8): Promise<City[]> {
  const raw = await listDeliveryCities(query, limit);
  return raw.cities.map(toCity);
}

export async function quoteDelivery(
  city: string,
  date?: string,
  productId?: string,
): Promise<DeliveryQuote | null> {
  const raw = await checkDelivery(city, date, productId);
  return raw ? toQuote(raw) : null;
}
