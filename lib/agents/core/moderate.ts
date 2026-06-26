/**
 * Deterministic safety net for messages that intentionally ask for 18+/explicit
 * content or contain profanity. Runs on the raw user text BEFORE the LLM call,
 * so the warning never depends on the model noticing or complying — it always
 * fires the same way regardless of provider/prompt drift.
 */

const EXPLICIT_RE =
  /\b(porn(?:ography|hub)?|xxx|nsfw|nude[sd]?|naked photos?|sex(?:ual|y)? (?:content|video|chat|pics?|toys?)|hentai|onlyfans|escort(?:s)? service|masturbat\w*|dild(?:o|os)|vibrator|blow\s?job|cum\s?shot|anal (?:sex|vagina|lubricant)|vagina|pussy|cock|penis|orgasm|fetish|bdsm|strip(?:per|tease)|threesome|gangbang|18\+|adult[\s-]*(?:products?|content|toys?|items?|store|gifts?)|fuck(?:ing|ed)?\s+(?:in|on|the|her|him|me|my))\b/i;

const PROFANITY_RE =
  /\b(f+u+c+k+(?:ing|er|ed)?|sh[i1]t+(?:ty)?|bastard|asshole|bitch|bullshit|motherf\w*|wtf|piss off)\b/i;

export type ModerationFlag = "explicit" | "profanity" | null;

/** Classify raw user text. Returns null when nothing needs flagging. */
export function detectModerationFlag(text: string): ModerationFlag {
  if (!text) return null;
  if (EXPLICIT_RE.test(text)) return "explicit";
  if (PROFANITY_RE.test(text)) return "profanity";
  return null;
}
