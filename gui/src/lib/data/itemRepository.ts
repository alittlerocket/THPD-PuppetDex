import type Database from '@tauri-apps/plugin-sql';
import type { ItemRow } from '$lib/types/item';

export async function fetchItemByName(db: Database, name: string): Promise<ItemRow | null> {
  const rows = await db.select<ItemRow[]>('SELECT * FROM items WHERE name = $1 LIMIT 1', [name]);
  return rows.length > 0 ? rows[0] : null;
}
