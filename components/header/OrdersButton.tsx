"use client";
import { Icon } from "@/components/ui/Icon";
import { useTranslate } from "@/hooks/useTranslate";
import { useTrova } from "@/store";

/** Opens the orders drawer — only shown once there are past orders. */
export function OrdersButton() {
  const ordersCount = useTrova((store) => store.orders.length);
  const setOrdersOpen = useTrova((store) => store.setOrdersOpen);
  const translate = useTranslate();

  if (ordersCount === 0) return null;

  return (
    <button
      className="theme-toggle orders-btn"
      onClick={() => setOrdersOpen(true)}
      title={translate("Your orders")}
      aria-label={translate("Your orders")}
    >
      <Icon name="receipt" size={16} />
      <span className="orders-count">{ordersCount}</span>
    </button>
  );
}
