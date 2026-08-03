import {
	STAT_COLUMN_LABELS,
	STAT_COLUMN_ORDER,
	type StatColumn,
} from './statConstants';

export type SortKey = 'id' | 'name' | 'type1' | StatColumn | 'move_level';
export type SortDir = 'asc' | 'desc';

export const SORT_LABELS: Record<SortKey, string> = {
	id: 'ID',
	name: 'Name',
	type1: 'Type',
	...STAT_COLUMN_LABELS,
	move_level: 'Move Level',
};

// 'move_level' is deliberately excluded: that column only exists in the result
// set while a move filter is applied, so the ViewModel appends it on demand.
export const BASE_SORT_KEYS: SortKey[] = [
	'id',
	'name',
	'type1',
	...STAT_COLUMN_ORDER,
];

export const DEFAULT_SORT_KEY: SortKey = 'id';
export const DEFAULT_SORT_DIR: SortDir = 'asc';
