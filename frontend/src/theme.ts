export type Theme = "light" | "dark";

const storageKey = "devsync-theme";

export function initialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // The current page can still switch themes when storage is unavailable.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.bsTheme = theme;
}

export function saveTheme(theme: Theme) {
  applyTheme(theme);
  try {
    window.localStorage.setItem(storageKey, theme);
  } catch {
    // The theme stays active for the current page.
  }
}
