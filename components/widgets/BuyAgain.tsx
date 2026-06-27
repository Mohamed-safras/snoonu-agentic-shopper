"use client";
import { ProductCard } from "@/components/product/ProductCard";
import { dedupeById } from "@/lib/catalog/products";
import { useHala } from "@/store";
import { useTranslate } from "@/hooks/useTranslate";

/**
 * "Buy again" — item-level re-order from the shopper's past orders. One tap adds
 * a single item back to the cart (lighter than re-ordering a whole past order).
 * Hidden until there's at least one past order.
 */
export function BuyAgain() {
  const orders = useHala((store) => store.orders);
  const favorites = useHala((store) => store.favorites);
  const addProduct = useHala((store) => store.addProduct);
  const toggleFav = useHala((store) => store.toggleFav);
  const setSkuProduct = useHala((store) => store.setSkuProduct);
  const translate = useTranslate();

  // Most-recent orders first (the orders slice already prepends new ones).
  const items = dedupeById(orders.flatMap((order) => order.items)).slice(0, 12);
  if (!items.length) return null;

  return (
    <div className="feed">
      <div className="feed-head">
        <span className="feed-bar" />
        <h3>{translate("Buy again")}</h3>
        <span className="feed-sub">{translate("From your past orders")}</span>
      </div>
      <div className="rail">
        {items.map((product, index) => (
          <ProductCard
            key={product.id + "#" + index}
            product={product}
            onAdd={addProduct}
            onOpen={setSkuProduct}
            faved={favorites.includes(product.id)}
            onFav={() => toggleFav(product.id)}
          />
        ))}
      </div>
    </div>
  );
}
