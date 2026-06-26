"use client";
import { useEffect, useState } from "react";
import { Shelf } from "@/components/product/Shelf";
import { loadFrequent, loadRecents } from "@/lib/catalog/recents";
import { useTrova } from "@/store";
import type { Product } from "@/types";
import { useTranslate } from "@/hooks/useTranslate";

/**
 * "Picked for you" — a personalized feed built from the shopper's own signals.
 * It LEADS with what they search most OFTEN (frequency), then recent searches
 * and the categories already in their cart — so a frequent shopper keeps being
 * shown things to buy, not only on a cleared thread. It refreshes after each
 * turn settles. Hidden when there's no signal yet (brand-new visitor sees none).
 */
export function ForYou() {
  const cart = useTrova((store) => store.cart);
  const favorites = useTrova((store) => store.favorites);
  const dislikes = useTrova((store) => store.dislikes);
  const playing = useTrova((store) => store.playing);
  const addProduct = useTrova((store) => store.addProduct);
  const toggleFav = useTrova((store) => store.toggleFav);
  const addDislike = useTrova((store) => store.addDislike);
  const setSkuProduct = useTrova((store) => store.setSkuProduct);
  const translate = useTranslate();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    // Wait until the current turn settles, then rebuild from the latest signals
    // (a just-finished search has now been recorded), most-frequent first.
    if (playing) return;
    const seeds = Array.from(
      new Set([
        ...loadFrequent(),
        ...loadRecents(),
        ...(cart.map((item) => item.category).filter(Boolean) as string[]),
      ]),
    ).slice(0, 3);
    if (!seeds.length) return;

    let cancelled = false;
    const params = new URLSearchParams({ seeds: seeds.join(",") });
    if (dislikes.length) params.set("exclude", dislikes.join(","));
    fetch("/api/for-you?" + params.toString())
      .then((response) => response.json())
      .then((data) => {
        // Only replace when there's something to show — a refetch that comes
        // back empty must NOT wipe out the suggestions already on screen.
        if (!cancelled && Array.isArray(data.products) && data.products.length)
          setProducts(data.products);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [playing, cart, dislikes]);

  const shown = products.filter((product) => !dislikes.includes(product.id));
  if (!shown.length) return null;

  return (
    <div className="feed">
      <div className="feed-head">
        <span className="feed-bar" />
        <h3>{translate("Picked for you")}</h3>
      </div>
      <Shelf
        products={shown}
        grid
        onAdd={addProduct}
        onOpen={setSkuProduct}
        faved={(product) => favorites.includes(product.id)}
        onFav={(product) => toggleFav(product.id)}
        onDislike={(product) => addDislike(product.id)}
      />
    </div>
  );
}
