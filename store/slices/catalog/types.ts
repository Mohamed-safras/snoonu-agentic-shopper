import type { BannerSlide } from "@/types";

/** Dynamic, MCP-grounded catalog data: suggestions, categories, promo banners. */
export interface CatalogSlice {
  suggestions: string[];
  placeholders: string[];
  loadSuggestions: () => Promise<void>;
  categories: string[];
  loadCategories: () => Promise<void>;
  banners: BannerSlide[];
  loadBanners: () => Promise<void>;
}
