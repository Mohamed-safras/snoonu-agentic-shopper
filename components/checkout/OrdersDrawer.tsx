"use client";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { fmtPrice } from "@/lib/format/money";
import { useHala } from "@/store";
import type { Order } from "@/types";
import { useTranslate } from "@/hooks/useTranslate";

/** A pay link is still usable if it exists and hasn't expired. */
function payable(order: Order): boolean {
  if (!order.payUrl) return false;
  if (!order.expiresAt) return true;
  const ms = new Date(order.expiresAt).getTime();
  return !Number.isFinite(ms) || ms > Date.now();
}

export function OrdersDrawer() {
  const orders = useHala((store) => store.orders);
  const ordersOpen = useHala((store) => store.ordersOpen);
  const setOrdersOpen = useHala((store) => store.setOrdersOpen);
  const reorderToCart = useHala((store) => store.reorderToCart);
  const pushAttach = useHala((store) => store.pushAttach);
  const patchConv = useHala((store) => store.patchConv);
  const translate = useTranslate();

  const onReorder = (order: Order) => {
    reorderToCart(order);
    setOrdersOpen(false);
  };

  const onTrack = (order: Order) => {
    patchConv({ lastOrder: order });
    pushAttach({ kind: "tracking", order });
    setOrdersOpen(false);
  };

  if (!ordersOpen) return null;
  return (
    <>
      <div className="scrim" onClick={() => setOrdersOpen(false)} />
      <aside className="drawer">
        <div className="drawer-h">
          <Icon name="receipt" size={20} />
          <h3>{translate("Your orders")}</h3>
          <button className="x" onClick={() => setOrdersOpen(false)}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="drawer-body">
          {orders.length === 0 && (
            <div className="cart-empty">
              <Icon name="receipt" size={54} />
              <div>
                {translate("No orders yet — your placed orders show up here.")}
              </div>
            </div>
          )}
          {orders.map((order) => {
            const count = order.items.reduce((a, it) => a + it.quantity, 0);
            return (
              <div className="order-line" key={order.id}>
                <div className="order-line-top">
                  <span className="order-line-id">{order.id}</span>
                  <span className="order-line-total">
                    {fmtPrice(order.total, order.currency)}
                  </span>
                </div>
                <div className="order-line-meta">
                  {translate("{n} items", { n: count })}
                  {order.city ? ` · ${order.city}` : ""}
                  {order.dateLabel ? ` · ${order.dateLabel}` : ""}
                </div>
                <div className="order-line-items">
                  {order.items
                    .map((it) => `${it.quantity}× ${it.name}`)
                    .join(", ")}
                </div>
                {payable(order) && (
                  <div className="order-line-status">
                    ⏳{" "}
                    {translate(
                      "Awaiting payment — pay to confirm, then track with the order number Snoonu emails you.",
                    )}
                  </div>
                )}
                <div className="order-line-actions">
                  {payable(order) && (
                    <Link
                      className="ol-btn pay"
                      href={order.payUrl as string}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="external" size={14} /> {translate("Pay now")}
                    </Link>
                  )}
                  <button className="ol-btn" onClick={() => onReorder(order)}>
                    <Icon name="cart" size={14} /> {translate("Order again")}
                  </button>
                  <button
                    className="ol-btn ghost"
                    onClick={() => onTrack(order)}
                  >
                    <Icon name="pin" size={14} /> {translate("Track")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
