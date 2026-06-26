/**
 * Deterministic safety net for the router's `search.max_price` extraction —
 * runs independently of the LLM (same philosophy as core/moderate.ts), so a
 * budget the shopper clearly stated never silently gets lost to model
 * sampling variance. Only used as a FALLBACK when the model's own JSON
 * field came back empty; the model is still the primary source (it correctly
 * ignores filler numbers like quantities) — this only catches the cases
 * where it dropped a real one.
 */

const PATTERNS = [
  // "under Rs 3000", "under 3000", "under LKR 3,000"
  /\bunder\s*(?:rs\.?|lkr)?\s*([\d,]{3,})/i,
  // "budget is 3000", "budget of Rs 3000", "budget: 3000"
  /\bbudget\s*(?:is|of|:)?\s*(?:rs\.?|lkr)?\s*([\d,]{3,})/i,
  // "for Rs 3000", "for 3000 rupees"
  /\bfor\s*(?:rs\.?|lkr)\s*([\d,]{3,})/i,
  // "Rs 3000", "LKR 3000" anywhere
  /\b(?:rs\.?|lkr)\s*([\d,]{3,})/i,
  // "3000 rupees", "3000 lkr"
  /\b([\d,]{3,})\s*(?:rupees|lkr)\b/i,
];

/** Pull a plausible budget ceiling out of free text, or null if none found.
 *  Deliberately conservative (3+ digit numbers only) to avoid mistaking a
 *  quantity ("12 roses") for a price. */
export function extractBudgetHint(text: string): number | null {
  for (const pattern of PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const value = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return null;
}
