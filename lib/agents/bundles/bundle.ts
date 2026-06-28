/**
 * Shared "bundle" engine for budget-fit, multi-component carts assembled from
 * REAL Snoonu products. Used by both the Gift Hamper (occasion-driven) and
 * Smart Kits (goal-driven): each plans a few component slots (the planner lives
 * in the caller), then this module fills every slot with a real product chosen
 * to fit the shopper's budget. Nothing hardcoded — products + prices from MCP.
 */
import "server-only";
import { searchProducts } from "@/lib/mcp/tools";
import { toProductFromSearch } from "@/lib/mcp/adapters";
import { dedupeById, rankByRelevance } from "@/lib/catalog/products";
import type { Product } from "@/types";

export interface BundleSlot {
  label: string;
  selected: Product;
  /** Other in-budget options for this slot, so the shopper can swap. */
  alternatives: Product[];
}

export interface Bundle {
  slots: BundleSlot[];
  total: number;
  budget: number;
  currency: string;
}

/** One planned component: a friendly label + a Snoonu product search query. */
export interface SlotPlan {
  label: string;
  query: string;
}

export const clampCount = (count: number | null | undefined): number =>
  Math.min(5, Math.max(3, Math.round(count || 4)));

export const cleanText = (value: string | null | undefined): string =>
  value && value !== "null" ? value.trim() : "";

/** Real, in-stock-priced products for a query, best-match first. If a category
 *  constraint yields nothing (too tight for this slot), retry without it so the
 *  slot still fills with a relevant product rather than coming back empty. */
export async function rankedForQuery(
  query: string,
  category: string | undefined,
): Promise<Product[]> {
  const run = async (withCategory: string | undefined) => {
    const raw = await searchProducts({ query, limit: 24, category: withCategory });
    return rankByRelevance(
      dedupeById(raw.results.map(toProductFromSearch)),
      query,
    ).filter(
      (product) => typeof product.price === "number" && product.price > 0,
    );
  };
  const constrained = await run(category);
  if (constrained.length || !category) return constrained;
  return run(undefined); // category too restrictive for this query → broaden
}

/** Spend the budget well: repeatedly upgrade the slot whose best still-affordable
 *  alternative is the largest step up from its current pick, until no upgrade
 *  fits. Mutates `slots` in place; never lets the total exceed `budget`. */
function optimiseBudgetUsage(slots: BundleSlot[], budget: number): void {
  // Each pass upgrades exactly one slot to a strictly higher price, and a slot
  // can be upgraded at most once per alternative — worst-case number of passes.
  const maxPasses = slots.reduce(
    (sum, slot) => sum + slot.alternatives.length,
    1,
  );
  for (let pass = 0; pass < maxPasses; pass++) {
    const total = slots.reduce((sum, slot) => sum + slot.selected.price, 0);
    const headroom = budget - total;
    if (headroom <= 0) break;

    let bestSlot = -1;
    let bestGain = 0;
    let bestPick: Product | null = null;
    slots.forEach((slot, index) => {
      const ceiling = slot.selected.price + headroom;
      const upgrade = slot.alternatives
        .filter(
          (product) =>
            product.price > slot.selected.price && product.price <= ceiling,
        )
        .reduce<Product | null>(
          (best, product) =>
            !best || product.price > best.price ? product : best,
          null,
        );
      if (upgrade) {
        const gain = upgrade.price - slot.selected.price;
        if (gain > bestGain) {
          bestGain = gain;
          bestSlot = index;
          bestPick = upgrade;
        }
      }
    });

    if (bestSlot < 0 || !bestPick) break;
    slots[bestSlot] = { ...slots[bestSlot], selected: bestPick };
  }
}

/** Fill planned slots with real products under budget (pools fetched in
 *  parallel), then optimise budget usage. Falls back to a single broad search
 *  if planning/searching produced nothing, so a build always returns something. */
export async function assembleBundle(
  plans: SlotPlan[],
  budget: number,
  category: string | undefined,
  fallbackQuery: string,
): Promise<Bundle> {
  const pools = await Promise.all(
    plans.map((plan) => rankedForQuery(plan.query, category)),
  );

  const slots: BundleSlot[] = [];
  let remaining = budget;
  let currency = "QAR";

  plans.forEach((plan, index) => {
    const ranked = pools[index];
    if (!ranked.length) return;

    // Fair share of the remaining budget for this slot (leftover rolls forward).
    const slotsLeft = plans.length - index;
    const share = remaining / slotsLeft;
    const withinShare = ranked.filter((product) => product.price <= share);
    const withinRemaining = ranked.filter(
      (product) => product.price <= remaining,
    );
    const pool = withinShare.length
      ? withinShare
      : withinRemaining.length
        ? withinRemaining
        : ranked; // last resort: still offer the closest match
    const selected = pool[0];

    currency = selected.currency || currency;
    remaining = Math.max(0, remaining - selected.price);
    slots.push({
      label: plan.label,
      selected,
      // Keep a generous, budget-fit set of alternatives so the client can
      // re-fit / swap without another round-trip.
      alternatives: ranked
        .filter((product) => product.price <= budget)
        .slice(0, 14),
    });
  });

  if (!slots.length) {
    return assembleFromBroadSearch(fallbackQuery || "gift", category, budget);
  }

  optimiseBudgetUsage(slots, budget);
  const total = slots.reduce((sum, slot) => sum + slot.selected.price, 0);
  return { slots, total, budget, currency };
}

/** Last-resort bundle: one real search, then spread distinct top products across
 *  up to 4 slots within budget. Labels come from each product's own category. */
export async function assembleFromBroadSearch(
  query: string,
  category: string | undefined,
  budget: number,
): Promise<Bundle> {
  const ranked = await rankedForQuery(query, category);
  const slots: BundleSlot[] = [];
  const used = new Set<string>();
  let remaining = budget;
  let currency = "QAR";

  const count = Math.min(4, ranked.length);
  for (let index = 0; index < count; index++) {
    const slotsLeft = count - index;
    const share = remaining / slotsLeft;
    const affordable = ranked.filter(
      (product) =>
        !used.has(product.id) && product.price <= Math.max(share, remaining),
    );
    const choice =
      affordable[0] ?? ranked.find((product) => !used.has(product.id));
    if (!choice) break;
    used.add(choice.id);
    currency = choice.currency || currency;
    remaining = Math.max(0, remaining - choice.price);
    slots.push({
      label: choice.brand || choice.category || "Pick",
      selected: choice,
      alternatives: ranked
        .filter((product) => product.price <= budget)
        .slice(0, 10),
    });
  }

  const total = slots.reduce((sum, slot) => sum + slot.selected.price, 0);
  return { slots, total, budget, currency };
}
