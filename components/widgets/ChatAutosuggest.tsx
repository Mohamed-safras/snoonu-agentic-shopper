"use client";
import { useEffect, useRef, useState } from "react";
import { useTrova } from "@/store";
import { loadRecents } from "@/lib/catalog/recents";
import { Icon } from "@/components/ui/Icon";
import { useTranslate } from "@/hooks/useTranslate";

interface Suggestion {
  text: string;
  kind: "product" | "recent" | "trending";
}

/**
 * Autosuggest backed by REAL Kapruka catalog search (/api/suggest) while typing,
 * and by behavior (recent searches) + dynamic trending (store.suggestions, which
 * come from real categories) when empty. Nothing hardcoded.
 */
export function ChatAutosuggest({
  query,
  onPick,
  onClose,
}: {
  query: string;
  onPick: (text: string) => void;
  onClose: () => void;
}) {
  const trending = useTrova((s) => s.suggestions);
  const translate = useTranslate();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [index, setIndex] = useState(-1);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const qry = query.trim();
    if (debRef.current) clearTimeout(debRef.current);
    // Run everything in the (async) debounce callback so we never call setState
    // synchronously inside the effect body.
    debRef.current = setTimeout(
      async () => {
        if (qry.length < 2) {
          const recents: Suggestion[] = loadRecents()
            .slice(0, 4)
            .map((text) => ({ text, kind: "recent" }));
          const trend: Suggestion[] = trending
            .filter(
              (trend) =>
                !recents.some(
                  (recent) => recent.text.toLowerCase() === trend.toLowerCase(),
                ),
            )
            .slice(0, 6 - recents.length)
            .map((text) => ({ text, kind: "trending" }));
          setItems([...recents, ...trend]);
          return;
        }
        try {
          const result = await fetch(
            "/api/suggest?q=" + encodeURIComponent(qry),
          ).then((response) => response.json());
          setItems((result.suggestions ?? []).slice(0, 6));
        } catch {
          setItems([]);
        }
      },
      qry.length < 2 ? 0 : 220,
    );
    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [query, trending]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!items.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setIndex((index) => (index + 1) % items.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setIndex((index) => (index - 1 + items.length) % items.length);
      } else if (event.key === "Enter" && index >= 0 && items[index]) {
        event.preventDefault();
        onPick(items[index].text);
      } else if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [items, index, onPick, onClose]);

  if (!items.length) return null;

  function highlight(text: string) {
    const qry = query.trim();
    if (!qry) return text;
    const queryIndex = text.toLowerCase().indexOf(qry.toLowerCase());
    if (queryIndex < 0) return text;
    return (
      <>
        {text.slice(0, queryIndex + qry.length)}
        <b>{text.slice(queryIndex + qry.length)}</b>
      </>
    );
  }

  return (
    <div className="as-pop" role="listbox">
      <div className="as-list">
        {items.map((item, itemIndex) => (
          <div
            key={item.kind + item.text}
            className={"as-item" + (itemIndex === index ? " on" : "")}
            onMouseEnter={() => setIndex(itemIndex)}
            onMouseDown={(event) => {
              event.preventDefault();
              onPick(item.text);
            }}
          >
            <span className="as-ico">
              <Icon
                name={
                  item.kind === "recent"
                    ? "clock"
                    : item.kind === "trending"
                      ? "trending"
                      : "search"
                }
                size={14}
              />
            </span>
            <span className="as-text">{highlight(item.text)}</span>
          </div>
        ))}
      </div>
      <div className="as-foot">
        {translate("Live Snoonu catalog · your recent & trending")}
      </div>
    </div>
  );
}
