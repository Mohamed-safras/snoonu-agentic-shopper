/**
 * The structured decision the orchestrator LLM returns for a free-text turn.
 * Validated with zod so a malformed model response degrades gracefully.
 */
import { z } from "zod";
import type { Chip } from "@/types";

export const routerDecisionSchema = z.object({
  /** Where to route this turn. */
  intent: z
    .enum([
      "discovery",
      "delivery",
      "gift",
      "checkout",
      "track",
      "concierge",
      "chat",
      "autobuy",
    ])
    .default("chat"),
  /** Warm, in-language reply shown to the user. */
  message: z.string().default(""),
  /** Quick-reply suggestions. */
  chips: z
    .array(
      z.object({
        label: z.string(),
        action: z.string().optional(),
        payload: z.string().optional(),
        primary: z.boolean().optional(),
      }),
    )
    .default([]),
  /** Detected occasion, drives ambient mood theming. */
  occasion: z.string().nullish(),
  /** Product search to run when intent = discovery. The model is prompted to
   *  send the distilled keywords as `q`; we also accept `query` for safety and
   *  normalize to `query`, so a key mismatch never voids the whole decision
   *  (which previously dropped us back to a raw-text keyword search). */
  search: z
    .preprocess(
      (value) => {
        if (value && typeof value === "object") {
          const object = value as Record<string, unknown>;
          if (object.query == null && typeof object.q === "string")
            return { ...object, query: object.q };
        }
        return value;
      },
      z
        .object({
          query: z.string().min(2),
          category: z.string().optional(),
          min_price: z.number().optional(),
          max_price: z.number().optional(),
          /** Desired item COUNT (e.g. 12 roses) — only when the user means a count. */
          quantity: z.number().int().positive().optional(),
          /** Only show in-stock items (the user asked for availability). */
          in_stock: z.boolean().optional(),
        })
        .optional(),
    )
    // A malformed search must not void the whole decision — drop it instead.
    .catch(undefined),
  /** Feature the top result as a spotlight above the shelf. */
  spotlight: z.boolean().optional(),
});

export type RouterDecision = z.infer<typeof routerDecisionSchema>;

/* ----------------------- parsing a model response ------------------------ */

/** Pull the first balanced JSON object out of a model response. */
function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      try {
        return JSON.parse(text.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Pull just the "message" string out of (possibly truncated) JSON text. */
function salvageMessage(text: string): string {
  const message = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!message) return "";
  try {
    return JSON.parse('"' + message[1] + '"');
  } catch {
    return message[1];
  }
}

// Provider/transport error text that must never reach the user as a reply.
const PROVIDER_ERROR_RE =
  /(request failed|retry later|rate ?limit|quota|temporarily unavailable|openai|anthropic|\bgroq\b|\bgemini\b|api[ _-]?key|too many requests|internal (server )?error|\b(429|500|502|503)\b)/i;

const NEUTRAL_REPLY =
  "Sure — what would you like to find today? I can help with gifts, flowers, cakes, groceries and more. 🌸";

/** Parse + validate a model response into a RouterDecision, degrading
 *  gracefully (salvage the message; never surface raw JSON or provider errors). */
export function parseDecision(text: string): RouterDecision {
  const raw = extractJsonObject(text);
  const result = routerDecisionSchema.safeParse(raw);
  if (result.success) {
    if (result.data.message && PROVIDER_ERROR_RE.test(result.data.message))
      result.data.message = "";
    return result.data;
  }

  const salvaged = salvageMessage(text);
  return routerDecisionSchema.parse({
    intent: "chat",
    message:
      salvaged && !PROVIDER_ERROR_RE.test(salvaged) ? salvaged : NEUTRAL_REPLY,
    chips: [],
  });
}

/**
 * Navigation actions are only honored when the chip's label actually matches
 * that intent — otherwise the model often mis-tags a product chip (e.g. "Roses"
 * → open_cart). Mismatches fall back to "chat" so tapping runs a real search.
 */
const NAV_GUARD: Record<string, RegExp> = {
  open_cart: /\bcart\b/i,
  to_delivery: /deliver|send it|ship|where to/i,
  checkout: /checkout|\bpay\b|place order|order now/i,
  track: /track|where.*order|order status/i,
};

function sanitizeAction(label: string, action?: string): Chip["action"] {
  if (!action) return "chat";
  if (action === "concierge") return "concierge";
  const guard = NAV_GUARD[action];
  if (guard) return guard.test(label) ? (action as Chip["action"]) : "chat";
  // Any other action (add / browse / occasion / unknown) → treat as a search.
  return "chat";
}

const hasLeadingEmoji = (text: string) =>
  /^\p{Extended_Pictographic}/u.test(text.trim());

const KEYWORD_EMOJI: [RegExp, string][] = [
  [/rose/, "🌹"],
  [/bouquet/, "💐"],
  [/flower|bloom|lily|orchid/, "🌸"],
  [/choc|ferrero|truffle/, "🍫"],
  [/cake|gateau|bento/, "🎂"],
  [/macaron|dessert|sweet/, "🍰"],
  [/hamper|basket/, "🧺"],
  [/ring|necklace|pendant|jewel/, "💍"],
  [/watch/, "⌚"],
  [/grocery|groceries|rice|veg/, "🛒"],
  [/electronic|gadget|charger/, "📱"],
  [/headphone|earbud|earphone/, "🎧"],
  [/power\s?bank/, "🔋"],
  [/perfume|fragrance|cologne/, "🧴"],
  [/saree|fashion|cloth|dress|shirt/, "👗"],
  [/bag|tote|handbag/, "👜"],
  [/home|kitchen|lamp/, "🏠"],
  [/wine|liquor|whisky/, "🍷"],
  [/book|novel/, "📚"],
  [/baby|kid|toy/, "🧸"],
  [/cheap|budget|under/, "💸"],
];

function chipEmoji(label: string, action: Chip["action"]): string {
  if (action === "open_cart") return "🛒";
  if (action === "to_delivery") return "🚚";
  if (action === "checkout") return "💳";
  if (action === "track") return "📦";
  if (action === "concierge") return "✨";
  const l = label.toLowerCase();
  for (const [re, e] of KEYWORD_EMOJI) if (re.test(l)) return e;
  return "🎁";
}

/** Coerce + sanitize chips, and guarantee a relevant leading emoji on each. */
export function toChips(decision: RouterDecision): Chip[] {
  return decision.chips
    .filter((chip) => chip.label && chip.label.trim())
    .map((chip) => {
      const action = sanitizeAction(chip.label, chip.action);
      const text = chip.label.trim();
      const label = hasLeadingEmoji(text)
        ? text
        : `${chipEmoji(text, action)} ${text}`;
      return { label, action, payload: chip.payload, primary: chip.primary };
    });
}
