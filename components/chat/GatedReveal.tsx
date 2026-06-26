"use client";
import { Icon } from "@/components/ui/Icon";
import { ProductImage } from "@/components/product/ProductImage";
import { useTrova } from "@/store";
import { useTranslate } from "@/hooks/useTranslate";
import type { Product } from "@/types";

const SAMPLE_COUNT = 4;

/** Stands in for a product card/shelf flagged as explicit: a few SAMPLE
 *  thumbnails rendered blurred behind a confirm prompt — not the full
 *  (possibly long) result set, so there's never a tall wall to render or
 *  scroll past. The real content (passed lazily so it never mounts before
 *  confirmation) swaps in once the shopper confirms, showing everything. */
export function GatedReveal({
  gated,
  products,
  children,
}: {
  gated?: boolean;
  /** A few of the actual results, shown blurred as a preview. */
  products: Product[];
  /** Lazy so the real card/images never mount before confirmation. */
  children: () => React.ReactNode;
}) {
  const translate = useTranslate();
  const ageConfirmed = useTrova((store) => store.ageConfirmed);
  const confirmAge = useTrova((store) => store.confirmAge);

  if (!gated || ageConfirmed) return <>{children()}</>;

  const sample = products.slice(0, SAMPLE_COUNT);

  return (
    <div className="gate-wrap">
      <div className="gate-peek" aria-hidden="true">
        {sample.map((product, index) => (
          <ProductImage key={product.id + index} product={product} />
        ))}
      </div>
      <div className="gate-overlay">
        <span className="gate-card-ic">
          <Icon name="lock" size={20} />
        </span>
        <p className="gate-title">{translate("18+ content")}</p>
        <p>
          {translate(
            "These results may include 18+ content. Confirm you're an adult to view them.",
          )}
        </p>
        <button className="gate-confirm" onClick={confirmAge}>
          <Icon name="check" size={14} />
          {translate("I'm 18 or older — show me")}
        </button>
      </div>
    </div>
  );
}
