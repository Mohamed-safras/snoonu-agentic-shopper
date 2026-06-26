"use client";
import { useState } from "react";
import { ProductImage } from "./ProductImage";
import { Icon } from "@/components/ui/Icon";
import { fmtPrice } from "@/lib/format/money";
import { isGenericCategory } from "@/lib/catalog/products";
import type { Product } from "@/types";
import Link from "next/link";
import { useTranslate } from "@/hooks/useTranslate";

/** Immersive single-product hero used for a featured recommendation. */
export function Spotlight({
  product,
  onAdd,
  onClose,
}: {
  product: Product;
  onAdd?: (p: Product) => void;
  onClose?: () => void;
}) {
  const translate = useTranslate();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    setAdded(true);
    onAdd?.(product);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div
      className="spotlight-wrap"
      style={{ ["--accent" as string]: "#4C2D8F" }}
    >
      <div
        className="spotlight-blob"
        style={{
          background:
            "radial-gradient(ellipse at 30% 40%, #4C2D8F33 0%, transparent 70%)",
        }}
      />
      {onClose && (
        <button
          className="spotlight-close"
          onClick={onClose}
          aria-label={translate("Close")}
        >
          ×
        </button>
      )}
      <div className="spotlight-inner">
        <div className="spotlight-img-wrap">
          <ProductImage product={product} />
        </div>
        <div className="spotlight-info">
          {product.badge && (
            <div className="spotlight-badge">{product.badge}</div>
          )}
          <div className="spotlight-name">{product.name}</div>
          <div className="spotlight-brand">
            {product.brand && !isGenericCategory(product.brand)
              ? product.brand
              : "Snoonu"}
            {typeof product.rating === "number"
              ? ` · ⭐ ${product.rating.toFixed(1)}`
              : ""}
          </div>
          <div className="spotlight-price-row">
            <span className="spotlight-price">
              {fmtPrice(product.price, product.currency)}
            </span>
            {product.oldPrice && (
              <span className="price-old">
                {fmtPrice(product.oldPrice, product.currency)}
              </span>
            )}
          </div>
          {product.blurb && (
            <div className="spotlight-desc">{product.blurb.slice(0, 180)}</div>
          )}
          <div className="spotlight-actions">
            <button
              className={"btn-primary spotlight-add" + (added ? " added" : "")}
              onClick={handleAdd}
            >
              {added ? translate("✓ Added!") : translate("Add to cart")}
            </button>
            {product.url && (
              <Link
                className="btn-ghost"
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {translate("View on Snoonu")} <Icon name="external" size={13} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
