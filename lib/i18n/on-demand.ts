/**
 * On-demand UI translation. When `useTranslate` meets a string that isn't cached
 * yet (e.g. copy added in a future component), it queues it here; we batch the
 * misses and translate them via `/api/translate` (non-LLM MT engine), then cache
 * the result in the store (persisted) so it's instant forever after.
 *
 * This is what removes any need to maintain a catalog by hand — any string the
 * app renders gets translated automatically the first time it appears.
 */
"use client";
import { useHala } from "@/store";
import type { Lang } from "@/types";

const pendingByLang = new Map<Lang, Set<string>>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const BATCH_DELAY_MS = 200;

/** Queue a missing literal for translation into `lang` (deduped + batched). */
export function requestTranslation(lang: Lang, template: string): void {
  if (lang === "en" || !template) return;
  const cached = useHala.getState().uiTranslations[lang];
  if (cached && template in cached) return; // already have it
  let pending = pendingByLang.get(lang);
  if (!pending) pendingByLang.set(lang, (pending = new Set()));
  if (pending.has(template)) return;
  pending.add(template);
  if (!flushTimer) flushTimer = setTimeout(flush, BATCH_DELAY_MS);
}

async function flush(): Promise<void> {
  flushTimer = null;
  const batches = [...pendingByLang.entries()];
  pendingByLang.clear();
  for (const [lang, set] of batches) {
    const texts = [...set];
    if (!texts.length) continue;
    try {
      const data = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, texts }),
      }).then((response) => response.json());
      const translated: string[] = Array.isArray(data?.texts)
        ? data.texts
        : texts;
      const current = { ...(useHala.getState().uiTranslations[lang] ?? {}) };
      texts.forEach((text, index) => {
        const value = translated[index];
        // Only cache a REAL translation. If the backend fell back to the
        // original (no provider/MT configured, or the call failed), leave it
        // unmapped so the next render's cache-miss check retries it instead of
        // being stuck on English forever.
        if (value && value !== text) current[text] = value;
      });
      useHala.setState((store) => ({
        uiTranslations: { ...store.uiTranslations, [lang]: current },
      }));
    } catch {
      /* leave queued strings as English; they'll be retried on next render */
    }
  }
}
