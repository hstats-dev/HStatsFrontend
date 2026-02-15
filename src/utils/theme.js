const THEME_STORAGE_KEY = "hstats-theme";
const DARK_THEME = "dark";
const LIGHT_THEME = "light";

function isThemeValue(value) {
  return value === DARK_THEME || value === LIGHT_THEME;
}

export function getStoredThemePreference() {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeValue(value) ? value : null;
  } catch {
    return null;
  }
}

export function getActiveTheme() {
  return document.documentElement.classList.contains(DARK_THEME) ? DARK_THEME : LIGHT_THEME;
}

export function applyTheme(theme) {
  const resolvedTheme = theme === DARK_THEME ? DARK_THEME : LIGHT_THEME;
  const isDark = resolvedTheme === DARK_THEME;
  document.documentElement.classList.toggle(DARK_THEME, isDark);
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
  return resolvedTheme;
}

export function initializeTheme() {
  const storedTheme = getStoredThemePreference();
  return applyTheme(storedTheme || LIGHT_THEME);
}

export function toggleThemePreference() {
  const nextTheme = getActiveTheme() === DARK_THEME ? LIGHT_THEME : DARK_THEME;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // Ignore storage failures and still apply in-memory theme state.
  }

  return applyTheme(nextTheme);
}
