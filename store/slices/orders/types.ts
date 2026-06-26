import type { Order } from "@/types";

/** Past orders + reordering. */
export interface OrdersSlice {
  /** Past orders (most recent first) — powers one-tap reordering. */
  orders: Order[];
  addOrder: (order: Order) => void;
  /** Re-add a past order's items to the cart for an instant repeat purchase. */
  reorder: (order: Order) => void;
  /** Re-add a past order's items and open the cart for a quick repeat. */
  reorderToCart: (order: Order) => void;
}
