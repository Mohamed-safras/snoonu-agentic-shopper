"use client";
import { useTranslate } from "@/hooks/useTranslate";
import { useEffect, useState } from "react";

const WORDS = [
  "Browsing the catalogue",
  "Finding the perfect gift",
  "Curating ideas",
  "Checking what's in stock",
  "Planning your gift",
  "Confirming prices",
  "Reading the room",
  "Hand-picking favourites",
  "Matching your vibe",
  "Checking delivery options",
  "Comparing top picks",
  "Asking the gift concierge",
];

/** Single-word "thinking" loader shown while the agent works. */
export function Thinking() {
  const [pool] = useState(() => [...WORDS].sort(() => Math.random() - 0.5));
  const [idx, setIdx] = useState(0);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setIdx((idx) => (idx + 1) % pool.length);
      setKey((key) => key + 1);
    }, 900);
    return () => clearInterval(iv);
  }, [pool.length]);

  const translate = useTranslate();
  return (
    <div className="decipher">
      <span className="ast">*</span>
      <span className="dw" key={key}>
        {translate(pool[idx])}
      </span>
      <span className="dots">…</span>
    </div>
  );
}
