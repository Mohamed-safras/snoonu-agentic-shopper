/** Helpers for the price-drop / back-in-stock watchlist. */
import { useTrova } from "@/store";
import type { Product } from "@/types";
import type { WatchItem } from "@/store/slices/prefs/types";

/** Snapshot a product into a watch entry (the price/stock we'll compare later). */
export function toWatchItem(product: Product): WatchItem {
  return {
    id: product.id,
    name: product.name,
    image: product.image,
    price: product.price,
    currency: product.currency,
    url: product.url,
    inStock: product.inStock,
  };
}

/** On app open, re-check watched products for a price drop / restock (no push
 *  backend — this is the in-app refresh). Announces any change via a toast +
 *  watchlist card, and refreshes the stored snapshots so the same change isn't
 *  re-announced next time. */
export async function refreshWatchlist(): Promise<void> {
  const store = useTrova.getState();
  const watches = store.watches;
  if (!watches.length) return;

  const refreshed = await Promise.all(
    watches.map(async (watch): Promise<{ item: WatchItem; changed: boolean }> => {
      try {
        const data = await fetch(
          `/api/product?id=${encodeURIComponent(watch.id)}`,
        ).then((response) => response.json());
        const product = data?.product as Product | undefined;
        if (!product) return { item: watch, changed: false };
        const dropped =
          typeof product.price === "number" &&
          product.price > 0 &&
          product.price < watch.price;
        const restocked = product.inStock === true && watch.inStock === false;
        return {
          item: {
            ...watch,
            price: product.price > 0 ? product.price : watch.price,
            currency: product.currency || watch.currency,
            image: product.image ?? watch.image,
            inStock: product.inStock ?? watch.inStock,
          },
          changed: dropped || restocked,
        };
      } catch {
        return { item: watch, changed: false };
      }
    }),
  );

  store.updateWatches(refreshed.map((entry) => entry.item));
  const changed = refreshed.filter((entry) => entry.changed).map((e) => e.item);
  if (changed.length) {
    const names = changed.slice(0, 3).map((item) => item.name);
    store.showToast(
      `Watchlist update: ${names.join(", ")}${changed.length > 3 ? "…" : ""} 🔔`,
    );
    store.pushWatchlistUpdate();
  }
}
