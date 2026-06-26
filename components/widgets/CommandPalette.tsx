"use client";
import { useEffect, useState } from "react";
import { filterCommands, type CommandId } from "@/lib/ui/commands";
import { useTranslate } from "@/hooks/useTranslate";

/**
 * Slash-command menu. Opens when the composer text starts with "/" and filters
 * live as the user keeps typing. ↑/↓ to move, Enter to run, Esc to dismiss.
 */
export function CommandPalette({
  query,
  onRun,
  onClose,
}: {
  query: string;
  onRun: (id: CommandId) => void;
  onClose: () => void;
}) {
  const items = filterCommands(query);
  const [index, setIndex] = useState(0);
  const translate = useTranslate();

  // Reset the highlight when the query (and therefore the list) changes. Done
  // during render — the recommended pattern over a setState-in-effect.
  const [seenQuery, setSeenQuery] = useState(query);
  if (query !== seenQuery) {
    setSeenQuery(query);
    setIndex(0);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!items.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setIndex((current) => (current + 1) % items.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setIndex((current) => (current - 1 + items.length) % items.length);
      } else if (event.key === "Enter") {
        // Stop the composer's own Enter handler from also firing (double-run).
        event.preventDefault();
        event.stopPropagation();
        const chosen = items[index] ?? items[0];
        if (chosen) onRun(chosen.id);
      } else if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [items, index, onRun, onClose]);

  if (!items.length) return null;

  return (
    <div className="as-pop cmd-pop" role="listbox">
      <div className="cmd-head">{translate("Quick commands")}</div>
      <div className="as-list">
        {items.map((command, itemIndex) => (
          <div
            key={command.id}
            className={"as-item cmd-item" + (itemIndex === index ? " on" : "")}
            onMouseEnter={() => setIndex(itemIndex)}
            onMouseDown={(event) => {
              event.preventDefault();
              onRun(command.id);
            }}
          >
            <span className="cmd-emoji">{command.emoji}</span>
            <span className="cmd-text">
              <b>/{command.id}</b>
              <span className="cmd-hint">
                {translate(command.label)} · {translate(command.hint)}
              </span>
            </span>
          </div>
        ))}
      </div>
      <div className="as-foot">
        {translate("Type to filter · ↑↓ navigate · ↵ run")}
      </div>
    </div>
  );
}
