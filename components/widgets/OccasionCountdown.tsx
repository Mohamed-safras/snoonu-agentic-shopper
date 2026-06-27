"use client";
import { useEffect, useMemo, useState } from "react";
import NextImage from "next/image";
import { Icon } from "@/components/ui/Icon";
import { useHala } from "@/store";
import { useTranslate } from "@/hooks/useTranslate";

/**
 * AI-native promo banner. Every slide — theme, copy, badge, OFFER and a
 * limited-time COUNTDOWN — is generated at runtime by the LLM from Snoonu's
 * real catalog, backed by a real product image (see /api/banners). The
 * countdown ticks live off the AI-provided window. "Shop now" runs a real search.
 */
export function OccasionCountdown({
  onShopNow,
  onClose,
}: {
  onShopNow: (query: string) => void;
  onClose?: () => void;
}) {
  const banners = useHala((s) => s.banners);
  const loadBanners = useHala((s) => s.loadBanners);
  const lang = useHala((s) => s.lang);
  const translate = useTranslate();
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [sliding, setSliding] = useState(false);
  // Bumped on every manual nav (prev/next/dot) so the auto-rotate timer restarts
  // and doesn't advance right after the shopper interacts.
  const [navNonce, setNavNonce] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<Record<string, boolean>>({});

  // Mount-time baseline for countdowns (keeps the useMemo pure — no Date.now in render).
  const [baseNow] = useState(() => Date.now());

  useEffect(() => {
    void loadBanners();
  }, [loadBanners, lang]);

  // Preload every slide's image so rotations are instant (no per-slide fetch lag).
  useEffect(() => {
    banners.forEach((s) => {
      if (s.image) {
        const img = new Image();
        img.referrerPolicy = "no-referrer";
        img.src = s.image;
      }
    });
  }, [banners]);

  // Fix each slide's countdown end time when the banners arrive, so it ticks
  // down consistently across rotations.
  const endsAt = useMemo(
    () =>
      banners.map((s) =>
        s.countdownHours ? baseNow + s.countdownHours * 3600_000 : null,
      ),
    [banners, baseNow],
  );

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => {
      setSliding(true);
      setTimeout(() => {
        setIdx((i) => (i + 1) % banners.length);
        setSliding(false);
      }, 280);
    }, 6000);
    return () => clearInterval(t);
    // navNonce restarts the timer whenever the shopper navigates manually.
  }, [banners.length, navNonce]);

  if (dismissed || banners.length === 0) return null;

  // Move by ±1 with the slide animation, wrapping infinitely in both directions.
  const go = (delta: number) => {
    if (banners.length < 2) return;
    setNavNonce((n) => n + 1);
    setSliding(true);
    setTimeout(() => {
      setIdx((current) => (current + delta + banners.length) % banners.length);
      setSliding(false);
    }, 280);
  };

  const i = idx % banners.length;
  const slide = banners[i];
  const end = endsAt[i];
  const remaining = end ? Math.max(0, end - now) : 0;
  const showTimer = Boolean(end) && remaining > 0;
  const hrs = Math.floor(remaining / 3600_000);
  const mins = Math.floor((remaining % 3600_000) / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);

  return (
    <div
      className="occ-carousel"
      style={{
        background: `linear-gradient(115deg, ${slide.bg} 0%, ${slide.bg} 45%, #e0202e 100%)`,
      }}
    >
      {slide.image && !failedSrc[slide.image] && (
        <div className="occ-media">
          <NextImage
            key={slide.image}
            src={slide.image}
            alt={slide.title}
            fill
            sizes="(max-width: 540px) 60vw, 360px"
            referrerPolicy="no-referrer"
            className={loadedSrc === slide.image ? "loaded" : ""}
            onLoad={() => setLoadedSrc(slide.image!)}
            onError={() =>
              setFailedSrc((p) => ({ ...p, [slide.image!]: true }))
            }
          />
        </div>
      )}
      <div className={"occ-slide" + (sliding ? " sliding" : "")}>
        <button
          className="occ-x"
          onClick={() => (onClose ? onClose() : setDismissed(true))}
          aria-label={translate("Dismiss")}
        >
          ×
        </button>
        <div className="occ-body">
          <div className="occ-badge-row">
            {slide.badge && <span className="occ-badge">{slide.badge}</span>}
            {slide.offer && <span className="occ-offer">{slide.offer}</span>}
          </div>
          <div className="occ-title">{slide.title}</div>
          {slide.tagline && <div className="occ-tagline">{slide.tagline}</div>}
          <div className="occ-action-row">
            <button className="occ-cta" onClick={() => onShopNow(slide.query)}>
              {translate("Shop now →")}
            </button>
            {showTimer && (
              <div
                className="occ-chips-row"
                aria-label={translate("offer ends in")}
              >
                <div className="occ-chip">
                  <b>{String(hrs).padStart(2, "0")}</b>
                  <span>{translate("h")}</span>
                </div>
                <div className="occ-chip">
                  <b>{String(mins).padStart(2, "0")}</b>
                  <span>{translate("m")}</span>
                </div>
                <div className="occ-chip">
                  <b>{String(secs).padStart(2, "0")}</b>
                  <span>{translate("s")}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {banners.length > 1 && (
        <>
          <button
            className="occ-nav prev"
            onClick={() => go(-1)}
            aria-label={translate("Previous offer")}
          >
            <Icon name="arrow" size={18} />
          </button>
          <button
            className="occ-nav next"
            onClick={() => go(1)}
            aria-label={translate("Next offer")}
          >
            <Icon name="arrow" size={18} />
          </button>
          <div className="occ-dots">
            {banners.map((_, d) => (
              <button
                key={d}
                className={"occ-dot" + (d === i ? " on" : "")}
                onClick={() => {
                  setNavNonce((n) => n + 1);
                  setIdx(d);
                }}
                aria-label={translate("Slide {n}", { n: d + 1 })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
