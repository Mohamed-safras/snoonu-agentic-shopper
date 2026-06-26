/**
 * Tracking specialist — looks up a Snoonu order by its order number (the one
 * emailed after payment, NOT the create_order ref) and returns its progress.
 */
import "server-only";
import { trackOrder } from "@/lib/mcp/tools";

export interface TrackResult {
  /** Structured JSON when the tool returns it, else null. */
  data: unknown;
  /** Human-readable markdown fallback. */
  text: string;
}

export async function track(orderNumber: string): Promise<TrackResult> {
  return trackOrder(orderNumber);
}
