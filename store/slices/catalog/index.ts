import { loadRecents } from "@/lib/catalog/recents";
import type { SliceCreator } from "../../types";
import type { CatalogSlice } from "./types";

export const createCatalogSlice: SliceCreator<CatalogSlice> = (set, get) => ({
  suggestions: [],
  placeholders: [],
  loadSuggestions: async () => {
    const { lang, cart } = get();
    const recent = loadRecents();
    const cartCats = Array.from(
      new Set(cart.map((product) => product.category).filter(Boolean)),
    ) as string[];
    const params = new URLSearchParams({ lang, n: "10" });
    if (recent.length) params.set("recent", recent.join(","));
    if (cartCats.length) params.set("cart", cartCats.join(","));
    try {
      const result = await fetch("/api/discover?" + params.toString()).then(
        (response) => response.json(),
      );
      const patch: Partial<CatalogSlice> = {};
      if (Array.isArray(result.chips) && result.chips.length)
        patch.suggestions = result.chips;
      if (Array.isArray(result.placeholders) && result.placeholders.length)
        patch.placeholders = result.placeholders;
      if (Object.keys(patch).length) set(patch);
    } catch {
      /* keep existing/empty suggestions */
    }
  },

  categories: [],
  loadCategories: async () => {
    if (get().categories.length) return;
    try {
      const result = await fetch("/api/categories").then((response) =>
        response.json(),
      );
      if (Array.isArray(result.categories) && result.categories.length)
        set({ categories: result.categories });
    } catch {
      /* tabs simply stay empty until reachable */
    }
  },

  banners: [],
  loadBanners: async () => {
    try {
      const result = await fetch("/api/banners?lang=" + get().lang).then(
        (response) => response.json(),
      );
      if (Array.isArray(result.slides) && result.slides.length)
        set({ banners: result.slides });
    } catch {
      /* banner simply hides until reachable */
    }
  },
});
