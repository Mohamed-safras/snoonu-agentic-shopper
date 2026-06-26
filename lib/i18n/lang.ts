/**
 * Language detection for real-time multilingual chat. The shopper can write in
 * Arabic, Sinhala, Tamil, or English at any time — the assistant should reply
 * in the SAME language, not whatever the UI toggle says.
 */
import type { Lang } from "@/types";

const ARABIC = /[؀-ۿ]/; // Arabic Unicode block
const SINHALA = /[඀-෿]/; // Sinhala Unicode block
const TAMIL = /[஀-௿]/; // Tamil Unicode block

/** Detect Arabic/Sinhala/Tamil from the actual script used (strong, reliable
 *  signal). Latin text (English) returns null — the LLM mirrors that. */
export function detectScriptLang(text: string): Lang | null {
  if (ARABIC.test(text)) return "ar";
  if (SINHALA.test(text)) return "si";
  if (TAMIL.test(text)) return "ta";
  return null;
}

/** The language to reply in: the script the user actually typed wins (so they
 *  can switch language mid-conversation just by typing in it), otherwise the
 *  UI-selected language. */
export function resolveReplyLang(text: string, uiLang: Lang): Lang {
  return detectScriptLang(text) ?? uiLang;
}

/** Human-readable language name for instructing the LLM. */
export function languageName(lang: Lang): string {
  switch (lang) {
    case "ar":
      return "Arabic (العربية script)";
    case "si":
      return "Sinhala (සිංහල script)";
    case "ta":
      return "Tamil (தமிழ் script)";
    default:
      return "English";
  }
}
