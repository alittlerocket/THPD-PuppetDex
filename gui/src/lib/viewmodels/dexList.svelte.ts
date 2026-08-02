import type Database from '@tauri-apps/plugin-sql';
import { getDb } from '$lib/data/db';
import { fetchPuppetList, fetchFilterOptions } from '$lib/data/puppetRepository';
import { emptyFilters, type PuppetFilters } from '$lib/types/filters';
import type { PuppetListRow } from '$lib/types/puppet';

export class DexListViewModel {
  puppets = $state<PuppetListRow[]>([]);
  search = $state('');
  loading = $state(true);
  error = $state<string | null>(null);
  showFilters = $state(false);
  filters = $state<PuppetFilters>(emptyFilters());

  abilityOptions = $state<string[]>([]);
  locationOptions = $state<string[]>([]);
  moveOptions = $state<string[]>([]);
  typeOptions = $state<string[]>([]);

  private db: Database | null = null;
  private filterOptionsLoaded = false;

  get filtered(): PuppetListRow[] {
    const q = this.search.toLowerCase();
    return this.puppets.filter((p) => p.name.toLowerCase().includes(q));
  }

  async init() {
    try {
      this.db = await getDb();
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
    try {
      this.puppets = await fetchPuppetList(this.db, this.filters);
    } catch (e) {
      this.error = String(e);
    } finally {
      this.loading = false;
    }
  }

  applyFilters() {
    this.runQuery();
  }

  resetFilters() {
    this.filters = emptyFilters();
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
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
    if (this.showFilters) this.loadFilterOptions();
  }
}

export function createDexListViewModel() {
  return new DexListViewModel();
}
