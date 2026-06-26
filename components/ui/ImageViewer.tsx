"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { useTranslate } from "@/hooks/useTranslate";

/**
 * Fullscreen, centered image lightbox. Shows one image at a time from a set,
 * with prev/next controls, a counter, keyboard arrows/Esc, and touch swipe.
 * `index` is the opening image; the viewer manages its own position from there.
 * Renders nothing when `index` is null (closed).
 */
export function ImageViewer({
  images,
  index,
  onClose,
}: {
  images: string[];
  index: number | null;
  onClose: () => void;
}) {
  const translate = useTranslate();
  const [current, setCurrent] = useState(index ?? 0);
  const [openedAt, setOpenedAt] = useState(index);
  const touchStartX = useRef<number | null>(null);

  // Sync to a freshly-opened image by adjusting state DURING render (React's
  // supported pattern for deriving state from props) — not in an effect, which
  // would trigger cascading-render warnings.
  if (index !== openedAt) {
    setOpenedAt(index);
    if (index != null) setCurrent(index);
  }

  // Lock background scroll while the lightbox is open.
  useEffect(() => {
    if (index == null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [index]);

  const count = images.length;
  const go = useCallback(
    (delta: number) => setCurrent((c) => (c + delta + count) % count),
    [count],
  );

  useEffect(() => {
    if (index == null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go, onClose]);

  // Closed, empty, or rendering on the server (no document to portal into).
  if (index == null || count === 0 || typeof document === "undefined")
    return null;

  // Portal to <body> so the overlay escapes any ancestor transform/overflow and
  // truly covers the whole screen, centered above every other layer.
  return createPortal(
    <div className="img-viewer" onClick={onClose}>
      <button className="img-viewer-x" aria-label={translate("Close")} onClick={onClose}>
        <Icon name="x" size={20} />
      </button>

      {count > 1 && (
        <button
          className="img-viewer-nav prev"
          aria-label={translate("Previous")}
          onClick={(event) => {
            event.stopPropagation();
            go(-1);
          }}
        >
          <Icon name="chevron" size={22} />
        </button>
      )}

      <div
        className="img-viewer-stage"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) =>
          (touchStartX.current = event.touches[0].clientX)
        }
        onTouchEnd={(event) => {
          if (touchStartX.current == null) return;
          const dx = event.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
          touchStartX.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[current]}
          alt={translate("Attached photo {n}", { n: current + 1 })}
        />
      </div>

      {count > 1 && (
        <button
          className="img-viewer-nav next"
          aria-label={translate("Next")}
          onClick={(event) => {
            event.stopPropagation();
            go(1);
          }}
        >
          <Icon name="chevron" size={22} />
        </button>
      )}

      {count > 1 && (
        <div className="img-viewer-count">
          {current + 1} / {count}
        </div>
      )}
    </div>,
    document.body,
  );
}
