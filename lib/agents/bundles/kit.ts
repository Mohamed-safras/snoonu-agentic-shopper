/**
 * Smart Kits — "shop by goal". The shopper describes a NEED ("power-cut ready",
 * "study setup", "new-baby essentials") and the LLM plans the essential items
 * that solve it; the shared bundle engine fills each with a REAL Snoonu product
 * that fits the budget. Same engine as the gift hamper, goal-flavoured planner.
 */
import "server-only";
import { getProvider } from "@/lib/llm";
import { activeProviderConfigured } from "@/lib/llm";
import {
  assembleBundle,
  clampCount,
  cleanText,
  type Bundle,
  type SlotPlan,
} from "./bundle";

export interface KitOptions {
  /** How many items to plan (clamped 3–5). */
  count?: number | null;
  /** Changes each Rebuild so the LLM plans a genuinely different set. */
  nonce?: number | null;
}

/** Ask the LLM for the essential items that together solve the shopper's goal. */
async function planKitSlots(
  goal: string,
  budget: number,
  options: KitOptions,
): Promise<SlotPlan[]> {
  if (!activeProviderConfigured()) return [];
  const count = clampCount(options.count);
  try {
    const response = await getProvider().generate({
      fast: true,
      system:
        `You are a practical shopping assistant for Snoonu. The shopper describes a NEED or goal. Plan EXACTLY ${count} essential items that TOGETHER solve it and fit the total budget. ` +
        'Return ONLY JSON: {"slots":[{"label":"Power bank","query":"20000mAh power bank"},{"label":"Rechargeable lamp","query":"rechargeable LED lamp"}]}. ' +
        'Each "query" is a concise Snoonu product search (product noun + key attribute). Keep labels short. Choose real, buyable physical products — no services.' +
        (options.nonce
          ? ` Offer a fresh take (variation #${options.nonce}).`
          : ""),
      messages: [
        {
          role: "user",
          content: `Goal: ${goal}. Total budget: QAR ${budget}.`,
        },
      ],
      json: true,
      temperature: 0.7,
      maxTokens: 320,
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

/** Build a kit: plan the essentials, then fill each with a real product. */
export async function buildKit(
  goal: string | null,
  budget: number,
  options: KitOptions = {},
): Promise<Bundle> {
  const goalText = cleanText(goal) || "everyday essentials";
  const plans = await planKitSlots(goalText, budget, options);
  return assembleBundle(plans, budget, undefined, goalText);
}
