import type Database from '@tauri-apps/plugin-sql';
import { getDb } from '$lib/data/db';
import {
	fetchCalcPuppets,
	fetchCalcMoves,
	fetchCalcAbilities,
	fetchCalcItems,
	fetchTypeChart,
	type CalcPuppetRow,
} from '$lib/data/calcRepository';
import { getDamageResult, setTypeChart } from '$lib/calc/damage';
import { buildPuppet, emptyBoosts, type PuppetBuild } from '$lib/calc/stats';
import { STATS_ALL, type MoveData, type StatKey } from '$lib/calc/types';

export const WEATHERS = [
	'Calm',
	'Aurora',
	'Heavy Fog',
	'Dust Storm',
	'Sunshower',
];
export const TERRAINS = ['Suzaku', 'Genbu', 'Seiryu', 'Kohryu', 'Byakko'];

export const STATUS_OPTIONS: { value: string; label: string }[] = [
	{ value: 'Poisoned', label: 'Poison' },
	{ value: 'Blinded', label: 'Darkness (halves Fo.Atk)' },
	{ value: 'Afraid', label: 'Fear (halves Sp.Atk)' },
	{ value: 'Paralyzed', label: 'Paralysis' },
	{ value: 'Asleep', label: 'Sleep' },
];

export const NATURES: { value: string; label: string }[] = [
	{ value: 'NULL', label: 'None' },
	{ value: 'Red', label: 'Red (+10% Fo.Atk)' },
	{ value: 'Blue', label: 'Blue (+10% Fo.Def)' },
	{ value: 'Black', label: 'Black (+10% Sp.Atk)' },
	{ value: 'White', label: 'White (+10% Sp.Def)' },
	{ value: 'Green', label: 'Green (+10% Spd)' },
];

/** Puppet Point limits: per stat, and across all six stats combined. */
export const MAX_PP_PER_STAT = 64;
export const MAX_PP_TOTAL = 130;
export const MIN_BOOST = -6;
export const MAX_BOOST = 6;

/** Editable state for one side of the calculation. */
export interface SideState {
	name: string;
	level: number;
	ability: string;
	item: string;
	mark: string;
	hpPercent: number;
	pp: Record<StatKey | 'hp', number>;
	boosts: Record<StatKey, number>;
	status: string[];
}

function emptySide(): SideState {
	return {
		name: '',
		level: 100,
		ability: '',
		item: '',
		mark: 'NULL',
		hpPercent: 100,
		pp: { hp: 0, fa: 0, fd: 0, sa: 0, sd: 0, sp: 0 },
		boosts: emptyBoosts(),
		status: ['None', 'None'],
	};
}

export interface CalcOutcome {
	damage: number[];
	description: string;
	minPercent: number;
	maxPercent: number;
	minDamage: number;
	maxDamage: number;
	defenderMaxHP: number;
	/** Hits needed to KO at the highest roll, or null when it can never KO. */
	koHits: number | null;
}

export class CalcViewModel {
	loading = $state(true);
	error = $state<string | null>(null);

	puppets = $state<CalcPuppetRow[]>([]);
	moves = $state<Record<string, MoveData>>({});
	movesAddedFromDb = $state<string[]>([]);

	attacker = $state<SideState>(emptySide());
	defender = $state<SideState>(emptySide());
	moveName = $state('');
	weather = $state('');
	terrain = $state('');
	isCrit = $state(false);

	// Unioned from the dex and the upstream calculator -- see calcRepository.
	itemOptions = $state<string[]>([]);
	abilityOptions = $state<string[]>([]);
	readonly statKeys = STATS_ALL;

	private db: Database | null = null;

	/** Plain name lists: every field on the page is a search box, not a dropdown. */
	puppetNames: string[] = $derived(this.puppets.map((p) => p.name));

	moveNames: string[] = $derived(
		Object.keys(this.moves)
			.filter((m) => this.moves[m].category !== 'Status')
			.sort(),
	);

	readonly natureLabels = NATURES.map((n) => n.label);
	readonly statusLabels = STATUS_OPTIONS.map((s) => s.label);

	/**
	 * 'None' is the engine's internal sentinel for an empty slot, so it maps to
	 * a blank box rather than appearing as something you can pick. Clearing the
	 * field puts the slot back to 'None'.
	 */
	statusLabel(value: string): string {
		return STATUS_OPTIONS.find((s) => s.value === value)?.label ?? '';
	}

	statusValue(label: string): string {
		return STATUS_OPTIONS.find((s) => s.label === label)?.value ?? 'None';
	}

	/** Natures are stored as engine mark keys but shown by their effect. */
	natureLabel(mark: string): string {
		return NATURES.find((n) => n.value === mark)?.label ?? '';
	}

	natureValue(label: string): string {
		return NATURES.find((n) => n.label === label)?.value ?? 'NULL';
	}

	/** How much of the roster came from the dex rather than the upstream tables. */
	modPuppetCount: number = $derived(
		this.puppets.filter((p) => p.is_mod === 1).length,
	);

	private byName: Map<string, CalcPuppetRow> = $derived(
		new Map(this.puppets.map((p) => [p.name, p])),
	);

	attackerRow: CalcPuppetRow | undefined = $derived(
		this.byName.get(this.attacker.name),
	);
	defenderRow: CalcPuppetRow | undefined = $derived(
		this.byName.get(this.defender.name),
	);

	attackerPpTotal: number = $derived(ppTotal(this.attacker));
	defenderPpTotal: number = $derived(ppTotal(this.defender));

