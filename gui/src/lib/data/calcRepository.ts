import type Database from '@tauri-apps/plugin-sql';
import type { MoveData } from '$lib/calc/types';

/**
 * Everything the damage calculator needs, read from puppetdex.db.
 *
 * The app ships no copy of this data. The type chart and the mechanical move
 * flags aren't published on the wiki, so they're curated in
 * data/calc_extras.json and materialised into the database by
 * parser/build_db.py alongside the scraped dex data.
 */

/** A puppet the calculator can use. */
export interface CalcPuppetRow {
	name: string;
	type1: string;
	type2: string | null;
	hp: number;
	fo_atk: number;
	fo_def: number;
	sp_atk: number;
	sp_def: number;
	spd: number;
	cost: number;
	ability1: string | null;
	ability2: string | null;
	is_mod: number;
}

/**
 * Every puppet with a full stat line. This is what extends the calculator to
 * the mod roster: upstream ships ~610 puppets, the dex has ~860.
 *
 * Alt-form rows (trailing '*') are excluded where a base-named counterpart
 * exists, matching the dex list's own rule.
 */
export async function fetchCalcPuppets(db: Database): Promise<CalcPuppetRow[]> {
	return db.select<CalcPuppetRow[]>(`
    SELECT name, type1, type2, hp, fo_atk, fo_def, sp_atk, sp_def, spd,
           COALESCE(cost, 0) AS cost, ability1, ability2, is_mod
    FROM puppets
    WHERE type1 IS NOT NULL
      AND hp IS NOT NULL AND fo_atk IS NOT NULL AND fo_def IS NOT NULL
      AND sp_atk IS NOT NULL AND sp_def IS NOT NULL AND spd IS NOT NULL
      AND NOT (
        name LIKE '%*' AND EXISTS (
          SELECT 1 FROM puppets p2
          WHERE p2.name = RTRIM(puppets.name, '*') AND p2.is_mod = puppets.is_mod
        )
      )
    ORDER BY is_mod, id, name
  `);
}

/** TYPE_CHART[attackingType][defendingType] -> damage multiplier. */
export async function fetchTypeChart(
	db: Database,
): Promise<Record<string, Record<string, number>>> {
	const rows = await db.select<
		{ attacking: string; defending: string; multiplier: number }[]
	>('SELECT attacking, defending, multiplier FROM type_chart');
	const chart: Record<string, Record<string, number>> = {};
	for (const r of rows) {
		(chart[r.attacking] ??= {})[r.defending] = r.multiplier;
	}
	return chart;
}

interface CalcMoveRow {
	name: string;
	type: string | null;
	category: string | null;
	bp: number | null;
	accuracy: number | null;
	flags: string | null;
}

interface DexMoveRow {
	name: string;
	type: string | null;
	category: string | null;
	power: number | null;
	accuracy: number | null;
}

/**
 * Move data for the engine.
 *
 * calc_moves is authoritative where it has an entry: it carries the mechanical
 * flags, and its base power is deliberately 1 rather than NULL for the
 * variable-power moves the engine computes dynamically. Dex skills fill in
 * everything else, which is how mod moves become selectable.
 *
 * Moves sourced from the dex get type/category/power only, so any special
 * behaviour stays inert until it's curated upstream.
 */
export async function fetchCalcMoves(db: Database): Promise<{
	moves: Record<string, MoveData>;
	addedFromDex: string[];
}> {
	const [calcRows, dexRows] = await Promise.all([
		db.select<CalcMoveRow[]>(
			'SELECT name, type, category, bp, accuracy, flags FROM calc_moves',
		),
		db.select<DexMoveRow[]>(
			`SELECT DISTINCT name, type, category, power, accuracy
       FROM skills WHERE name IS NOT NULL ORDER BY name`,
		),
	]);

	const moves: Record<string, MoveData> = {};
	for (const r of calcRows) {
		moves[r.name] = {
			...(r.flags ? (JSON.parse(r.flags) as Partial<MoveData>) : {}),
			type: r.type ?? 'Void',
			category: r.category ?? 'Status',
			bp: r.bp ?? 0,
			accuracy: r.accuracy ?? undefined,
		};
	}

	const addedFromDex: string[] = [];
	for (const r of dexRows) {
		if (r.name in moves) continue;
		const category =
			r.category === 'Focus' || r.category === 'Spread'
				? r.category
				: 'Status';
		moves[r.name] = {
			type: r.type ?? 'Void',
			category,
			bp: r.power ?? 0,
			accuracy: r.accuracy ?? undefined,
		};
		addedFromDex.push(r.name);
	}

	return { moves, addedFromDex };
}

/** Selectable ability names (dex + curated, unioned at build time). */
export async function fetchCalcAbilities(db: Database): Promise<string[]> {
	const rows = await db.select<{ name: string }[]>(
		'SELECT name FROM calc_abilities ORDER BY name',
	);
	return rows.map((r) => r.name);
}

/** Selectable held-item names (dex holdables + curated, unioned at build time). */
export async function fetchCalcItems(db: Database): Promise<string[]> {
	const rows = await db.select<{ name: string }[]>(
		'SELECT name FROM calc_items ORDER BY name',
	);
	return rows.map((r) => r.name);
}
