"use client";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { useTranslate } from "@/hooks/useTranslate";

/**
 * Uniform wrapper for every in-thread attach card: a small labelled header with
 * a close button that COLLAPSES the card (it isn't lost), plus a "reopen" pill
 * to bring it back.
 */
export function CardShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const translate = useTranslate();
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button className="card-reopen" onClick={() => setOpen(true)}>
        <Icon name="chevron" size={14} /> {translate("Reopen {title}", { title })}
      </button>
    );
  }

  // Close button lives INSIDE the card (overlay, top-right corner).
  return (
    <div className="card-shell">
      <button
        className="card-shell-x"
        onClick={() => setOpen(false)}
        aria-label={translate("Close {title}", { title })}
        title={translate("Close")}
      >
        <Icon name="x" size={13} />
      </button>
      {children}
    </div>
  );
}
