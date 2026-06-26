"use client";
import { Icon } from "@/components/ui/Icon";
import { ProductImage } from "@/components/product/ProductImage";
import { useTrova } from "@/store";
import type { Product } from "@/types";
import { useTranslate } from "@/hooks/useTranslate";

/**
 * Floating tray that collects products the shopper tapped "compare" on. Appears
 * once anything is staged; tapping Compare (≥2 items) opens the comparison. By
 * default it opens in the main thread; pass `onCompare` (e.g. from the product
 * drawer) to show the comparison in place instead.
 */
export function CompareBar({
  onCompare,
}: {
  onCompare?: (products: Product[]) => void;
}) {
  const compareItems = useTrova((store) => store.compareItems);
  const toggleCompare = useTrova((store) => store.toggleCompare);
  const clearCompare = useTrova((store) => store.clearCompare);
  const pushAttach = useTrova((store) => store.pushAttach);
  const translate = useTranslate();

  if (!compareItems.length) return null;

  function openCompare() {
    if (compareItems.length < 2) return;
    if (onCompare) onCompare(compareItems);
    else pushAttach({ kind: "compare", products: compareItems });
    clearCompare();
  }

  return (
    <div className="compare-bar">
      <span className="compare-bar-label">
        <Icon name="compare" size={14} /> {translate("Compare")}
      </span>
      <div className="compare-bar-thumbs">
        {compareItems.map((product) => (
          <button
            key={product.id}
            className="compare-bar-thumb"
            onClick={() => toggleCompare(product)}
            title={translate("Remove {name}", { name: product.name })}
            aria-label={translate("Remove {name} from compare", { name: product.name })}
          >
            <ProductImage product={product} />
            <span className="compare-bar-x">
              <Icon name="x" size={11} />
            </span>
          </button>
        ))}
      </div>
      <button
        className="compare-bar-go"
        onClick={openCompare}
        disabled={compareItems.length < 2}
      >
        <Icon name="compare" size={15} /> {translate("Compare ({n})", { n: compareItems.length })}
      </button>
      <button
        className="compare-bar-clear"
        onClick={clearCompare}
        aria-label={translate("Clear compare")}
        title={translate("Clear")}
      >
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}
