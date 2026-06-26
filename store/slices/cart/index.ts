import type { SliceCreator } from "../../types";
import type { CartSlice } from "./types";

export const createCartSlice: SliceCreator<CartSlice> = (set, get) => ({
  cart: [],
  addToCart: (product) =>
    set((store) => {
      const existing = store.cart.find((item) => item.id === product.id);
      const cart = existing
        ? store.cart.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          )
        : store.cart.concat({ ...product, quantity: 1 });
      return { cart };
    }),
  addProduct: (product) => {
    get().addToCart(product);
    get().showToast("Added · " + product.name.slice(0, 28));
  },
  setQty: (id, delta) =>
    set((store) => ({
      cart: store.cart.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item,
      ),
    })),
  removeItem: (id) =>
    set((store) => ({ cart: store.cart.filter((item) => item.id !== id) })),
  removeItems: (ids) =>
    set((store) => ({
      cart: store.cart.filter((item) => !ids.includes(item.id)),
    })),
});
