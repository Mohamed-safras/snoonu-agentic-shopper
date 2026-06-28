"use client";
import { useMemo, useState } from "react";
import { ProductCard } from "./ProductCard";
import { Icon } from "@/components/ui/Icon";
import { fmtPrice } from "@/lib/format/money";
import { dedupeById, isGenericCategory } from "@/lib/catalog/products";
import type { Product, ShelfMore } from "@/types";
import { useTranslate } from "@/hooks/useTranslate";

export interface ShelfWithBudgetProps {
  title?: string;
  sub?: string;
  products: Product[];
  /** When set, a "View more" button fetches the next page via the MCP cursor. */
  more?: ShelfMore;
  onAdd?: (product: Product) => void;
  onOpen?: (product: Product) => void;
  faved?: (product: Product) => boolean;
  onFav?: (product: Product) => void;
  onDislike?: (product: Product) => void;
}

type SortKey = "default" | "priceAsc" | "priceDesc" | "rating" | "deal";

const discountFraction = (product: Product) =>
  product.oldPrice && product.oldPrice > product.price
    ? (product.oldPrice - product.price) / product.oldPrice
    : 0;
const hasDeal = (product: Product) => discountFraction(product) > 0;
const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const SORTERS: Record<
  Exclude<SortKey, "default">,
  (a: Product, b: Product) => number
> = {
  priceAsc: (a, b) => a.price - b.price,
  priceDesc: (a, b) => b.price - a.price,
  rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
  deal: (a, b) => discountFraction(b) - discountFraction(a),
};

/**
 * Product shelf with one clean, rich filter panel: a sort dropdown, a price
 * slider, and quick toggle pills (on sale / in stock / 4★+ / category). Every
 * control appears only when the real catalogue data supports it.
 */
