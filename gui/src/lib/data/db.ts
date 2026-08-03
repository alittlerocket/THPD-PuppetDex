import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
	if (!dbPromise) {
		dbPromise = (async () => {
			const connStr = await invoke<string>('db_connection_string');
			return Database.load(connStr);
		})();
	}
	return dbPromise;
}
