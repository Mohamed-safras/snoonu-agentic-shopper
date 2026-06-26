/** Language + promo banner types. */

export type Lang = "en" | "ar" | "si" | "ta";

/** An AI-generated promo banner slide (real category + real product image). */
export interface BannerSlide {
  title: string;
  tagline: string;
  /** Short promo flair, e.g. "Featured", "Trending", "In Season", "Top Gift". */
  badge?: string;
  /** AI-generated offer line, e.g. "Up to 30% off", "Free island-wide delivery". */
  offer?: string;
  /** AI-generated limited-time window (hours) → rendered as a live countdown. */
  countdownHours?: number;
  query: string;
  image?: string;
  bg: string;
}
