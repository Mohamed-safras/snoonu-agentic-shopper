/**
 * Translate free chat lines (past messages) into a target language so switching
 * the language tab re-translates the WHOLE thread, not just new replies. Real
 * LLM translation — preserves tone, emojis, and product names/prices.
 */
import "server-only";
import { getProvider } from "@/lib/llm";
import { languageName } from "@/lib/i18n/lang";
import type { Lang } from "@/types";

export async function translateTexts(
  texts: string[],
  lang: Lang,
): Promise<string[]> {
  if (!texts.length) return [];
  const numbered = texts.map((text, index) => `${index}: ${text}`).join("\n");
  try {
    const response = await getProvider().generate({
      translate: true,
      system:
        `Translate each numbered chat line into ${languageName(lang)}. ` +
        "Write in a warm, everyday SPOKEN register (common loanwords like cake/order/delivery/gift are fine as-is), NOT a stiff word-for-word or formal literary/news translation. A native speaker should read it and feel it was written by a local, not machine-translated. " +
        "Preserve the meaning, the warm friendly tone, and any emojis. Keep product names, brands and prices EXACTLY as written (do not translate or convert them). " +
        "Keep any {curly-brace placeholders} EXACTLY as written — do not translate, reorder their words, or remove the braces. " +
        'Return ONLY JSON {"texts":[ ... ]} with the SAME number of items in the SAME order.',
      messages: [{ role: "user", content: numbered }],
      json: true,
      temperature: 0.2,
      maxTokens: 1500,
    });
    const parsed = JSON.parse(
      response.text.slice(
        response.text.indexOf("{"),
        response.text.lastIndexOf("}") + 1,
      ),
    );
    const out: unknown[] = Array.isArray(parsed?.texts) ? parsed.texts : [];
    // Map back by index; fall back to the original line on any mismatch.
    return texts.map((original, index) =>
      typeof out[index] === "string" && (out[index] as string).trim()
        ? (out[index] as string)
        : original,
    );
  } catch {
    return texts;
  }
}
