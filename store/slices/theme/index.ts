import { applyMode, getStoredMode } from "@/lib/ui/theme";
import type { SliceCreator } from "../../types";
import type { ThemeSlice } from "./types";

export const createThemeSlice: SliceCreator<ThemeSlice> = (set) => ({
  theme: "light",
  setTheme: (theme) => {
    set({ theme });
    applyMode();
  },
  initTheme: () => {
    const mode = getStoredMode();
    set({ theme: mode });
    applyMode();
  },
});
