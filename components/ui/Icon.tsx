/** Inline SVG icon set (ported from the prototype). Presentational, no hooks. */
import type { CSSProperties } from "react";

const PATHS: Record<string, string> = {
  spark:
    "M12 2l1.8 5.3L19 9l-5.2 1.7L12 16l-1.8-5.3L5 9l5.2-1.7zM19 14l.9 2.6L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.4z",
  search:
    "M11 4a7 7 0 105.3 11.7l3.5 3.5 1.4-1.4-3.5-3.5A7 7 0 0011 4zm0 2a5 5 0 110 10 5 5 0 010-10z",
  truck:
    "M3 5h11v9H3zM14 8h3.5L21 11v3h-7zM6.5 17a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm10 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  truck2:
    "M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  cart: "M3 3h2l.4 2M7 13h10l3-7H6.4M7 13L5.4 5M7 13l-2 4h12M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z",
  gift: "M20 8h-2.3a3 3 0 10-5.7-1 3 3 0 10-5.7 1H4v4h1v8h14v-8h1V8zm-8 0a1 1 0 110-2 1 1 0 010 2zm-3 0a1 1 0 110-2 1 1 0 010 2zM6 12h5v6H6zm7 0h5v6h-5z",
  check: "M20 6L9 17l-5-5",
  pin: "M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6a2.5 2.5 0 010 5.5z",
  star: "M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  heart:
    "M12 21s-7.5-4.8-10-9.3C.3 8.3 2 5 5.2 5c2 0 3.2 1.2 3.8 2 .6-.8 1.8-2 3.8-2C16 5 17.7 8.3 16 11.7 13.5 16.2 12 21 12 21z",
  x: "M6 6l12 12M18 6L6 18",
  trash:
    "M4 7h16M10 4h4a1 1 0 011 1v2H9V5a1 1 0 011-1zM6 7v13a1 1 0 001 1h10a1 1 0 001-1V7M10 11v6M14 11v6",
  pause: "M8 5h3v14H8zM13 5h3v14h-3z",
  stop: "M8 7h8a1 1 0 011 1v8a1 1 0 01-1 1H8a1 1 0 01-1-1V8a1 1 0 011-1z",
  volume: "M4 9v6h4l5 4V5L8 9H4zM16 8.5a4 4 0 010 7M18.5 6a7 7 0 010 12",
  "volume-off": "M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6",
  pencil: "M4 20h4L18.5 9.5a2 2 0 000-3l-1-1a2 2 0 00-3 0L4 16v4zM13.5 6.5l4 4",
  mic: "M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3",
  calendar: "M7 3v3M17 3v3M4 8h16M5 5h14v15H5z",
  clock: "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z",
  bolt: "M13 2L4 14h6l-1 8 9-12h-6z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  external:
    "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3",
  receipt: "M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4",
  lock: "M6 10V8a6 6 0 1112 0v2h1v11H5V10zm2 0h8V8a4 4 0 10-8 0z",
  user: "M12 12a5 5 0 100-10 5 5 0 000 10zm0 2.2c-5.1 0-8.5 2.6-8.5 5.8V22h17v-2c0-3.2-3.4-5.8-8.5-5.8z",
  sun: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  moon: "M21.4 13.2A9 9 0 1110.8 2.6a7 7 0 0010.6 10.6z",
  monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
  chevron: "M6 9l6 6 6-6",
  trending: "M3 17l6-6 4 4 8-8M15 7h6v6",
  command:
    "M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM14 8l-4 8",
  redo: "M23 4v6h-6M20.49 15a9 9 0 11-2.12-9.36L23 10",
  settings:
    "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  bell: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
  compare: "M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4",
  "alert-triangle":
    "M12 3l10 18H2L12 3zM12 10v4M12 17h.01",
};

const STROKE_SET = new Set([
  "check",
  "arrow",
  "mic",
  "cart",
  "external",
  "truck2",
  "x",
  "plus",
  "minus",
  "search",
  "receipt",
  "sun",
  "monitor",
  "chevron",
  "clock",
  "trending",
  "command",
  "pencil",
  "trash",
  "volume",
  "volume-off",
  "redo",
  "settings",
  "bell",
  "compare",
  "alert-triangle",
]);

export interface IconProps {
  name: string;
  size?: number;
  style?: CSSProperties;
  className?: string;
}

export function Icon({ name, size = 18, style, className }: IconProps) {
  const d = PATHS[name] || PATHS.spark;
  const stroke = STROKE_SET.has(name);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={stroke ? "none" : "currentColor"}
      stroke={stroke ? "currentColor" : "none"}
      strokeWidth={stroke ? 2 : 0}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
      className={className}
    >
      <path d={d} />
    </svg>
  );
}
