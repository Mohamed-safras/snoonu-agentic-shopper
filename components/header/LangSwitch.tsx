"use client";
import { useTrova } from "@/store";
import { LANGS } from "@/lib/i18n/i18n";

/** EN / AR / SI / TA language switcher. */
export function LangSwitch() {
  const language = useTrova((store) => store.lang);
  const setLang = useTrova((store) => store.setLang);

  return (
    <div className="lang-switch">
      {LANGS.map((lang) => (
        <button
          key={lang.code}
          className={language === lang.code ? "on" : ""}
          onClick={() => setLang(lang.code)}
          title={lang.name}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
