import type Database from '@tauri-apps/plugin-sql';
import { getDb } from '$lib/data/db';
import {
	fetchPuppetList,
	fetchFilterOptions,
	type PuppetSort,
} from '$lib/data/puppetRepository';
import {
	loadDexPreferences,
	saveDexPreferences,
} from '$lib/data/dexPreferences';
import { loadSettings } from '$lib/data/settingsStore';
import { ALL_ON_ONE_PAGE, defaultSettings } from '$lib/types/settings';
import {
	activeStatColumns,
	emptyFilters,
	type PuppetFilters,
} from '$lib/types/filters';
import type { PuppetListRow } from '$lib/types/puppet';
import { STAT_COLUMN_LABELS, type StatColumn } from '$lib/utils/statConstants';
import {
	BASE_SORT_KEYS,
	DEFAULT_SORT_DIR,
	DEFAULT_SORT_KEY,
	SORT_LABELS,
	type SortDir,
	type SortKey,
} from '$lib/utils/sortConstants';

export interface MoveInfo {
	name: string;
	source: string;
}

export class DexListViewModel {
	puppets = $state<PuppetListRow[]>([]);
	loading = $state(true);
	error = $state<string | null>(null);
	showFilters = $state(false);
	filters = $state<PuppetFilters>(emptyFilters());

	abilityOptions = $state<string[]>([]);
	locationOptions = $state<string[]>([]);
	moveOptions = $state<string[]>([]);
	typeOptions = $state<string[]>([]);
	modOptions = $state<string[]>([]);

	private appliedFilters = $state<PuppetFilters>(emptyFilters());

	#search = $state('');
	#sortKey = $state<SortKey>(DEFAULT_SORT_KEY);
	#sortDir = $state<SortDir>(DEFAULT_SORT_DIR);
	#page = $state(1);
	#pageSize = $state(defaultSettings().pageSize);

	private db: Database | null = null;
	private filterOptionsLoaded = false;
	#persistTimer: ReturnType<typeof setTimeout> | undefined;

	// Everything the card grid reads is $derived rather than a plain getter: a
	// getter re-runs on every access, so with ~860 cards the template was
	// rebuilding these arrays thousands of times per render. Deriving also keeps
	// array identity stable so {#each} blocks don't re-key needlessly.
	filtered: PuppetListRow[] = $derived.by(() => {
		const q = this.#search.toLowerCase();
		if (!q) return this.puppets;
		return this.puppets.filter((p) => p.name.toLowerCase().includes(q));
	});

