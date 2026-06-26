"use client";
import { ShelfWithBudget } from "@/components/product/ShelfWithBudget";
import type { Product } from "@/types";
import Image from "next/image";
import { useTranslate } from "@/hooks/useTranslate";

/** Visual-search result: the uploaded photo(s) + closest Snoonu matches. */
export function PhotoMatchCard({
  srcs,
  products,
  onAdd,
  onOpen,
  faved,
  onFav,
  onDislike,
}: {
  /** The image(s) the shopper searched with. */
  srcs?: string[];
  products: Product[];
  onAdd?: (product: Product) => void;
  onOpen?: (product: Product) => void;
  faved?: (product: Product) => boolean;
  onFav?: (product: Product) => void;
  onDislike?: (product: Product) => void;
}) {
  const photos = srcs?.filter(Boolean) ?? [];
  const translate = useTranslate();
  return (
    <div className="photo-match">
      <div className="photo-match-h">
        {photos.length > 0 && (
          <div className="photo-thumbs">
            {photos.map((src, index) => (
              <div className="photo-thumb" key={index}>
                <Image
                  src={src}
                  alt={translate("Your photo {n}", { n: index + 1 })}
                  width={56}
                  height={56}
                  unoptimized
                />
              </div>
            ))}
          </div>
        )}
        <div>
          <div className="pmh-lbl">{translate("Visual search")}</div>
          <h4>{translate("Closest matches")}</h4>
          <div className="sub">{translate("Picked from Snoonu's live catalogue")}</div>
        </div>
      </div>
      <ShelfWithBudget
        products={products}
        onAdd={onAdd}
        onOpen={onOpen}
        faved={faved}
        onFav={onFav}
        onDislike={onDislike}
      />
    </div>
  );
}
