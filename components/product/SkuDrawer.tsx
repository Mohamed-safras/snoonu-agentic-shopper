"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ProductImage } from "./ProductImage";
import { ProductCard } from "./ProductCard";
import { CompareBar } from "@/components/widgets/CompareBar";
import { CompareCard } from "@/components/widgets/CompareCard";
import { AskChat } from "@/components/widgets/AskChat";
import { Icon } from "@/components/ui/Icon";
import { fmtPrice } from "@/lib/format/money";
import { dedupeById, isGenericCategory } from "@/lib/catalog/products";
import { toWatchItem } from "@/lib/catalog/watch";
import { useTrova } from "@/store";
import { useImageAmbient } from "@/hooks/useImageAmbient";
import type { Product, ProductVariant } from "@/types";
import Link from "next/link";
import { useTranslate } from "@/hooks/useTranslate";

/** Right-side product deep-dive. Lazy-loads full detail (variants) from MCP. */
export function SkuDrawer({ product }: { product: Product }) {
  const [detail, setDetail] = useState<Product>(product);
  const [variantIdx, setVariantIdx] = useState(0);
  const [related, setRelated] = useState<Product[]>([]);
  const [aboutOpen, setAboutOpen] = useState(false);
  // Infinite-loop carousel: `pos` indexes the cloned slide track
  // ([lastClone, ...images, firstClone]); `animate` is turned off only for the
  // instant, invisible snap back after a slide wraps past an edge.
  const [pos, setPos] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [compareProducts, setCompareProducts] = useState<Product[] | null>(
    null,
  );
  const lang = useTrova((store) => store.lang);
  const translate = useTranslate();
  const animatingRef = useRef(false);
  const swipeStartXRef = useRef<number | null>(null);
  const dislikes = useTrova((store) => store.dislikes);
  const setSkuProduct = useTrova((store) => store.setSkuProduct);
  const addProduct = useTrova((store) => store.addProduct);
  const watched = useTrova((store) =>
    store.watches.some((watch) => watch.id === product.id),
  );
  const toggleWatch = useTrova((store) => store.toggleWatch);

  useEffect(() => {
    let alive = true;
    fetch(`/api/product?id=${encodeURIComponent(product.id)}`)
      .then((response) => response.json())
      .then((detail) => {
        if (!alive || !detail?.product) return;
        const full = detail.product as Product;
        // Prefer the search-result image (proven to load in the card); the
        // get_product image is sometimes missing or a broken URL that 404s.
        setDetail({
          ...full,
          image: product.image || full.image,
          images: full.images?.length
            ? full.images
            : product.image
              ? [product.image]
              : full.images,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [product.id, product.image]);

  // "You may also like" — relevant to the exact product being viewed: search by
  // its name first (closest matches), with its category as a breadth fallback.
  useEffect(() => {
    const query = product.name || product.category || product.brand || "";
    const category = product.category || product.brand || "";
    if (!query) return;
    let alive = true;
    fetch(
      `/api/related?id=${encodeURIComponent(product.id)}&q=${encodeURIComponent(query)}&cat=${encodeURIComponent(category)}&price=${product.price ?? ""}`,
    )
      .then((response) => response.json())
      .then((details) => {
        if (alive && Array.isArray(details?.products))
          setRelated(details.products as Product[]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [
    product.id,
    product.category,
    product.brand,
    product.name,
    product.price,
  ]);

  const variants: ProductVariant[] = detail.variants?.length
    ? detail.variants
    : [
        {
          name: "Default",
          price: detail.price,
          currency: detail.currency,
          inStock: detail.inStock,
        },
      ];
  const variant = variants[Math.min(variantIdx, variants.length - 1)];
  const price = variant.price ?? detail.price;
  const currency = variant.currency ?? detail.currency;
  const perishable = /flower|cake|combo/i.test(detail.category || "");
  const visibleRelated = dedupeById(related).filter(
    (product) => !dislikes.includes(product.id) && product.id !== detail.id,
  );
  const about = detail.blurb || "";
  const aboutLong = about.length > 200;
  // Real off% from the MCP compare-at price (shown only when present).
  const discountPct =
    detail.oldPrice && detail.oldPrice > price
      ? Math.round(((detail.oldPrice - price) / detail.oldPrice) * 100)
      : 0;
  // Real spec attributes from the MCP variant (material/colour/etc.), if any.
  // Weight is hidden (reads oddly without units), and empty-valued attributes
  // are skipped so we never render a blank box (e.g. an empty "Options").
  const specs = (
    variant.attributes ? Object.entries(variant.attributes) : []
  ).filter(
    ([key, value]) =>
      !/weight/i.test(key) && value != null && String(value).trim() !== "",
  );

  // All product images from the MCP: keep only valid-looking URLs and show each
  // ONCE. The search image and the get_product image are often the same picture
  // (sometimes differing only by query string), so we dedupe on the URL without
  // its query — that stops two identical slides. Broken URLs that 404 fall back
  // to the placeholder per-slide via ProductImage.
  const images: string[] = [];
  const seenImages = new Set<string>();
  for (const candidate of [detail.image, ...(detail.images ?? [])]) {
    const src = typeof candidate === "string" ? candidate.trim() : "";
    if (!/^(https?:\/\/|\/|data:image)/i.test(src)) continue;
    const key = src.split("?")[0].toLowerCase();
    if (seenImages.has(key)) continue;
    seenImages.add(key);
    images.push(src);
  }
  const slideCount = images.length;

  // Reset to the first image whenever the image set changes (new product, or
  // detail finished loading more photos) — the adjust-state-in-render pattern.
  const imagesKey = images.join("|");
  const [seenImagesKey, setSeenImagesKey] = useState(imagesKey);
  if (imagesKey !== seenImagesKey) {
    setSeenImagesKey(imagesKey);
    setPos(1);
    setAnimate(false);
  }

  // Logical index (0..n-1) regardless of clone position, for the dots + backdrop.
  const logicalIndex = slideCount ? (pos - 1 + slideCount) % slideCount : 0;
  // Glossy backdrop tinted by the photo currently in view.
  const currentImage = images[logicalIndex] ?? detail.image;
  const ambientGradient = useImageAmbient(currentImage);

  // The cloned track: a copy of the last image leads, a copy of the first trails,
  // so a single forward/backward slide always exists at either edge.
  const slides =
    slideCount > 1 ? [images[slideCount - 1], ...images, images[0]] : images;

  // Slide one step; wraps smoothly because the next slide always exists (clone).
  const step = (direction: 1 | -1) => {
    if (animatingRef.current || slideCount < 2) return;
    animatingRef.current = true;
    setAnimate(true);
    setPos((previous) => previous + direction);
  };
  // After landing on a clone, snap instantly (no transition) to the real slide.
  const onTrackTransitionEnd = () => {
    if (pos === slideCount + 1) {
      setAnimate(false);
      setPos(1);
    } else if (pos === 0) {
      setAnimate(false);
      setPos(slideCount);
    }
    animatingRef.current = false;
  };
  const goToImage = (target: number) => {
    if (animatingRef.current || target === logicalIndex) return;
    animatingRef.current = true;
    setAnimate(true);
    setPos(target + 1);
  };
  // Lightweight swipe → one step in the dragged direction.
  const onSwipeStart = (event: PointerEvent) => {
    swipeStartXRef.current = event.clientX;
  };
  const onSwipeEnd = (event: PointerEvent) => {
    const start = swipeStartXRef.current;
    swipeStartXRef.current = null;
    if (start == null) return;
    const delta = event.clientX - start;
    if (Math.abs(delta) > 40) step(delta < 0 ? 1 : -1);
  };

  const onClose = () => setSkuProduct(null);
  const onOpen = (product: Product) => setSkuProduct(product);

  return (
    <>
      <div className="sku-drawer-backdrop" onClick={onClose} />
      <div className="sku-drawer" role="dialog" aria-label={detail.name}>
        <button
          className="sku-drawer-x"
          onClick={onClose}
          aria-label={translate("Close")}
        >
          ×
        </button>
        <div className="sku-drawer-head">
          <div className="sku-drawer-sku">{translate("SKU ·")} {detail.id}</div>
        </div>
        <div className="sku-drawer-gallery">
          {/* Photo-tinted backdrop on its own layer so it can fade IN smoothly
              (a gradient on `background` can't be transitioned). */}
          <div
            className={"sku-ambient" + (ambientGradient ? " on" : "")}
            style={
              ambientGradient ? { background: ambientGradient } : undefined
            }
            aria-hidden
          />
          {slideCount > 1 ? (
            <div
              className="sku-carousel"
              onPointerDown={onSwipeStart}
              onPointerUp={onSwipeEnd}
            >
              <div
                className={"sku-track" + (animate ? "" : " no-anim")}
                style={{ transform: `translateX(-${pos * 100}%)` }}
                onTransitionEnd={onTrackTransitionEnd}
              >
                {slides.map((src, index) => (
                  <div className="sku-slide" key={index}>
                    <ProductImage product={{ ...detail, image: src }} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ProductImage product={detail} />
          )}
          {detail.inStock === false && (
            <div className="sku-stock-badge">{translate("Out of stock")}</div>
          )}
          {slideCount > 1 && (
            <>
              <button
                className="sku-gallery-nav prev"
                onClick={() => step(-1)}
                aria-label={translate("Previous image")}
              >
                <Icon
                  name="chevron"
                  size={18}
                  style={{ transform: "rotate(90deg)" }}
                />
              </button>
              <button
                className="sku-gallery-nav next"
                onClick={() => step(1)}
                aria-label={translate("Next image")}
              >
                <Icon
                  name="chevron"
                  size={18}
                  style={{ transform: "rotate(-90deg)" }}
                />
              </button>
              <div className="sku-gallery-dots">
                {images.map((_, index) => (
                  <button
                    key={index}
                    className={
                      "sku-dot" + (index === logicalIndex ? " on" : "")
                    }
                    onClick={() => goToImage(index)}
                    aria-label={translate("Image {n}", { n: index + 1 })}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <div className="sku-drawer-body">
          <div className="sku-drawer-name">{detail.name}</div>
          <div className="sku-drawer-tags">
            {detail.brand && !isGenericCategory(detail.brand) && (
              <span className="sku-tag">{detail.brand}</span>
            )}
            {detail.category &&
              !isGenericCategory(detail.category) &&
              detail.category.toLowerCase() !== detail.brand?.toLowerCase() && (
                <span className="sku-tag">{detail.category}</span>
              )}
            {typeof detail.rating === "number" && (
              <span className="sku-tag">
                <Icon name="star" size={11} /> {detail.rating.toFixed(1)}
                {detail.reviews ? ` · ${detail.reviews}` : ""}
              </span>
            )}
            <span className="sku-tag perishable">
              {translate(perishable ? "Perishable" : "Shelf-stable")}
            </span>
            <span className="sku-tag">
              {translate(
                detail.inStock === false ? "Out of stock" : "In stock",
              )}
            </span>
            {discountPct >= 3 && (
              <span className="sku-tag sale">
                {translate("{pct}% OFF", { pct: discountPct })}
              </span>
            )}
          </div>
          <button
            className={"sku-watch" + (watched ? " on" : "")}
            onClick={() => toggleWatch(toWatchItem(detail))}
            aria-pressed={watched}
          >
            <Icon name="bell" size={13} />
            {translate(
              watched ? "Watching price & stock" : "Watch price & stock",
            )}
          </button>

          {variants.length > 1 && (
            <div className="sku-variants">
              <div className="sku-section-label">
                {translate("Pick a variant")}
              </div>
              <div className="sku-variant-row">
                {variants.map((variant, index) => (
                  <button
                    key={index}
                    className={
                      "sku-variant" + (index === variantIdx ? " on" : "")
                    }
                    onClick={() => setVariantIdx(index)}
                  >
                    <div className="sku-variant-name">{variant.name}</div>
                    {variant.price != null && (
                      <div className="sku-variant-delta">
                        {fmtPrice(variant.price, variant.currency || currency)}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {specs.length > 0 && (
            <div className="sku-specs">
              {specs.map(([key, value]) => (
                <div className="sku-spec" key={key}>
                  <div className="sku-spec-k">{key}</div>
                  <div className="sku-spec-v">{value}</div>
                </div>
              ))}
            </div>
          )}

          {about && (
            <div className="sku-meta-grid">
              <div className="sku-meta" style={{ gridColumn: "span 2" }}>
                <div className="sku-meta-k">{translate("About")}</div>
                <div
                  className="sku-meta-v"
                  style={{ display: "block", lineHeight: 1.6, fontSize: 15 }}
                >
                  {aboutLong && !aboutOpen
                    ? about.slice(0, 200).trimEnd() + "… "
                    : about + " "}
                  {aboutLong && (
                    <button
                      className="sku-more-btn"
                      onClick={() => setAboutOpen((value) => !value)}
                      style={{
                        display: "inline",
                        padding: 0,
                        border: 0,
                        background: "none",
                        color: "var(--kap)",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {translate(aboutOpen ? "Show less" : "Show more")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Multi-turn chat about this product (grounded in its real detail). */}
          <div className="sku-qa">
            <div className="sku-section-label">
              <Icon name="spark" size={13} /> {translate("Ask about this")}
            </div>
            <AskChat
              endpoint="/api/product-qa"
              buildBody={(question, history) => ({
                productId: detail.id,
                question,
                history,
                lang,
              })}
              placeholder={translate("Ask about this product…")}
              starters={[
                translate("Is this good quality?"),
                translate("Who is it best for?"),
                translate("Good as a gift?"),
              ]}
            />
          </div>

          <div className="sku-cta-row">
            {detail.url && (
              <Link
                className="sku-view-cta"
                href={detail.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {translate("View on Snoonu")}{" "}
                <Icon name="external" size={13} />
              </Link>
            )}
            <button
              className="sku-drawer-cta"
              onClick={() => {
                addProduct({
                  ...detail,
                  price,
                  currency,
                  name:
                    variant.name !== "Default"
                      ? `${detail.name} (${variant.name})`
                      : detail.name,
                });
                onClose();
              }}
            >
              {translate("Add to cart · {price}", {
                price: fmtPrice(price, currency),
              })}
            </button>
          </div>

          {visibleRelated.length > 0 && (
            <div className="sku-related">
              <div className="sku-section-label">
                {translate("You may also like")}
              </div>
              <div className="sku-related-rail">
                {visibleRelated.map((product, index) => (
                  <div
                    className="sku-related-card"
                    key={product.id + "-" + index}
                  >
                    <ProductCard
                      product={product}
                      onAdd={addProduct}
                      onOpen={(related) => onOpen?.(related)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Compare tray, sticky to the drawer bottom — opening the comparison
            shows it INSIDE the drawer (no jump to the main thread). */}
        <CompareBar onCompare={setCompareProducts} />

        {compareProducts && (
          <div className="sku-compare-overlay">
            <div className="sku-compare-head">
              <button
                className="sku-compare-back"
                onClick={() => setCompareProducts(null)}
              >
                <Icon
                  name="chevron"
                  size={16}
                  style={{ transform: "rotate(90deg)" }}
                />
                {translate("Back")}
              </button>
              <span>{translate("Compare")}</span>
            </div>
            <div className="sku-compare-body">
              <CompareCard products={compareProducts} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