export function ShelfWithBudget({
  title,
  sub,
  products: productsProp,
  more,
  onAdd,
  onOpen,
  faved,
  onFav,
  onDislike,
}: ShelfWithBudgetProps) {
  // Pages fetched via "View more" accumulate here and merge with the initial set.
  const [extraProducts, setExtraProducts] = useState<Product[]>([]);
  // Cursor for the NEXT page; "" means there's nothing more to load.
  const [nextCursor, setNextCursor] = useState(more?.cursor ?? "");
  const [loadingMore, setLoadingMore] = useState(false);
  // MCP search can return the same id twice (and a next page may re-list an
  // item) — dedupe so cards (and React keys) are unique.
  const products = useMemo(
    () => dedupeById([...productsProp, ...extraProducts]),
    [productsProp, extraProducts],
  );

  async function loadMore() {
    if (!more || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const url =
        "/api/more?q=" +
        encodeURIComponent(more.query) +
        (more.category ? "&category=" + encodeURIComponent(more.category) : "") +
        (more.min_price ? "&min_price=" + more.min_price : "") +
        (more.max_price ? "&max_price=" + more.max_price : "") +
        "&cursor=" +
        encodeURIComponent(nextCursor);
      const data = await fetch(url).then((response) => response.json());
      if (Array.isArray(data.products) && data.products.length)
        setExtraProducts((current) => [...current, ...data.products]);
      setNextCursor(typeof data.nextCursor === "string" ? data.nextCursor : "");
    } catch {
      // Leave the cursor in place so the shopper can tap "View more" to retry.
    } finally {
      setLoadingMore(false);
    }
  }
  const currency = products[0]?.currency || "QAR";
  const translate = useTranslate();
  const { min, max } = useMemo(() => {
    // Guard against missing/non-numeric prices — a single bad value would make
    // Math.max NaN, which silently filters out every product.
    const prices = products
      .map((product) => product.price)
      .filter(
        (price): price is number =>
          typeof price === "number" && !Number.isNaN(price),
      );
    if (!prices.length) return { min: 0, max: 0 };
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };
  }, [products]);

  const [maxPrice, setMaxPrice] = useState(max);
  // Default to the catalogue's own order ("Featured") rather than re-sorting
  // by price — that's what the shopper sees first unless they pick a sort.
  const [sort, setSort] = useState<SortKey>("default");
  const [category, setCategory] = useState<string | null>(null);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [topRatedOnly, setTopRatedOnly] = useState(false);

  const canFilterPrice = max > min;
  const canFilterSale = products.some(hasDeal);
  const canFilterRating = products.some(
    (product) => typeof product.rating === "number",
  );
  const canFilterStock = products.some((product) => product.inStock === false);
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((product) => product.category)
            .filter(
              (value): value is string => !!value && !isGenericCategory(value),
            ),
        ),
      ),
    [products],
  );

  let visibleProducts = products.filter(
    (product) =>
      // At the default cap (or when there's nothing to filter) never hide on
      // price — only narrow once the shopper actually lowers the slider.
      (maxPrice >= max || product.price <= maxPrice) &&
      (!onSaleOnly || hasDeal(product)) &&
      (!inStockOnly || product.inStock !== false) &&
      (!topRatedOnly ||
        (typeof product.rating === "number" && product.rating >= 4)) &&
      (!category || product.category === category),
  );
  if (sort !== "default")
    visibleProducts = [...visibleProducts].sort(SORTERS[sort]);

  const hiddenCount = products.length - visibleProducts.length;
  const activeFilters =
    (onSaleOnly ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (topRatedOnly ? 1 : 0) +
    (category ? 1 : 0) +
    (maxPrice < max ? 1 : 0);
  const resetFilters = () => {
    setMaxPrice(max);
    setSort("default");
    setCategory(null);
    setOnSaleOnly(false);
    setInStockOnly(false);
    setTopRatedOnly(false);
  };

  const showBar =
    canFilterPrice ||
    canFilterSale ||
    canFilterRating ||
    canFilterStock ||
    categories.length > 1 ||
    products.length > 1;

  return (
    <div className="shelf">
      <div className="shelf-head">
        <div>
          {title && <span className="shelf-title">{title}</span>}
          {sub && <span className="shelf-sub">{sub}</span>}
        </div>
      </div>

      {showBar && (
        <div className="filterbar">
          <div className="filterbar-row">
            <span className="filterbar-icon">
              <Icon name="trending" size={14} /> {translate("Filter")}
            </span>
            {products.length > 1 && (
              <select
                className="filter-select"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                aria-label={translate("Sort products")}
              >
                <option value="default">{translate("Sort: Featured")}</option>
                <option value="priceAsc">
                  {translate("Price: Low → High")}
                </option>
                <option value="priceDesc">
                  {translate("Price: High → Low")}
                </option>
                {canFilterRating && (
                  <option value="rating">{translate("Top rated")}</option>
                )}
                {canFilterSale && (
                  <option value="deal">{translate("Best discount")}</option>
                )}
              </select>
            )}
            {activeFilters > 0 && (
              <button className="filter-clear" onClick={resetFilters}>
                {translate("Clear ({n})", { n: activeFilters })}
              </button>
            )}
          </div>

          {canFilterPrice && (
            <div className="filter-price">
              <div className="filter-price-group">
                <span className="filter-price-lbl">{translate("Up to")}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(Number(event.target.value))}
                  className="budget-range"
                />
              </div>
              <span className="filter-price-val">
                {fmtPrice(maxPrice, currency)}
              </span>
            </div>
          )}

          {(canFilterSale ||
            canFilterStock ||
            canFilterRating ||
            categories.length > 1) && (
            <div className="filter-chips">
              {canFilterSale && (
                <button
                  className={"filter-chip" + (onSaleOnly ? " on" : "")}
                  onClick={() => setOnSaleOnly((value) => !value)}
                >
                  🏷️ {translate("On sale")}
                </button>
              )}
              {canFilterRating && (
                <button
                  className={"filter-chip" + (topRatedOnly ? " on" : "")}
                  onClick={() => setTopRatedOnly((value) => !value)}
                >
                  {translate("★ 4 & up")}
                </button>
              )}
              {canFilterStock && (
                <button
                  className={"filter-chip" + (inStockOnly ? " on" : "")}
                  onClick={() => setInStockOnly((value) => !value)}
                >
                  {translate("In stock")}
                </button>
              )}
              {categories.map((value) => (
                <button
                  key={value}
                  className={"filter-chip" + (category === value ? " on" : "")}
                  onClick={() =>
                    setCategory((current) => (current === value ? null : value))
                  }
                >
                  {titleCase(value)}
                </button>
              ))}
              {hiddenCount > 0 && (
                <span className="filter-hidden">
                  {translate("{n} hidden", { n: hiddenCount })}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rail grid">
        {visibleProducts.length === 0 ? (
          <div className="budget-empty">
            {translate("Nothing matches those filters —")}{" "}
            <button className="filter-link" onClick={resetFilters}>
              {translate("clear filters")}
            </button>
            .
          </div>
        ) : (
          visibleProducts.map((product, index) => (
            <ProductCard
              key={product.id + "#" + index}
              product={product}
              onAdd={onAdd}
              onOpen={onOpen}
              faved={faved?.(product)}
              onFav={onFav}
              onDislike={onDislike}
            />
          ))
        )}
      </div>

      {/* Cursor-based pagination — reveals the next page of real results. */}
      {Boolean(more) && nextCursor && (
        <div className="shelf-more">
          <button
            className="shelf-more-btn"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <span className="llm-dot">
                <i />
                <i />
                <i />
              </span>
            ) : (
              <>
                <Icon name="chevron" size={15} /> {translate("View more")}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
