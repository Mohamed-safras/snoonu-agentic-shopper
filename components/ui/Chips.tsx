"use client";
import type { Chip } from "@/types";

export function Chips({
  items,
  onPick,
}: {
  items: Chip[];
  onPick: (c: Chip) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="chips">
      {items.map((item, index) => (
        <button
          key={index}
          className={"chip" + (item.primary ? " primary" : "")}
          onClick={() => onPick(item)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
