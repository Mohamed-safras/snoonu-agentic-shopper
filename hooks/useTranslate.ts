import { Strings, T } from "@/lib/i18n/i18n";
import { interpolate, Vars } from "@/lib/i18n/translate";
import { requestTranslation } from "@/lib/i18n/on-demand";
import { useTrova } from "@/store";
import { useCallback } from "react";

/** Translate any UI literal into the active language, with `{placeholder}`
 *  interpolation. English is a no-op. An un-cached literal returns its English
 *  text for now and is queued for on-demand translation (cached after), so new
 *  strings translate automatically with no catalog to maintain.
 *  Usage: `const translate = useTranslate(); translate("Add")`. */
export function useTranslate(): (template: string, vars?: Vars) => string {
  const lang = useTrova((store) => store.lang);
  const translations = useTrova((store) => store.uiTranslations[store.lang]);
  return useCallback(
    (template: string, vars?: Vars) => {
      if (lang === "en") return interpolate(template, vars);
      const hit = translations?.[template];
      if (hit === undefined) requestTranslation(lang, template); // fetch + cache
      return interpolate(hit ?? template, vars);
    },
    [lang, translations],
  );
}

/** Current language's UI strings (real LLM translation, English fallback).
 *  English always comes straight from code so a cached snapshot can't go stale. */
export function useStrings(): Strings {
  return useTrova((store) =>
    store.lang === "en" ? T.en : (store.i18n[store.lang] ?? T.en),
  );
}
