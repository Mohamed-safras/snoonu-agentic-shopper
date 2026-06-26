"use client";
import Image from "next/image";
import { useTrova } from "@/store";
import { useStrings, useTranslate } from "@/hooks/useTranslate";

/**
 * Opening greeting bubble + quick-start chips. Chips are dynamic (real Snoonu
 * categories + behavior); falls back to the English seed only until they load.
 */
export function Intro({
  chips,
  onPick,
  onSurprise,
  onAutobuy,
}: {
  chips: string[];
  onPick: (text: string) => void;
  onSurprise: () => void;
  onAutobuy: () => void;
}) {
  const lang = useTrova((store) => store.lang);
  const strings = useStrings();
  const translate = useTranslate();
  const cls =
    lang === "si" ? "si-text" : lang === "ta" ? "ta-text" : lang === "ar" ? "ar-text" : "";
  const dir = lang === "ar" ? "rtl" : undefined;

  return (
    <>
      <div className="row">
        <div className="avatar">
          <Image
            src="/trova-logo.svg"
            alt={translate("Trova")}
            width={34}
            height={34}
            unoptimized
          />
        </div>
        <div className="bubble-wrap" style={{ maxWidth: "min(92%,620px)" }}>
          <div className="name-time">
            <b>{translate("Trova")}</b> · {strings.online}
          </div>
          <div className="bubble">
            <p className={"lead " + cls} dir={dir}>{strings.greet_title}</p>
            <p className={cls} dir={dir} style={{ color: "var(--ink-2)" }}>
              {strings.greet_body}
            </p>
            <p
              className={cls}
              dir={dir}
              style={{
                marginBottom: 4,
                fontWeight: 700,
                fontSize: 13.5,
                color: "var(--muted)",
              }}
            >
              {strings.suggest}
            </p>
          </div>
        </div>
      </div>
      <div className="intro-chips">
        {/* Surprise me + autobuy lead, then every dynamic suggestion chip. */}
        <button className="chip surprise-chip primary" onClick={onSurprise}>
          🎲 {translate("Surprise me")}
        </button>
        <button className="chip autobuy-chip" onClick={onAutobuy}>
          🤖 {translate("Let AI pick & order")}
        </button>
        {chips.map((c, i) => (
          <button key={c + i} className="chip" onClick={() => onPick(c)}>
            {c}
          </button>
        ))}
      </div>
    </>
  );
}
