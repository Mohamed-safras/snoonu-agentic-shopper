import type { Strings } from "@/lib/i18n/i18n";
import type { Lang } from "@/types";

/** Language + LLM-translated UI strings (English is the source). */
export interface I18nSlice {
  lang: Lang;
  setLang: (lang: Lang) => void;
  i18n: Partial<Record<Lang, Strings>>;
  loadLang: (lang: Lang) => Promise<void>;
  /** UI-copy translations keyed by English literal, filled on demand + cached. */
  uiTranslations: Partial<Record<Lang, Record<string, string>>>;
}