	pageCount: number = $derived(
		this.#pageSize === ALL_ON_ONE_PAGE
			? 1
			: Math.max(1, Math.ceil(this.filtered.length / this.#pageSize)),
	);

	/**
	 * Clamped rather than stored: a filter that shrinks the result set can strand
	 * the stored page past the end, and clamping on read avoids an effect loop.
	 */
	currentPage: number = $derived(
		Math.min(Math.max(1, this.#page), this.pageCount),
	);

	/** The slice actually rendered — the whole point of paging is to cap this. */
	paged: PuppetListRow[] = $derived.by(() => {
		if (this.#pageSize === ALL_ON_ONE_PAGE) return this.filtered;
		const start = (this.currentPage - 1) * this.#pageSize;
		return this.filtered.slice(start, start + this.#pageSize);
	});

	get pageSize(): number {
		return this.#pageSize;
	}

	get paginated(): boolean {
		return this.#pageSize !== ALL_ON_ONE_PAGE && this.pageCount > 1;
	}

	/** 1-based index of the first row on this page, for the "x–y of z" readout. */
	get rangeStart(): number {
		return this.filtered.length === 0
			? 0
			: (this.currentPage - 1) * this.#pageSize + 1;
	}

	get rangeEnd(): number {
		return Math.min(
			this.currentPage * this.#pageSize,
			this.filtered.length,
		);
	}

	goToPage(n: number) {
		this.#page = Math.min(Math.max(1, n), this.pageCount);
		this.persist();
	}

	nextPage() {
		this.goToPage(this.currentPage + 1);
	}

	prevPage() {
		this.goToPage(this.currentPage - 1);
	}

	firstPage() {
		this.goToPage(1);
	}

	lastPage() {
		this.goToPage(this.pageCount);
	}

	get search(): string {
		return this.#search;
	}

	set search(v: string) {
		this.#search = v;
		this.#page = 1;
		this.persistDebounced();
	}

	get sortKey(): SortKey {
		return this.#sortKey;
	}

	set sortKey(v: SortKey | '') {
		this.#sortKey = (v || DEFAULT_SORT_KEY) as SortKey;
		this.#page = 1;
		this.runQuery();
	}

	get sortDir(): SortDir {
		return this.#sortDir;
	}

	sortOptions: { value: string; label: string }[] = $derived.by(() => {
		const keys = this.appliedFilters.moves.length
			? [...BASE_SORT_KEYS, 'move_level' as SortKey]
			: BASE_SORT_KEYS;
		return keys.map((k) => ({ value: k, label: SORT_LABELS[k] }));
	});

	modFilterOptions: { value: string; label: string }[] = $derived([
		{ value: 'official', label: 'Official Only' },
		{ value: 'modded', label: 'Modded Only' },
		...this.modOptions.map((mod) => ({
			value: mod,
			label: mod.replace(/\s*-\s*$/, ''),
		})),
	]);

	#activeStats: StatColumn[] = $derived(
		activeStatColumns(this.appliedFilters),
	);

	statColumns: { key: StatColumn; label: string }[] = $derived(
		this.#activeStats.map((key) => ({
			key,
			label: STAT_COLUMN_LABELS[key],
		})),
	);

	moveFilterActive: boolean = $derived(this.appliedFilters.moves.length > 0);

	// BST/Cost live in the card's meta line unless already shown as a filtered stat.
	showBstInMeta: boolean = $derived(!this.#activeStats.includes('bst'));
	showCostInMeta: boolean = $derived(!this.#activeStats.includes('cost'));

	/**
	 * Each filtered move and how the puppet gets it, resolved once per result set
	 * instead of per card render. A learnset level of '-' means no level
	 * requirement rather than a number, and skill card numbers carry their own '#'.
	 */
	#moveInfoByRow: Map<number, MoveInfo[]> = $derived.by(() => {
		const moves = this.appliedFilters.moves;
		const byRow = new Map<number, MoveInfo[]>();
		if (moves.length === 0) return byRow;
		for (const puppet of this.puppets) {
			byRow.set(
				puppet.rowid,
				moves.map((name, i) => {
					const parts: string[] = [];
					const lvl = puppet[`move_level_${i}`];
					const sc = puppet[`move_sc_${i}`];
					if (lvl)
						parts.push(/^\d+$/.test(lvl) ? `Lv ${lvl}` : 'Start');
					if (sc) parts.push(`SC ${sc}`);
					return {
						name,
						source: parts.length ? parts.join(' · ') : '—',
					};
				}),
			);
		}
		return byRow;
	});

	statValue(puppet: PuppetListRow, key: StatColumn): string {
		return puppet[key]?.toString() ?? '—';
	}

	moveInfos(puppet: PuppetListRow): MoveInfo[] {
		return this.#moveInfoByRow.get(puppet.rowid) ?? [];
	}

	toggleSortDir() {
		this.#sortDir = this.#sortDir === 'asc' ? 'desc' : 'asc';
		this.#page = 1;
		this.runQuery();
	}

	async init() {
		try {
			const prefs = loadDexPreferences();
			this.filters = prefs.filters;
			this.#sortKey = prefs.sortKey;
			this.#sortDir = prefs.sortDir;
			this.#search = prefs.search;
			this.showFilters = prefs.showFilters;
			this.#page = prefs.page;
			this.#pageSize = loadSettings().pageSize;
			this.db = await getDb();
			if (this.showFilters) await this.loadFilterOptions();
			await this.runQuery();
		} catch (e) {
			this.error = String(e);
			this.loading = false;
		}
	}

	async runQuery() {
		if (!this.db) return;
		this.loading = true;
		this.error = null;
		const sort: PuppetSort = { key: this.#sortKey, dir: this.#sortDir };
		const snapshot = $state.snapshot(this.filters) as PuppetFilters;
		try {
			this.puppets = await fetchPuppetList(this.db, snapshot, sort);
			this.appliedFilters = snapshot;
			this.persist();
		} catch (e) {
			this.error = String(e);
		} finally {
			this.loading = false;
		}
	}

	applyFilters() {
		this.#page = 1;
		this.runQuery();
	}

	resetFilters() {
		this.filters = emptyFilters();
		this.#page = 1;
		this.runQuery();
	}

	async loadFilterOptions() {
		if (!this.db || this.filterOptionsLoaded) return;
		this.filterOptionsLoaded = true;
		const options = await fetchFilterOptions(this.db);
		this.abilityOptions = options.abilities;
		this.locationOptions = options.locations;
		this.moveOptions = options.moves;
		this.typeOptions = options.types;
		this.modOptions = options.mods;
	}

	toggleFilters() {
		this.showFilters = !this.showFilters;
		if (this.showFilters) this.loadFilterOptions();
		this.persist();
	}

	/** Search fires per keystroke; coalesce the storage writes. */
	private persistDebounced() {
		if (this.#persistTimer !== undefined) clearTimeout(this.#persistTimer);
		this.#persistTimer = setTimeout(() => {
			this.#persistTimer = undefined;
			this.persist();
		}, 300);
	}

	private persist() {
		if (this.#persistTimer !== undefined) {
			clearTimeout(this.#persistTimer);
			this.#persistTimer = undefined;
		}
		saveDexPreferences({
			filters: $state.snapshot(this.filters) as PuppetFilters,
			sortKey: this.#sortKey,
			sortDir: this.#sortDir,
			search: this.#search,
			showFilters: this.showFilters,
			page: this.currentPage,
		});
	}
}

export function createDexListViewModel() {
	return new DexListViewModel();
}
