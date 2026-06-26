/** Light-only theme (dark mode removed). Kept as a no-op shim so the store
 *  slice / call sites don't need to change. */

export type ThemeMode = "light";

export const THEME_KEY = "trova-theme";

export function resolveMode(): "light" {
  return "light";
}

export function applyMode(): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", "light");
}

export function getStoredMode(): ThemeMode {
  return "light";
}
