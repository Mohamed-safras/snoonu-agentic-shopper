"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import {} from "@/store";
import { useTranslate } from "@/hooks/useTranslate";

function greeting(): string {
  const hours = new Date().getHours();
  if (hours < 5) return "Working late 🌙";
  if (hours < 12) return "Good morning ☀️";
  if (hours < 17) return "Good afternoon 🌤️";
  if (hours < 21) return "Good evening 🌆";
  return "Good Evening ✨";
}

/** Brand mark + name + online/greeting line. */
export function Brand() {
  // Compute the local-time greeting only after mount (avoids SSR mismatch).
  const [greet, setGreet] = useState("");
  const translate = useTranslate();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreet(greeting());
  }, []);

  return (
    <div className="brand">
      <button
        type="button"
        className="kap-mark"
        onClick={() => window.location.reload()}
        aria-label={translate("Reload Trova")}
        title={translate("Reload")}
      >
        <Image
          src="/trova-logo.svg"
          alt={translate("Snoonu")}
          width={40}
          height={40}
          unoptimized
        />
      </button>
      <div className="brand-txt">
        <div className="brand-name">
          {translate("Trova")}{" "}
          <span className="by">{translate("× Snoonu")}</span>
        </div>
        <div className="brand-sub">
          <b>{translate("● Online")}</b>
          {greet ? " · " + translate(greet) : ""}
        </div>
      </div>
    </div>
  );
}
