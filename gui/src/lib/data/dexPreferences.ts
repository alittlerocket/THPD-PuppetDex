import { emptyFilters, type PuppetFilters } from '$lib/types/filters';
import {
	DEFAULT_SORT_DIR,
	DEFAULT_SORT_KEY,
	type SortDir,
	type SortKey,
} from '$lib/utils/sortConstants';

const STORAGE_KEY = 'dex:prefs';

export interface DexPreferences {
	filters: PuppetFilters;
	sortKey: SortKey;
	sortDir: SortDir;
	search: string;
	showFilters: boolean;
	page: number;
}

export function defaultDexPreferences(): DexPreferences {
	return {
		filters: emptyFilters(),
		sortKey: DEFAULT_SORT_KEY,
		sortDir: DEFAULT_SORT_DIR,
		search: '',
		showFilters: false,
		page: 1,
	};
}

/**
 * Restore the dex list's filters/sort/search so navigating into a puppet and
 * back doesn't discard them.
 */
export function loadDexPreferences(): DexPreferences {
	const fallback = defaultDexPreferences();
	if (typeof sessionStorage === 'undefined') return fallback;
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return fallback;
		const saved = JSON.parse(raw) as Partial<DexPreferences>;
		return {
			filters: { ...fallback.filters, ...(saved.filters ?? {}) },
			sortKey: saved.sortKey ?? fallback.sortKey,
			sortDir: saved.sortDir ?? fallback.sortDir,
			search: saved.search ?? fallback.search,
			showFilters: saved.showFilters ?? fallback.showFilters,
			page:
				Number.isFinite(saved.page) && (saved.page ?? 0) >= 1
					? Number(saved.page)
					: fallback.page,
		};
	} catch {
		return fallback;
	}
}

export function saveDexPreferences(prefs: DexPreferences): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		// Storage full or blocked — preferences just won't persist.
	}
}
