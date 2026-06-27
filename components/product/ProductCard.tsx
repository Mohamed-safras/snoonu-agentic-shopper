"use client";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProductImage } from "./ProductImage";
import { fmtPrice } from "@/lib/format/money";
import { isGenericCategory } from "@/lib/catalog/products";
import { useHala } from "@/store";
import { toWatchItem } from "@/lib/catalog/watch";
import type { Product } from "@/types";
import Link from "next/link";
import { useTranslate } from "@/hooks/useTranslate";

export interface ProductCardProps {
  product: Product;
  onAdd?: (product: Product) => void;
  onOpen?: (product: Product) => void;
  faved?: boolean;
  onFav?: (product: Product) => void;
  onDislike?: (product: Product) => void;
}

export function ProductCard({
  product,
  onAdd,
  onOpen,
  faved,
  onFav,
  onDislike,
}: ProductCardProps) {
  const [added, setAdded] = useState(false);
  // Watch state is read straight from the store so any card can toggle it
  // without every shelf having to thread watch props through.
  const watched = useHala((store) =>
    product ? store.watches.some((watch) => watch.id === product.id) : false,
  );
  const toggleWatch = useHala((store) => store.toggleWatch);
  const comparing = useHala((store) =>
    product ? store.compareItems.some((item) => item.id === product.id) : false,
  );
  const toggleCompare = useHala((store) => store.toggleCompare);
  const translate = useTranslate();

  if (!product) return null;

  function add(event: React.MouseEvent) {
    event.stopPropagation();
    onAdd?.(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  const badgeCls =
    product?.badge && /off/i.test(product?.badge) ? "badge sale" : "badge";

  return (
    <div
      className="card"
      onClick={() => onOpen?.(product)}
      style={{ cursor: onOpen ? "pointer" : "default" }}
    >
      <div className="card-media-wrap">
        <ProductImage product={product} />
        {/* Like — top-left. */}
        {onFav && (
          <button
            className={"fav" + (faved ? " on" : "")}
            onClick={(event) => {
              event.stopPropagation();
              onFav(product);
            }}
            aria-label={translate("Save to favourites")}
          >
            <Icon name="heart" size={15} />
          </button>
        )}
        {/* Not-interested — top-right. */}
        {onDislike && (
          <div className="card-actions">
            <button
              className="card-act card-dislike"
              onClick={(event) => {
                event.stopPropagation();
                onDislike(product);
              }}
              aria-label={translate("Not interested — remove this product")}
              title={translate("Not interested")}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        )}
        {/* Stock / sale tag — bottom-left of the image. */}
        {product?.badge && <span className={badgeCls}>{product.badge}</span>}
        {/* Compare · watch — bottom of the image, as a row. */}
        <div className="card-actions-bottom">
          <button
            className={"card-act card-compare" + (comparing ? " on" : "")}
            onClick={(event) => {
              event.stopPropagation();
              toggleCompare(product);
            }}
            title={translate(
              comparing ? "Remove from compare" : "Add to compare",
            )}
            aria-label={translate(
              comparing ? "Remove from compare" : "Add to compare",
            )}
            aria-pressed={comparing}
          >
            <Icon name="compare" size={13} />
          </button>
          <button
            className={"card-act card-watch" + (watched ? " on" : "")}
            onClick={(event) => {
              event.stopPropagation();
              toggleWatch(toWatchItem(product));
            }}
            title={translate(
              watched ? "Watching — tap to stop" : "Watch price & stock",
            )}
            aria-label={translate(
              watched ? "Stop watching" : "Watch price & stock",
            )}
            aria-pressed={watched}
          >
            <Icon name="bell" size={13} />
          </button>
        </div>
      </div>
      <div className="card-body">
        {product.brand && !isGenericCategory(product.brand) && (
          <div className="card-brand">{product.brand}</div>
        )}
        <div className="card-name" title={product.name}>
          {product.name}
        </div>
        {typeof product.rating === "number" && (
          <div className="card-rate">
            <Icon name="star" size={12} />
            {product.rating.toFixed(1)}
            {product.reviews ? <span>· {product.reviews}</span> : null}
          </div>
        )}
        {product.url && (
          <Link
            className="card-link"
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            {translate("View on Snoonu")} <Icon name="external" size={11} />
          </Link>
        )}
        <div className="card-foot">
          <div className="price-row">
            <div className="price">
              {fmtPrice(product.price, product.currency)}
            </div>
            {product.oldPrice && (
              <div className="price-old">
                {fmtPrice(product.oldPrice, product.currency)}
              </div>
            )}
          </div>
          {onAdd && (
            <button
              className={"card-add" + (added ? " added" : "")}
              onClick={add}
              title={translate(added ? "Added to cart" : "Add to cart")}
              aria-label={translate(added ? "Added to cart" : "Add to cart")}
            >
              {added ? (
                <Icon name="check" size={16} />
              ) : (
                <>
                  <Icon name="plus" size={11} />
                  <Icon name="cart" size={15} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
