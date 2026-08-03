import type { StatKey } from '$lib/types/puppet';

export const STAT_LABELS: Record<StatKey, string> = {
	hp: 'HP',
	fo_atk: 'Fo.Atk',
	fo_def: 'Fo.Def',
	sp_atk: 'Sp.Atk',
	sp_def: 'Sp.Def',
	spd: 'Spd',
};

// The six stats plus the two aggregate numbers — every numeric puppet column
// that can be range-filtered, and therefore surfaced on the dex list card.
export type StatColumn = StatKey | 'bst' | 'cost';

export const STAT_COLUMN_ORDER: StatColumn[] = [
	'hp',
	'fo_atk',
	'fo_def',
	'sp_atk',
	'sp_def',
	'spd',
	'bst',
	'cost',
];

export const STAT_COLUMN_LABELS: Record<StatColumn, string> = {
	...STAT_LABELS,
	bst: 'BST',
	cost: 'Cost',
};

// Scaling maxima for stat bars — computed from the true max across both base
// puppets and alt-form stat ranges in the dataset, with headroom.
export const STAT_MAX: Record<StatKey, number> = {
	hp: 370,
	fo_atk: 250,
	fo_def: 290,
	sp_atk: 235,
	sp_def: 290,
	spd: 230,
};

export const STAT_ORDER: StatKey[] = [
	'hp',
	'fo_atk',
	'fo_def',
	'sp_atk',
	'sp_def',
	'spd',
];

export const BST_MAX = 650;

export const VARIANT_LABELS: Record<
	'normal' | 'alt_color' | 'alt_costume' | 'wedding',
	string
> = {
	normal: 'Normal',
	alt_color: 'Color',
	alt_costume: 'Costume',
	wedding: 'Wedding',
};

export function statBarSegment(min: number, max: number, scaleMax: number) {
	const leftPct = Math.min(100, (min / scaleMax) * 100);
	const widthPct = Math.max(
		0,
		Math.min(100 - leftPct, ((max - min) / scaleMax) * 100),
	);
	return { leftPct, widthPct };
}
