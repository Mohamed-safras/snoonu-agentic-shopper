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
  // "under QAR 300", "under 300", "under QR 3,000"
  /\bunder\s*(?:qar|qr)?\s*([\d,]{3,})/i,
  // "budget is 300", "budget of QAR 300", "budget: 300"
  /\bbudget\s*(?:is|of|:)?\s*(?:qar|qr)?\s*([\d,]{3,})/i,
  // "for QAR 300", "for 300 riyals"
  /\bfor\s*(?:qar|qr)\s*([\d,]{3,})/i,
  // "QAR 300", "QR 300" anywhere
  /\b(?:qar|qr)\s*([\d,]{3,})/i,
  // "300 riyals", "300 qar"
  /\b([\d,]{3,})\s*(?:riyals?|qar)\b/i,
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
