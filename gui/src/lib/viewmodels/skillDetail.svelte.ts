import type Database from '@tauri-apps/plugin-sql';
import { getDb } from '$lib/data/db';
import { fetchSkillsByName } from '$lib/data/skillRepository';
import type { SkillRow } from '$lib/types/skill';

export class SkillDetailViewModel {
	rows = $state<SkillRow[]>([]);
	loading = $state(true);
	error = $state<string | null>(null);

	private db: Database | null = null;

	async load(name: string) {
		if (!this.db) this.db = await getDb();
		this.loading = true;
		this.error = null;
		try {
			this.rows = await fetchSkillsByName(this.db, name);
			if (this.rows.length === 0) this.error = 'Move not found';
		} catch (e) {
			this.error = String(e);
		} finally {
			this.loading = false;
		}
	}
}

export function createSkillDetailViewModel() {
	return new SkillDetailViewModel();
}
