import type Database from '@tauri-apps/plugin-sql';
import type { SkillRow } from '$lib/types/skill';

export async function fetchSkillsByName(
	db: Database,
	name: string,
): Promise<SkillRow[]> {
	return db.select<SkillRow[]>(
		'SELECT * FROM skills WHERE name = $1 ORDER BY is_mod ASC, mod_tab ASC',
		[name],
	);
}
