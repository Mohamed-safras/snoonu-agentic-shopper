/** Resolves the earliest available delivery date via the real check_delivery
 *  tool (the same one DatePicker's grid reads from) — used by autobuy's
 *  autonomous checkout, which has no human tapping a date cell. */
import { dateLabelOf } from "@/components/checkout/DatePicker";
import type { DeliveryQuote } from "@/types";

const toISO = (date: Date) => date.toISOString().slice(0, 10);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function quoteFor(
  city: string,
  productId: string,
  iso?: string,
  retries = 2,
): Promise<DeliveryQuote | null> {
  try {
    const res = await fetch(
      `/api/delivery/quote?city=${encodeURIComponent(city)}` +
        (iso ? `&date=${iso}` : "") +
        `&product=${encodeURIComponent(productId)}`,
    );
    const data = await res.json();
    if (data.quote) return data.quote as DeliveryQuote;
    // The MCP free tier (60 req/min) is shared with everything the autobuy
    // search loop already called before checkout even started — a transient
    // rate limit here reads as "the button just doesn't work" even though
    // it's a recoverable, short-lived condition. Back off and retry a couple
    // of times instead of giving up on the first hit.
    if (retries > 0 && /rate.?limit/i.test(String(data.error))) {
      await sleep(1500);
      return quoteFor(city, productId, iso, retries - 1);
    }
    return null;
  } catch {
    return null;
  }
}

export async function findEarliestDate(
  city: string,
  productId: string,
  maxDaysOut = 6,
): Promise<{ iso: string; label: string } | null> {
  // The tool resolves its OWN earliest date when no date is given (it
  // returns `checked_date` for whichever day it picked) — a single call
  // covers the common case instead of probing day-by-day. This matters a
  // lot under the MCP free tier's 60 req/min cap: the autobuy search loop
  // already spends several calls before checkout even starts, so burning 10
  // more here (the old behavior) routinely tripped the rate limit and made
  // "Confirm & place order" silently fail.
  const undated = await quoteFor(city, productId);
  if (undated?.available && undated.date)
    return { iso: undated.date, label: dateLabelOf(undated.date) };

  // Fallback: the tool's own pick wasn't available (or it didn't resolve
  // one) — probe a SMALL window of explicit days in parallel, same pattern
  // as DatePicker's grid, capped well below the old 10 to stay rate-limit
  // friendly.
  const today = new Date();
  const offsets = Array.from({ length: maxDaysOut }, (_, offset) => offset);
  const results = await Promise.all(
    offsets.map(async (offset) => {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      const iso = toISO(date);
      const quote = await quoteFor(city, productId, iso);
      return quote?.available ? { offset, iso } : null;
    }),
  );
  const earliest = results
    .filter((entry): entry is { offset: number; iso: string } => entry !== null)
    .sort((a, b) => a.offset - b.offset)[0];
  return earliest ? { iso: earliest.iso, label: dateLabelOf(earliest.iso) } : null;
}
