import type { SliceCreator } from "../../types";
import type { OrdersSlice } from "./types";

export const createOrdersSlice: SliceCreator<OrdersSlice> = (set, get) => ({
  orders: [],
  addOrder: (order) =>
    set((store) => ({
      orders: [order, ...store.orders.filter((o) => o.id !== order.id)].slice(
        0,
        6,
      ),
    })),
  reorder: (order) => set({ cart: order.items.map((item) => ({ ...item })) }),
  reorderToCart: (order) => {
    get().reorder(order); // refill the cart with the past order's items
    get().showToast("Added your previous order — review & checkout 🛒");
    get().setCartOpen(true);
  },
});
