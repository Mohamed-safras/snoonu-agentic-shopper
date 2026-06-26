"use client";
import { useEffect, useState } from "react";

/**
 * Derive a glossy, image-tinted gradient from a product photo, so the detail
 * gallery's background takes on the colours of the image behind it.
 *
 * The pixels are read from a tiny copy of the image loaded through Next's image
 * optimizer (`/_next/image`), which is SAME-ORIGIN — so the canvas isn't tainted
 * and `getImageData` is allowed even for remote Snoonu photos. On any failure
 * (blocked host, decode error) it returns null and the caller keeps its default.
 */
function optimizedUrl(src: string): string {
  if (src.startsWith("data:")) return src;
  if (src.startsWith("/_next/")) return src;
  // Route through Next's same-origin optimizer so the bytes are CORS-safe. Width
  // 64 is a default `imageSizes` entry and q=75 the default allowed quality — any
  // other value makes the optimizer reject the request with a 400.
  return `/_next/image?url=${encodeURIComponent(src)}&w=64&q=75`;
}

type Rgb = [number, number, number];

const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
const mix = (color: Rgb, target: number, amount: number): Rgb =>
  color.map((channel) => clampChannel(channel + (target - channel) * amount)) as Rgb;
const rgb = ([r, g, b]: Rgb, alpha = 1) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

/** Average colour + the most vivid sampled colour (for a richer gradient). */
function sample(data: Uint8ClampedArray): { average: Rgb; vivid: Rgb } {
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;
  let vivid: Rgb = [0, 0, 0];
  let bestScore = -1;
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const alpha = data[index + 3];
    if (alpha < 128) continue; // skip transparent pixels
    totalR += r;
    totalG += g;
    totalB += b;
    count++;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min; // colourfulness
    const score = chroma + max * 0.3; // favour vivid but not too dark
    if (score > bestScore) {
      bestScore = score;
      vivid = [r, g, b];
    }
  }
  if (!count) return { average: [200, 190, 220], vivid: [160, 140, 200] };
  const average: Rgb = [totalR / count, totalG / count, totalB / count];
  // If nothing was colourful, fall back to the average for the accent too.
  if (bestScore < 24) vivid = average;
  return { average, vivid };
}

function buildGradient(average: Rgb, vivid: Rgb): string {
  const gloss = mix(vivid, 255, 0.55); // light highlight for the glossy sheen
  const deep = mix(average, 0, 0.5); // darkened base for depth
  const accent = mix(vivid, 0, 0.12);
  return (
    `radial-gradient(120% 85% at 28% 8%, ${rgb(gloss, 0.95)} 0%, ${rgb(accent, 0)} 55%), ` +
    `linear-gradient(160deg, ${rgb(accent)} 0%, ${rgb(average)} 45%, ${rgb(deep)} 100%)`
  );
}

export function useImageAmbient(src: string | undefined): string | null {
  // Keyed by the src it was computed for, so the value is DERIVED (we never call
  // setState synchronously in the effect — only in the async load callbacks).
  const [result, setResult] = useState<{ src: string; gradient: string | null }>(
    { src: "", gradient: null },
  );

  useEffect(() => {
    if (!src) return; // nothing to sample — the derived value below stays null
    let cancelled = false;

    // Fetch the optimized (same-origin) bytes and decode via createImageBitmap:
    // a blob-backed bitmap is never "tainted", so getImageData always works —
    // unlike an <img crossOrigin> which can taint from a cached non-CORS hit.
    // Abort quickly if the source is slow (the ambient tint is cosmetic — we
    // must never hang the drawer waiting on a sluggish image host).
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 3000);
    (async () => {
      try {
        const response = await fetch(optimizedUrl(src), { signal: abort.signal });
        if (!response.ok) throw new Error("image fetch failed");
        const bitmap = await createImageBitmap(await response.blob());
        if (cancelled) {
          bitmap.close();
          return;
        }
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          bitmap.close();
          return;
        }
        context.drawImage(bitmap, 0, 0, size, size);
        bitmap.close();
        const { average, vivid } = sample(
          context.getImageData(0, 0, size, size).data,
        );
        if (!cancelled) setResult({ src, gradient: buildGradient(average, vivid) });
      } catch {
        if (!cancelled) setResult({ src, gradient: null });
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();
      clearTimeout(timeout);
    };
  }, [src]);

  // Only return the gradient once it matches the current src (else still loading).
  return result.src === src ? result.gradient : null;
}
