"use client";
import { useTranslate } from "@/hooks/useTranslate";
import { fmtPrice } from "@/lib/format/money";
import type { Order } from "@/types";
import Link from "next/link";

/** Share an order summary to WhatsApp. */
export function WhatsAppShare({
  order,
  label,
}: {
  order: Order;
  label?: string;
}) {
  const translate = useTranslate();
  // Plain ASCII only — no emoji or special glyphs (×, •), which rendered as
  // broken characters for some recipients. Clean text shares reliably anywhere.
  const lines: string[] = [];
  lines.push(`Order ${order.id} via Hala x Snoonu`);
  for (const item of order.items)
    lines.push(`- ${item.quantity}x ${item.name}`);
  if (order.dateLabel) lines.push(`Delivery: ${order.dateLabel}`);
  if (order.gift) lines.push(`Gift note: "${order.gift}"`);
  lines.push(`Total: ${fmtPrice(order.total, order.currency)}`);
  if (order.payUrl) lines.push("Pay: " + order.payUrl);

  const url = "https://wa.me/?text=" + encodeURIComponent(lines.join("\n"));
  return (
    <Link
      className="wa-share"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-1 1.2-.4.2-.7.1-1.3-.5-2.4-1.5c-.9-.8-1.5-1.8-1.7-2.1s0-.5.1-.6c.1-.1.3-.4.4-.5s.1-.3.2-.5 0-.4 0-.5-.6-1.5-.9-2.1-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.4 1 2.8 1.2 3 2 3 4.8 4.2c.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4s.2-1.3.2-1.4-.3-.2-.6-.4z" />
        <path
          d="M20.5 3.5a10 10 0 00-17 9.5L2 22l9.3-1.5a10 10 0 009.2-17z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      <span>{label || translate("Share on WhatsApp")}</span>
    </Link>
  );
}
