"use client";
import { ProductCard } from "./ProductCard";
import { dedupeById } from "@/lib/catalog/products";
import type { Product } from "@/types";

export interface ShelfProps {
  title?: string;
  sub?: string;
  products: Product[];
  onAdd?: (p: Product) => void;
  onOpen?: (p: Product) => void;
  faved?: (p: Product) => boolean;
  onFav?: (p: Product) => void;
  onDislike?: (p: Product) => void;
  grid?: boolean;
}

export function Shelf({
  title,
  sub,
  products,
  onAdd,
  onOpen,
  faved,
  onFav,
  onDislike,
  grid,
}: ShelfProps) {
  const unique = dedupeById(products);
  if (!unique.length) return null;
  return (
    <div className="shelf">
      {title && (
        <div className="shelf-head">
          <span className="shelf-title">{title}</span>
          {sub && <span className="shelf-sub">{sub}</span>}
        </div>
      )}
      <div className={"rail" + (grid ? " grid" : "")}>
        {unique.map((product, index) => (
          <ProductCard
            key={product.id + "#" + index}
            product={product}
            onAdd={onAdd}
            onOpen={onOpen}
            faved={faved?.(product)}
            onFav={onFav}
            onDislike={onDislike}
          />
        ))}
      </div>
    </div>
  );
}