	/** Abilities the selected puppet actually has, offered before the full list. */
	attackerAbilities: string[] = $derived(nativeAbilities(this.attackerRow));
	defenderAbilities: string[] = $derived(nativeAbilities(this.defenderRow));

	result: CalcOutcome | null = $derived.by(() => {
		const atkRow = this.attackerRow;
		const defRow = this.defenderRow;
		const moveData = this.moves[this.moveName];
		if (!atkRow || !defRow || !moveData) return null;

		const attacker = buildPuppet(toBuild(this.attacker, atkRow));
		const defender = buildPuppet(toBuild(this.defender, defRow));

		const move = {
			...moveData,
			name: this.moveName,
			hits: 1,
			usedTimes: 1,
			repetitionCount: 1,
			isCrit: this.isCrit,
			hasPriority: (moveData.priority ?? 0) > 0,
		};

		const { damage, description } = getDamageResult(
			attacker,
			defender,
			move,
			{ weather: this.weather, terrain: this.terrain },
		);

		const minDamage = Math.min(...damage);
		const maxDamage = Math.max(...damage);
		const maxHP = defender.maxHP;
		return {
			damage,
			description,
			minDamage,
			maxDamage,
			defenderMaxHP: maxHP,
			minPercent: round1((minDamage / maxHP) * 100),
			maxPercent: round1((maxDamage / maxHP) * 100),
			koHits: maxDamage > 0 ? Math.ceil(maxHP / maxDamage) : null,
		};
	});

	async init() {
		try {
			this.db = await getDb();
			const [puppets, moveResult, abilities, items, typeChart] =
				await Promise.all([
					fetchCalcPuppets(this.db),
					fetchCalcMoves(this.db),
					fetchCalcAbilities(this.db),
					fetchCalcItems(this.db),
					fetchTypeChart(this.db),
				]);
			// The engine needs the chart before any calculation runs.
			setTypeChart(typeChart);
			this.puppets = puppets;
			this.moves = moveResult.moves;
			this.movesAddedFromDb = moveResult.addedFromDex;
			this.abilityOptions = abilities;
			this.itemOptions = items;

			// Seed both sides so the page shows a real calculation immediately.
			if (puppets.length > 0) {
				this.setAttackerPuppet(puppets[0].name);
				this.setDefenderPuppet(
					puppets[Math.min(1, puppets.length - 1)].name,
				);
			}
			const firstMove = Object.keys(this.moves).find(
				(m) =>
					this.moves[m].category !== 'Status' && this.moves[m].bp > 0,
			);
			if (firstMove) this.moveName = firstMove;
		} catch (e) {
			this.error = String(e);
		} finally {
			this.loading = false;
		}
	}

	setAttackerPuppet(name: string) {
		const row = this.byName.get(name);
		this.attacker.name = name;
		this.attacker.ability = row?.ability1 ?? '';
		this.attacker.mark = bestNature(row);
	}

	setDefenderPuppet(name: string) {
		const row = this.byName.get(name);
		this.defender.name = name;
		this.defender.ability = row?.ability1 ?? '';
		this.defender.mark = bestNature(row);
	}

	swap() {
		const a = this.attacker;
		this.attacker = this.defender;
		this.defender = a;
	}

	reset() {
		const atk = this.puppets[0];
		const def = this.puppets[Math.min(1, this.puppets.length - 1)];
		this.attacker = emptySide();
		this.defender = emptySide();
		if (atk) this.setAttackerPuppet(atk.name);
		if (def) this.setDefenderPuppet(def.name);
		this.weather = '';
		this.terrain = '';
		this.isCrit = false;
	}
}

/** The nature matching a puppet's highest base battle stat (HP isn't markable). */
function bestNature(row: CalcPuppetRow | undefined): string {
	if (!row) return 'NULL';
	const byStat: [string, number][] = [
		['Red', row.fo_atk],
		['Blue', row.fo_def],
		['Black', row.sp_atk],
		['White', row.sp_def],
		['Green', row.spd],
	];
	// Ties resolve to the earlier entry, i.e. the canonical stat order.
	return byStat.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

function ppTotal(side: SideState): number {
	return Object.values(side.pp).reduce((sum, n) => sum + (Number(n) || 0), 0);
}

function nativeAbilities(row: CalcPuppetRow | undefined): string[] {
	if (!row) return [];
	return [row.ability1, row.ability2].filter((a): a is string => Boolean(a));
}

function toBuild(side: SideState, row: CalcPuppetRow): PuppetBuild {
	return {
		name: side.name,
		type1: row.type1,
		type2: row.type2,
		cost: row.cost,
		level: side.level,
		ability: side.ability,
		item: side.item,
		mark: side.mark,
		hp: { base: row.hp, pp: side.pp.hp, rank: 0 },
		stats: {
			fa: { base: row.fo_atk, pp: side.pp.fa, rank: 0 },
			fd: { base: row.fo_def, pp: side.pp.fd, rank: 0 },
			sa: { base: row.sp_atk, pp: side.pp.sa, rank: 0 },
			sd: { base: row.sp_def, pp: side.pp.sd, rank: 0 },
			sp: { base: row.spd, pp: side.pp.sp, rank: 0 },
		},
		boosts: side.boosts,
		status: side.status,
		hpPercent: side.hpPercent / 100,
	};
}

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}

export function createCalcViewModel() {
	return new CalcViewModel();
}
