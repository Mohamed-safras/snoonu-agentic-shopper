"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useTrova } from "@/store";
import { useTranslate } from "@/hooks/useTranslate";

const EMOJI: Record<string, string> = {
  fathersday: "🧡",
  birthday: "🎉",
  anniversary: "❤️",
  romance: "🌹",
  generic: "🎁",
};

export function GiftMessage({
  occasion,
  fromName,
  onSave,
}: {
  occasion?: string | null;
  fromName?: string;
  onSave: (message: string) => void;
}) {
  const lang = useTrova((store) => store.lang);
  const translate = useTranslate();
  const [message, setMessage] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const key = occasion && EMOJI[occasion] ? occasion : "generic";

  // Real, LLM-generated suggestions (occasion + language aware).
  useEffect(() => {
    let alive = true;
    fetch(
      `/api/gift-notes?occasion=${encodeURIComponent(occasion || "")}&lang=${lang}`,
    )
      .then((response) => response.json())
      .then((d) => {
        if (alive && Array.isArray(d.notes)) setSuggestions(d.notes);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [occasion, lang]);

  return (
    <div className="gift-card-wrap">
      <div className="gift-card-header">
        <span style={{ fontSize: 28, lineHeight: 1 }}>{EMOJI[key]}</span>
        <div>
          <div className="gift-card-title">
            {translate("Add a gift message")}
          </div>
          <div className="gift-card-meta">
            {translate("Free · handwritten on a real Snoonu card 💌")}
          </div>
        </div>
      </div>
      <div className={"gift-write-area" + (focused ? " focused" : "")}>
        <textarea
          className="gift-textarea"
          rows={4}
          maxLength={300}
          placeholder={translate("Write something from the heart…")}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <div className="gift-char-count">{message.length}/300</div>
      </div>
      {suggestions.length > 0 && (
        <div className="gift-suggests">
          <div className="gift-suggests-label">
            ✨ {translate("AI quick picks")}
          </div>
          <div className="gift-suggest-row">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                className="gift-suggest-btn"
                onClick={() => setMessage(suggestion)}
              >
                {suggestion.length > 38
                  ? suggestion.slice(0, 38) + "…"
                  : suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="gift-preview-card">
        <div className="gift-preview-from">
          {translate("Preview · from {name}", {
            name: (fromName || "you").toUpperCase(),
          })}
        </div>
        <div className="gift-preview-msg">
          {message || (
            <span style={{ color: "var(--muted)", fontStyle: "italic" }}>
              {translate("Your message will appear here…")}
            </span>
          )}
        </div>
      </div>
      <div className="gift-actions">
        <button
          className="btn-primary"
          style={{ flex: 1, justifyContent: "center" }}
          onClick={() => onSave(message)}
        >
          <Icon name="check" size={15} />{" "}
          {translate(message ? "Save message" : "Skip — no message")}
        </button>
      </div>
    </div>
  );
}
