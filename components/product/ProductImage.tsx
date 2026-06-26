"use client";
import { useState } from "react";
import type { Product } from "@/types";
import Image from "next/image";

const CAT_EMOJI: Record<string, string> = {
  grocery: "🛒",
  electronics: "📱",
  fashion: "👗",
  clothing: "👗",
  home: "🏠",
  cosmetics: "✨",
  jewellery: "💍",
  jewelry: "💍",
  sports: "⚽",
  flower: "🌸",
  flowers: "🌸",
  cake: "🎂",
  cakes: "🎂",
  choc: "🍫",
  chocolates: "🍫",
  hamper: "🎁",
  combopack: "🎁",
  books: "📚",
  default: "🎁",
};

function emojiFor(product: Product): string {
  return (
    product.emoji ||
    CAT_EMOJI[(product.category || "").toLowerCase()] ||
    CAT_EMOJI.default
  );
}

export function ProductImage({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const src = product.image;
  // Show the image immediately; only fall back to the emoji placeholder if it
  // actually fails to load. (Gating on onLoad was unreliable with cached images
  // and made the photo flash then disappear.)
  const [errored, setErrored] = useState(false);

  // Reset the error flag when the product/image changes (no effect needed).
  const [seenSrc, setSeenSrc] = useState(src);
  if (src !== seenSrc) {
    setSeenSrc(src);
    setErrored(false);
  }

  const showPlaceholder = !src || errored;

  return (
    <div className={"card-media " + (className || "")}>
      {showPlaceholder && <div className="ph">{emojiFor(product)}</div>}
      {src && !errored && (
        <Image
          src={src}
          alt={product.name}
          fill
          sizes="(max-width: 540px) 100vw, 220px"
          referrerPolicy="no-referrer"
          className="loaded"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}
