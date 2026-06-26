/**
 * Gift Hamper Builder — the LLM plans a few COMPLEMENTARY gift components for
 * the occasion, then the shared bundle engine fills each slot with a REAL
 * Snoonu product that fits the shopper's budget. Nothing hardcoded.
 */
import "server-only";
import { getProvider } from "@/lib/llm";
import { activeProviderConfigured } from "@/lib/llm";
import {
  assembleBundle,
  clampCount,
  cleanText,
  type Bundle,
  type BundleSlot,
  type SlotPlan,
} from "./bundle";

// The hamper is a bundle; keep these names for existing importers.
export type Hamper = Bundle;
export type HamperSlot = BundleSlot;

/** Extra ways to shape the hamper, on top of occasion + budget. */
export interface HamperOptions {
  /** Restrict every component to this Snoonu category (from list_categories). */
  category?: string | null;
  /** Free-text theme / keywords the shopper typed (e.g. "tea lover, pastel"). */
  theme?: string | null;
  /** How many components to plan (clamped 3–5). */
  count?: number | null;
  /** Who it's for, to bias the picks (e.g. "her", "kids", "parents"). */
  recipient?: string | null;
  /** Changes each Rebuild so the LLM plans a genuinely different set. */
  nonce?: number | null;
}

/** Ask the LLM for complementary hamper components for the occasion, honouring
 *  count, recipient, an optional category constraint and a free-text theme. */
async function planSlots(
  occasion: string,
  budget: number,
  options: HamperOptions,
): Promise<SlotPlan[]> {
  if (!activeProviderConfigured()) return [];
  const category = cleanText(options.category);
  const theme = cleanText(options.theme);
  const recipient = cleanText(options.recipient);
  const count = clampCount(options.count);
  const constraints = [
    recipient ? `It's for: ${recipient}.` : "",
    theme ? `Theme / keywords to honour: ${theme}.` : "",
    category
      ? `Every component MUST belong to the "${category}" category — plan sub-types within it.`
      : "",
    options.nonce ? `Offer a fresh take (variation #${options.nonce}).` : "",
  ]
    .filter(Boolean)
    .join(" ");
  try {
    const response = await getProvider().generate({
      fast: true,
      system:
        `You design gift hampers for Snoonu. Plan EXACTLY ${count} COMPLEMENTARY components that go together for the occasion and fit the total budget. ` +
        'Return ONLY JSON: {"slots":[{"label":"Flowers","query":"red roses bouquet"},{"label":"Something sweet","query":"chocolate cake"}]}. ' +
        'Each "query" is a concise Snoonu product search (product noun + key attribute). Keep labels short and friendly.',
      messages: [
        {
          role: "user",
          content:
            `Occasion: ${occasion}. Total budget: LKR ${budget}.` +
            (constraints ? ` ${constraints}` : ""),
        },
      ],
      json: true,
      temperature: 0.7,
      maxTokens: 280,
    });
    const parsed = JSON.parse(
      response.text.slice(
        response.text.indexOf("{"),
        response.text.lastIndexOf("}") + 1,
      ),
    );
    const slots: unknown[] = Array.isArray(parsed?.slots) ? parsed.slots : [];
    return slots
      .map((slot) => slot as { label?: unknown; query?: unknown })
      .filter(
        (slot) =>
          typeof slot.label === "string" && typeof slot.query === "string",
      )
      .slice(0, count)
      .map((slot) => ({
        label: String(slot.label),
        query: String(slot.query),
      }));
  } catch {
    return [];
  }
}

/** Build a hamper: plan slots, then fill each with a real product under budget. */
export async function buildHamper(
  budget: number,
  occasion: string | null,
  options: HamperOptions = {},
): Promise<Hamper> {
  const occasionLabel = cleanText(occasion) || "a thoughtful gift";
  const category = cleanText(options.category) || undefined;
  const theme = cleanText(options.theme);
  const plans = await planSlots(occasionLabel, budget, options);
  const fallbackQuery =
    [theme, category, occasionLabel].filter(Boolean).join(" ") || "gift";
  return assembleBundle(plans, budget, category, fallbackQuery);
}
