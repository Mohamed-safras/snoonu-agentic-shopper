/** Real LLM-generated gift-card message suggestions (occasion + language aware). */
import "server-only";
import { getProvider } from "@/lib/llm";
import type { Lang } from "@/types";

const LANG_HINT: Record<Lang, string> = {
  en: "English",
  ar: "Arabic script",
  si: "Sinhala script",
  ta: "Tamil script",
};

export async function giftNotes(occasion: string | null, lang: Lang): Promise<string[]> {
  const occ = occasion && occasion !== "null" ? occasion : "a thoughtful gift";
  const res = await getProvider().generate({
    fast: true,
    system: `Write exactly 3 heartfelt gift-card messages for "${occ}", in ${LANG_HINT[lang]}. Each should be a real card note — 2 to 4 sentences (about 30–55 words), warm and genuine in tone, the kind you'd actually write inside a card. Return ONLY JSON: {"notes":["...","...","..."]}.`,
    messages: [{ role: "user", content: `Occasion: ${occ}` }],
    json: true,
    temperature: 0.9,
    maxTokens: 500,
  });
  try {
    const parsed = JSON.parse(res.text.slice(res.text.indexOf("{"), res.text.lastIndexOf("}") + 1));
    const notes = Array.isArray(parsed?.notes) ? parsed.notes.filter((n: unknown) => typeof n === "string") : [];
    return notes.slice(0, 3);
  } catch {
    return [];
  }
}
