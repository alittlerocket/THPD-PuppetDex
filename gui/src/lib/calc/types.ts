/**
 * Types for the TPDP damage engine.
 *
 * Ported from tpdpextcalc (https://github.com/Gengetsu12/tpdpextcalc), which is
 * itself derived from the Pokémon Showdown damage calculator.
 * MIT — Copyright (c) 2013-2018 Honko and other contributors.
 */

export type StatKey = 'fa' | 'fd' | 'sa' | 'sd' | 'sp';

export const FA: StatKey = 'fa';
export const FD: StatKey = 'fd';
export const SA: StatKey = 'sa';
export const SD: StatKey = 'sd';
export const SP: StatKey = 'sp';

export const STATS_ALL: StatKey[] = [FA, FD, SA, SD, SP];

/**
 * Display names for the engine's stat keys. Distinct from the dex's own
 * STAT_LABELS, which are keyed by column name (`fo_atk`) rather than the
 * engine's short codes (`fa`).
 */
export const CALC_STAT_LABELS: Record<StatKey, string> = {
	fa: 'Fo.Atk',
	fd: 'Fo.Def',
	sa: 'Sp.Atk',
	sd: 'Sp.Def',
	sp: 'Spd',
};

/** Mark colour → the stat it grants a 10% bonus to. */
export const MARKS: Record<string, StatKey | ''> = {
	NULL: '',
	Red: 'fa',
	Blue: 'fd',
	Black: 'sa',
	White: 'sd',
	Green: 'sp',
};

export type StatTable = Record<StatKey, number>;

export interface MoveData {
	type: string;
	category: 'Focus' | 'Spread' | 'Status' | string;
	bp: number;
	accuracy?: number;
	acc100?: boolean;
	alwaysCrit?: boolean;
	alwaysHits?: boolean;
	defenseStat?: StatKey;
	dropsStats?: number;
	givesHealth?: boolean;
	hasRecoil?: string;
	hasSecondaryEffect?: boolean;
	isEN?: boolean;
	isFoul?: boolean;
	isJavelin?: boolean;
	isMultiHit?: boolean;
	isTwoHit?: boolean;
	isVoid?: boolean;
	partialTrapping?: boolean;
	priority?: number;
	willCharge?: boolean;
	willLock?: boolean;
}

/** A move as handed to the engine: static data plus per-calculation state. */
export interface Move extends MoveData {
	name: string;
	hits: number;
	usedTimes: number;
	repetitionCount: number;
	isCrit: boolean;
	hasPriority: boolean;
	bypassesProtect?: boolean;
	ignoresDefenseBoosts?: boolean;
}

export interface Puppet {
	name: string;
	type1: string;
	type2: string | null;
	level: number;
	ability: string;
	item: string;
	mark: string;
	cost: number;
	/** Current and maximum HP, in points. */
	curHP: number;
	maxHP: number;
	/** Stats after boosts are applied. */
	stats: StatTable;
	/** Stats before boosts — used for crits and boost-ignoring effects. */
	rawStats: StatTable;
	boosts: StatTable;
	/** Puppet Points invested per stat, shown in the description output. */
	pp: StatTable;
	/** Two status slots; "None" when empty. */
	status: string[];
	/** Displayed HP/PP string in the description. */
	HPPP: string | number;
	hasType(type: string): boolean;
}

export interface Field {
	weather: string;
	terrain: string;
	isProtected?: boolean;
	isGhost?: boolean;
	isReversed?: boolean;
	isCamo?: boolean;
	isFieldProtect?: boolean;
	isFieldBarrier?: boolean;
}

/** Free-form bag of flags that buildDescription() renders into prose. */
export interface Description {
	attackerName: string;
	moveName: string;
	defenderName: string;
	[key: string]: string | number | boolean | undefined;
}

export interface DamageResult {
	damage: number[];
	description: string;
}
