import { defaultSettings, type AppSettings } from '$lib/types/settings';

const STORAGE_KEY = 'app:settings';

/**
 * Settings live in localStorage rather than sessionStorage: unlike the dex's
 * filter/sort state, these are deliberate choices that should survive a
 * restart. Unknown or malformed values fall back to the defaults.
 */
export function loadSettings(): AppSettings {
  const fallback = defaultSettings();
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as Partial<AppSettings>;
    const size = Number(saved.pageSize);
    return {
      pageSize: Number.isFinite(size) && size >= 0 ? Math.floor(size) : fallback.pageSize,
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked — the setting just won't persist.
  }
}
