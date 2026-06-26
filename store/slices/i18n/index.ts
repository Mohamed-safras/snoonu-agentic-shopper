import { T } from "@/lib/i18n/i18n";
import type { SliceCreator } from "../../types";
import type { I18nSlice } from "./types";

export const createI18nSlice: SliceCreator<I18nSlice> = (set, get) => ({
  lang: "en",
  setLang: (lang) => {
    set({ lang });
    void get().loadLang(lang);
    void get().retranslateThread(lang);
  },

  i18n: { en: T.en },
  loadLang: async (lang) => {
    if (lang === "en" || get().i18n[lang]) return;
    try {
      const result = await fetch("/api/i18n?lang=" + lang).then((response) =>
        response.json(),
      );
      if (result?.strings)
        set((store) => ({ i18n: { ...store.i18n, [lang]: result.strings } }));
    } catch {
      /* fall back to English until translation loads */
    }
  },
  uiTranslations: {},
});
