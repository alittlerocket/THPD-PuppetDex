import type Database from '@tauri-apps/plugin-sql';
import { getDb } from '$lib/data/db';
import { fetchItemByName } from '$lib/data/itemRepository';
import type { ItemRow } from '$lib/types/item';

export class ItemDetailViewModel {
	item = $state<ItemRow | null>(null);
	loading = $state(true);
	error = $state<string | null>(null);

	private db: Database | null = null;

	async load(name: string) {
		if (!this.db) this.db = await getDb();
		this.loading = true;
		this.error = null;
		try {
			const found = await fetchItemByName(this.db, name);
			if (!found) {
				this.error = 'Item not found';
				this.item = null;
			} else {
				this.item = found;
			}
		} catch (e) {
			this.error = String(e);
		} finally {
			this.loading = false;
		}
	}
}

export function createItemDetailViewModel() {
	return new ItemDetailViewModel();
}
