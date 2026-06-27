"use client";
import { useHala } from "@/store";
import { LANGS } from "@/lib/i18n/i18n";

/** EN / AR / SI / TA language switcher. */
export function LangSwitch() {
  const language = useHala((store) => store.lang);
  const setLang = useHala((store) => store.setLang);

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
