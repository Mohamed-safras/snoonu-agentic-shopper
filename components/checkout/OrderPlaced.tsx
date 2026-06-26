"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Icon } from "@/components/ui/Icon";
import { ProductImage } from "@/components/product/ProductImage";
import { WhatsAppShare } from "@/components/widgets/WhatsAppShare";
import { fmtPrice } from "@/lib/format/money";
import type { Order } from "@/types";
import { useTranslate } from "@/hooks/useTranslate";

/** Seconds left until the pay link expires — from the MCP's real `expiresAt`
 *  when present, otherwise the standard 60-minute hold. */
function secondsLeft(expiresAt?: string): number {
  if (!expiresAt) return 60 * 60;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms)) return 60 * 60;
  return Math.max(0, Math.floor(ms / 1000));
}

/**
 * Redesigned post-checkout card: a single, cohesive "order placed" experience —
 * success hero + delivery line + a real scannable pay QR with a live countdown +
 * an itemised summary + WhatsApp share / track actions. Honest: the order is
 * *placed*, payment is still pending on the genuine Snoonu pay link.
 */
export function OrderPlaced({
  order,
  onTrack,
}: {
  order: Order;
  onTrack?: () => void;
}) {
  const [secs, setSecs] = useState(() => secondsLeft(order.expiresAt));
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const payUrl = order.payUrl;
  const translate = useTranslate();

  useEffect(() => {
    const time = setInterval(
      () => setSecs((sec) => Math.max(0, sec - 1)),
      1000,
    );
    return () => clearInterval(time);
  }, []);

  useEffect(() => {
    // Autobuy already opened the pay page automatically — there's nothing
    // left to scan, so skip generating a QR nobody needs.
    if (!payUrl || order.autoOpened) return;
    QRCode.toString(payUrl, {
      type: "svg",
      margin: 1,
      width: 150,
      color: { dark: "#1A0F2E", light: "#ffffff" },
    })
      .then(setQrSvg)
      .catch(() => setQrSvg(null));
  }, [payUrl, order.autoOpened]);

  const expiryTime =
    order.expiresAt && Number.isFinite(new Date(order.expiresAt).getTime())
      ? new Date(order.expiresAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      : null;
  const expired = secs <= 0;
  const urgent = !expired && secs < 600;
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");

  return (
    <div className="oplaced">
      {/* Success hero */}
      <div className="oplaced-hero">
        <span className="oplaced-check">
          <Icon name="check" size={26} />
        </span>
        <div className="oplaced-hero-txt">
          <h3>{translate("Order placed 🎉")}</h3>
          <div className="oplaced-ref">
            {translate("Ref")} <b>{order.id}</b>
          </div>
        </div>
      </div>

      {/* For-whom line — your own order vs a gift to someone. */}
      <div className="oplaced-deliv">
        <Icon name={order.forSelf ? "cart" : "gift"} size={15} />
        <span>
          {order.forSelf ? (
            translate("Your order")
          ) : order.recipientName ? (
            <>
              {translate("Gift for")} <b>{order.recipientName}</b>
            </>
          ) : (
            translate("Gift order")
          )}
        </span>
      </div>

      {/* Delivery line */}
      {(order.city || order.dateLabel) && (
        <div className="oplaced-deliv">
          <Icon name="truck" size={15} />
          <span>
            {translate("Delivering to")}{" "}
            {order.city ? <b>{order.city}</b> : translate("your address")}
            {order.dateLabel ? (
              <>
                {" · "}
                <b>{order.dateLabel}</b>
              </>
            ) : null}
          </span>
        </div>
      )}

      {/* Itemised summary */}
      <div className="oplaced-items">
        {order.items.map((item, index) => (
          <div className="oplaced-item" key={item.id + "-" + index}>
            <ProductImage product={item} />
            <span className="oplaced-item-n">
              {item.quantity} × {item.name}
            </span>
            <span className="oplaced-item-p">
              {fmtPrice(item.price * item.quantity, order.currency)}
            </span>
          </div>
        ))}
        {order.gift ? (
          <div className="oplaced-gift">
            <Icon name="gift" size={14} /> &ldquo;{order.gift}&rdquo;
          </div>
        ) : null}
        <div className="oplaced-tot">
          <span>{translate("Subtotal")}</span>
          <span>{fmtPrice(order.sub, order.currency)}</span>
        </div>
        <div className="oplaced-tot">
          <span>
            {translate("Delivery")}
            {order.city ? ` · ${order.city}` : ""}
          </span>
          <span>{order.fee ? fmtPrice(order.fee, order.currency) : "—"}</span>
        </div>
        <div className="oplaced-tot grand">
          <span>{translate("Total")}</span>
          <span>{fmtPrice(order.total, order.currency)}</span>
        </div>
      </div>

      {/* Pay panel */}
      <div className={"oplaced-pay" + (expired ? " expired" : "")}>
        {payUrl && qrSvg && !order.autoOpened && (
          <div
            className="oplaced-qr"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        )}
        <div className="oplaced-pay-info">
          <div className="oplaced-amount-block">
            <div className="oplaced-amount">
              {fmtPrice(order.total, order.currency)}
            </div>
            <div className="oplaced-amount-label">
              {translate("Total payable")}
            </div>
          </div>
          <div className={"oplaced-timer" + (expired || urgent ? " warn" : "")}>
            <span className="oplaced-timer-dot" />
            {expired ? (
              <b>{translate("Pay window expired")}</b>
            ) : (
              <>
                {translate("Pay within")}&nbsp;
                <b>
                  {m}:{s}
                </b>
                {expiryTime
                  ? ` · ${translate("by {time}", { time: expiryTime })}`
                  : ""}
              </>
            )}
          </div>
          {payUrl && !expired ? (
            <Link
              className="oplaced-cta"
              href={payUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {translate(
                order.autoOpened ? "Open pay page again" : "Pay now on Snoonu",
              )}
              <Icon name="arrow" size={16} />
            </Link>
          ) : (
            <button className="oplaced-cta" disabled>
              {translate(
                expired ? "Pay window expired" : "Pay link unavailable",
              )}
            </button>
          )}
          <div className="oplaced-pay-foot">
            {translate(
              order.autoOpened
                ? "Already opened in a new tab — didn't see it? Tap above."
                : "Scan or tap · no Snoonu account needed",
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="oplaced-actions">
        <WhatsAppShare order={order} />
        {onTrack && (
          <button className="oplaced-track" onClick={onTrack}>
            <Icon name="pin" size={15} /> {translate("Track order")}
          </button>
        )}
      </div>
    </div>
  );
}
