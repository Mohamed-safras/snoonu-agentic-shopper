import type { ThemeMode } from "@/lib/ui/theme";

/** Light / dark / system theme preference. */
export interface ThemeSlice {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  initTheme: () => void;
}
