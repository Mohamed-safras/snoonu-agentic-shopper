"use client";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ProductImage } from "@/components/product/ProductImage";
import { fmtPrice } from "@/lib/format/money";
import { useTrova } from "@/store";
import type { Product } from "@/types";
import type { WatchItem } from "@/store/slices/prefs/types";
import { useTranslate } from "@/hooks/useTranslate";

/** A watch entry rendered as a (minimal) Product for the shared image/cart bits. */
function asProduct(watch: WatchItem): Product {
  return {
    id: watch.id,
    name: watch.name,
    price: watch.price,
    currency: watch.currency,
    image: watch.image,
    url: watch.url,
    inStock: watch.inStock,
  };
}

/**
 * Watchlist — the products the shopper is tracking for price drops / restock.
 * Prices are refreshed on app open (see Bootstrap.refreshWatchlist); this card
 * just lists the current snapshots with add / open / stop-watching actions.
 */
export function WatchlistCard() {
  const watches = useTrova((store) => store.watches);
  const removeWatch = useTrova((store) => store.removeWatch);
  const addProduct = useTrova((store) => store.addProduct);
  const setSkuProduct = useTrova((store) => store.setSkuProduct);
  const translate = useTranslate();

  if (!watches.length)
    return (
      <div className="watchlist-empty">
        <span className="watchlist-empty-ic">
          <Icon name="bell" size={20} />
        </span>
        {translate(
          "You're not watching anything yet. Tap the 🔔 on a product to watch its price & stock.",
        )}
      </div>
    );

  return (
    <div className="watchlist">
      <div className="watchlist-head">
        <Icon name="bell" size={14} />
        {translate("Watching {n} item(s)", { n: watches.length })}
      </div>
      {watches.map((watch) => {
        const product = asProduct(watch);
        const oos = watch.inStock === false;
        return (
          <div className={"watch-row" + (oos ? " oos" : "")} key={watch.id}>
            <button
              className="watch-thumb"
              onClick={() => setSkuProduct(product)}
              aria-label={translate("Open {name}", { name: watch.name })}
            >
              <ProductImage product={product} />
            </button>
            <div className="watch-body">
              <button
                type="button"
                className="watch-name"
                onClick={() => setSkuProduct(product)}
                title={watch.name}
              >
                {watch.name}
              </button>
              <div className="watch-meta">
                <span className="watch-price">
                  {fmtPrice(watch.price, watch.currency)}
                </span>
                {oos && (
                  <span className="watch-oos-badge">
                    {translate("Out of stock")}
                  </span>
                )}
              </div>
              {watch.url && (
                <Link
                  className="watch-link"
                  href={watch.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  {translate("View on Snoonu")}{" "}
                  <Icon name="external" size={10} />
                </Link>
              )}
            </div>
            <button
              className="watch-add"
              onClick={() => addProduct(product)}
              disabled={oos}
              title={translate(oos ? "Out of stock" : "Add to cart")}
              aria-label={translate("Add to cart")}
            >
              <Icon name="cart" size={15} />
            </button>
            <button
              className="watch-x"
              onClick={() => removeWatch(watch.id)}
              title={translate("Stop watching")}
              aria-label={translate("Stop watching")}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
