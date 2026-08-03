/**
 * Stat calculation, ported from tpdpextcalc's stat_data.js (the maths only —
 * the originals read their inputs straight out of the DOM).
 * MIT -- Copyright (c) 2013-2018 Honko and other contributors.
 */

import { MARKS, SP, STATS_ALL } from './types';
import type { Puppet, StatKey, StatTable } from './types';
import { getModifiedStat } from './damage';

/** The engine's key for a paralysed status slot. */
const PARALYSIS = 'Paralyzed';

/**
 * Coerce a UI-supplied number into something safe to calculate with.
 *
 * Number inputs yield null/undefined when cleared and NaN when mid-edit; left
 * alone those propagate silently all the way to a NaN damage roll. Clamping
 * here keeps every divisor and multiplier in the engine finite.
 */
function num(value: number, fallback: number, min: number, max: number): number {
	const n = Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Per-stat build inputs: base value, invested Puppet Points, and rank-ups. */
export interface StatInput {
	base: number;
	pp: number;
	rank: number;
}

export function calcHP(
	base: number,
	pp: number,
	rank: number,
	level: number,
): number {
	// A base of 1 pins max HP to 1 (the Shanghai-doll case).
	if (base === 1) return 1;
	return Math.floor(((2 * (base + rank) + pp) * level) / 100) + level + 10;
}

export function calcStat(
	base: number,
	pp: number,
	rank: number,
	level: number,
	statName: StatKey,
	mark: string,
): number {
	const markMod = MARKS[mark] === statName ? 1.1 : 1;
	return Math.floor(
		(Math.floor(((2 * (base + rank) + pp) * level) / 100) + 5) * markMod,
	);
}

export interface PuppetBuild {
	name: string;
	type1: string;
	type2: string | null;
	cost: number;
	level: number;
	ability: string;
	item: string;
	mark: string;
	/** Base HP plus its investment; HP is not a boostable battle stat. */
	hp: StatInput;
	stats: Record<StatKey, StatInput>;
	boosts: StatTable;
	status: string[];
	/** Current HP as a fraction of max, 0..1. */
	hpPercent: number;
}

/** Turn a build into the shape the damage engine expects. */
export function buildPuppet(b: PuppetBuild): Puppet {
	const rawStats = {} as StatTable;
	const stats = {} as StatTable;
	const pp = {} as StatTable;

	const level = num(b.level, 100, 1, 100);

	for (const s of STATS_ALL) {
		const input = b.stats[s];
		const invested = num(input.pp, 0, 0, 64);
		rawStats[s] = calcStat(
			num(input.base, 1, 1, 999),
			invested,
			num(input.rank, 0, 0, 12),
			level,
			s,
			b.mark,
		);
		stats[s] = getModifiedStat(rawStats[s], num(b.boosts[s], 0, -6, 6));
		pp[s] = invested;
	}

	if (b.status.includes(PARALYSIS)) {
		stats[SP] = Math.floor(stats[SP] / 4);
	}

	// calcHP never returns below 1, so it is always safe as a divisor.
	const maxHP = calcHP(
		num(b.hp.base, 1, 1, 999),
		num(b.hp.pp, 0, 0, 64),
		num(b.hp.rank, 0, 0, 12),
		level,
	);
	const hpPercent = Number.isFinite(b.hpPercent)
		? Math.min(1, Math.max(0, b.hpPercent))
		: 1;
	const curHP = Math.max(0, Math.min(maxHP, Math.round(maxHP * hpPercent)));

	return {
		name: b.name,
		type1: b.type1,
		type2: b.type2,
		level,
		ability: b.ability,
		item: b.item,
		mark: b.mark,
		cost: b.cost,
		curHP,
		maxHP,
		stats,
		rawStats,
		boosts: b.boosts,
		pp,
		status: b.status,
		HPPP: b.hp.pp,
		hasType(type: string) {
			return this.type1 === type || this.type2 === type;
		},
	};
}

export function emptyBoosts(): StatTable {
	return { fa: 0, fd: 0, sa: 0, sd: 0, sp: 0 };
}
