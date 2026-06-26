"use client";
import { Icon } from "@/components/ui/Icon";
import { fmtPrice } from "@/lib/format/money";
import type { Order } from "@/types";
import { useTranslate } from "@/hooks/useTranslate";

/** One-tap reordering: surfaces past orders so repeat purchases (groceries,
 *  daily items) are instant — re-adds the whole order to the cart. */
export function RecentOrders({
  orders,
  onReorder,
}: {
  orders: Order[];
  onReorder: (order: Order) => void;
}) {
  const translate = useTranslate();
  if (!orders.length) return null;
  return (
    <div className="recent-orders">
      <div className="recent-orders-h">
        <Icon name="clock" size={14} /> {translate("Order again")}
      </div>
      <div className="recent-orders-rail">
        {orders.map((order) => {
          const count = order.items.reduce((a, it) => a + it.quantity, 0);
          const names = order.items
            .map((it) => `${it.quantity}× ${it.name}`)
            .join(", ");
          return (
            <button
              key={order.id}
              className="reorder-card"
              onClick={() => onReorder(order)}
              title={translate("Reorder: {names}", { names })}
            >
              <div className="reorder-top">
                <span className="reorder-count">
                  {translate(count > 1 ? "{count} items" : "{count} item", {
                    count,
                  })}
                </span>
                <span className="reorder-total">
                  {fmtPrice(order.total, order.currency)}
                </span>
              </div>
              <div className="reorder-items">{names}</div>
              <span className="reorder-cta">
                <Icon name="cart" size={14} /> {translate("Order again")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
