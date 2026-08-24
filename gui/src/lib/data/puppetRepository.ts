import type Database from '@tauri-apps/plugin-sql';
import type {
	PuppetListRow,
	PuppetRow,
	StyleSibling,
	RelatedForm,
	LocationRow,
	LearnsetRow,
	SkillCardRow,
	AltFormRow,
	AbilityInfo,
} from '$lib/types/puppet';
import type { PuppetFilters, FilterOptions } from '$lib/types/filters';
import {
	DEFAULT_SORT_KEY,
	type SortDir,
	type SortKey,
} from '$lib/utils/sortConstants';
import { parseDrops } from '$lib/utils/drops';

export interface PuppetSort {
	key: SortKey;
	dir: SortDir;
}

// Whitelist of sortable columns
const SORT_EXPR: Record<SortKey, string> = {
	id: 'id',
	name: 'name COLLATE NOCASE',
	type1: 'type1 COLLATE NOCASE',
	hp: 'hp',
	fo_atk: 'fo_atk',
	fo_def: 'fo_def',
	sp_atk: 'sp_atk',
	sp_def: 'sp_def',
	spd: 'spd',
	bst: 'bst',
	cost: 'cost',
	move_level: 'CAST(move_level_0 AS INTEGER)',
};

function buildOrderBy(sort: PuppetSort, moveFilterActive: boolean): string {
	// move_level_0 is only in the result set while filtering by a move.
	const key =
		SORT_EXPR[sort.key] && (sort.key !== 'move_level' || moveFilterActive)
			? sort.key
			: DEFAULT_SORT_KEY;
	const expr = SORT_EXPR[key];
	const dir = sort.dir === 'desc' ? 'DESC' : 'ASC';
	return `ORDER BY ${expr} IS NULL, ${expr} ${dir}, id`;
}

function buildPuppetListQuery(
	filters: PuppetFilters,
	sort: PuppetSort,
): { sql: string; params: unknown[] } {
	const clauses: string[] = [];
	const params: unknown[] = [];

	function ph(value: unknown): string {
		params.push(value);
		return `$${params.length}`;
	}

	function addRange(col: string, min: number | null, max: number | null) {
		if (min !== null) clauses.push(`${col} >= ${ph(min)}`);
		if (max !== null) clauses.push(`${col} <= ${ph(max)}`);
	}

	clauses.push(`
    NOT (
      name LIKE '%*' AND EXISTS (
        SELECT 1 FROM puppets p2
        WHERE p2.name = RTRIM(puppets.name, '*') AND p2.is_mod = puppets.is_mod
      )
    )
  `);

	addRange('hp', filters.hpMin, filters.hpMax);
	addRange('fo_atk', filters.foAtkMin, filters.foAtkMax);
	addRange('fo_def', filters.foDefMin, filters.foDefMax);
	addRange('sp_atk', filters.spAtkMin, filters.spAtkMax);
	addRange('sp_def', filters.spDefMin, filters.spDefMax);
	addRange('spd', filters.spdMin, filters.spdMax);
	addRange('bst', filters.bstMin, filters.bstMax);
	addRange('cost', filters.costMin, filters.costMax);

	if (filters.ability) {
		const p1 = ph(filters.ability);
		const p2 = ph(filters.ability);
		clauses.push(`(ability1 = ${p1} OR ability2 = ${p2})`);
	}

	// Three-way: the two sentinels span every mod, anything else is the name of
	// one specific mod tab. Empty means no constraint.
	if (filters.isMod === 'official') clauses.push('is_mod = 0');
	else if (filters.isMod === 'modded') clauses.push('is_mod = 1');
	else if (filters.isMod) clauses.push(`mod_tab = ${ph(filters.isMod)}`);

	if (filters.location) {
		const p = ph(filters.location);
		clauses.push(
			`EXISTS (SELECT 1 FROM puppet_locations pl WHERE pl.puppet_rowid = puppets.rowid AND pl.location = ${p})`,
		);
	}

	for (const move of filters.moves) {
		const p1 = ph(move);
		const p2 = ph(move);
		clauses.push(`(
      EXISTS (SELECT 1 FROM puppet_learnset ls WHERE ls.puppet_rowid = puppets.rowid AND ls.name = ${p1})
      OR EXISTS (SELECT 1 FROM puppet_skill_cards sc WHERE sc.puppet_rowid = puppets.rowid AND sc.name = ${p2})
    )`);
	}

	if (filters.type) {
		const p1 = ph(filters.type);
		const p2 = ph(filters.type);
		clauses.push(`(type1 = ${p1} OR type2 = ${p2})`);
	}

	if (filters.style) {
		const p = ph(`${filters.style} %`);
		clauses.push(`name LIKE ${p}`);
	}

	// Surface where each filtered move comes from: the earliest level it's
	// learned at, and/or the skill card that teaches it.
	const moveCols = filters.moves
		.map((move, i) => {
			const p1 = ph(move);
			const p2 = ph(move);
			return `,
      (SELECT ls.level FROM puppet_learnset ls
        WHERE ls.puppet_rowid = puppets.rowid AND ls.name = ${p1}
        ORDER BY CAST(ls.level AS INTEGER) LIMIT 1) AS move_level_${i},
      (SELECT sc.sc FROM puppet_skill_cards sc
        WHERE sc.puppet_rowid = puppets.rowid AND sc.name = ${p2}
        LIMIT 1) AS move_sc_${i}`;
		})
		.join('');

	const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
	const sql = `
    SELECT rowid, id, name, type1, type2,
           hp, fo_atk, fo_def, sp_atk, sp_def, spd, bst, cost,
           is_mod, sprite_normal${moveCols}
    FROM puppets
    ${where}
    ${buildOrderBy(sort, filters.moves.length > 0)}
  `;
	return { sql, params };
}

export async function fetchPuppetList(
	db: Database,
	filters: PuppetFilters,
	sort: PuppetSort,
): Promise<PuppetListRow[]> {
	const { sql, params } = buildPuppetListQuery(filters, sort);
	return db.select<PuppetListRow[]>(sql, params);
}

export async function fetchFilterOptions(db: Database): Promise<FilterOptions> {
	const [abilities, locations, moves, types, mods] = await Promise.all([
		db.select<{ a: string }[]>(
			`SELECT ability1 AS a FROM puppets WHERE ability1 IS NOT NULL
			UNION
			SELECT ability2 AS a FROM puppets WHERE ability2 IS NOT NULL
			ORDER BY a`,
		),
		db.select<{ location: string }[]>(
			`SELECT DISTINCT location FROM puppet_locations WHERE location IS NOT NULL ORDER BY location`,
		),
		db.select<{ n: string }[]>(
			`SELECT name AS n FROM puppet_learnset WHERE name IS NOT NULL
			UNION
			SELECT name AS n FROM puppet_skill_cards WHERE name IS NOT NULL
			ORDER BY n`,
		),
		db.select<{ t: string }[]>(
			`SELECT type1 AS t FROM puppets WHERE type1 IS NOT NULL
			UNION
			SELECT type2 AS t FROM puppets WHERE type2 IS NOT NULL
			ORDER BY t`,
		),
		db.select<{ m: string }[]>(
			`SELECT DISTINCT mod_tab AS m FROM puppets WHERE mod_tab IS NOT NULL
			ORDER BY m`,
		),
	]);

	return {
		abilities: abilities.map((r) => r.a),
		locations: locations.map((r) => r.location),
		moves: moves.map((r) => r.n),
		types: types.map((r) => r.t),
		mods: mods.map((r) => r.m),
	};
}

export interface PuppetDetailBundle {
	puppet: PuppetRow;
	siblings: StyleSibling[];
	relatedForms: RelatedForm[];
	locations: LocationRow[];
	learnset: LearnsetRow[];
	skillCards: SkillCardRow[];
	altForms: AltFormRow[];
	abilityInfo: Record<string, string | null>;
	itemCategories: Record<string, string>;
}

export async function fetchPuppetDetail(
	db: Database,
	rowid: number,
): Promise<PuppetDetailBundle | null> {
	const rows = await db.select<PuppetRow[]>(
		'SELECT * FROM puppets WHERE rowid = $1',
		[rowid],
	);
	if (rows.length === 0) return null;
	const puppet = rows[0];

	const starredTarget = puppet.name.endsWith('*')
		? puppet.name.slice(0, -1).trim()
		: `${puppet.name}*`;

	const [
		sibs,
		related1,
		related2,
		locations,
		learnset,
		skillCards,
		altForms,
		abilities,
	] = await Promise.all([
		puppet.imagename
			? db.select<StyleSibling[]>(
					'SELECT rowid, name FROM puppets WHERE imagename = $1 AND is_mod = $2 ORDER BY id',
					[puppet.imagename, puppet.is_mod],
				)
			: Promise.resolve([]),
		db.select<RelatedForm[]>(
			'SELECT rowid, name, imagename, type1 FROM puppets WHERE name = $1 AND is_mod = $2 AND rowid != $3',
			[puppet.name, puppet.is_mod, rowid],
		),
		db.select<RelatedForm[]>(
			'SELECT rowid, name, imagename, type1 FROM puppets WHERE name = $1 AND is_mod = $2',
			[starredTarget, puppet.is_mod],
		),
		db.select<LocationRow[]>(
			'SELECT location, level_range, encounter_rate FROM puppet_locations WHERE puppet_rowid = $1 ORDER BY location',
			[rowid],
		),
		db.select<LearnsetRow[]>(
			'SELECT level, name, type, category, class, power, accuracy, max_sp, priority, pp FROM puppet_learnset WHERE puppet_rowid = $1 ORDER BY CAST(level AS INTEGER)',
			[rowid],
		),
		db.select<SkillCardRow[]>(
			'SELECT sc, name, type, category, class, power, accuracy, max_sp, priority FROM puppet_skill_cards WHERE puppet_rowid = $1 ORDER BY sc',
			[rowid],
		),
		db.select<AltFormRow[]>(
			'SELECT form_name, sprite, stat_ranges FROM puppet_alt_forms WHERE puppet_rowid = $1',
			[rowid],
		),
		db.select<AbilityInfo[]>(
			'SELECT name, effect FROM abilities WHERE name IN ($1, $2)',
			[puppet.ability1 ?? '', puppet.ability2 ?? ''],
		),
	]);

	const relatedMap = new Map<number, RelatedForm>();
	for (const f of [...related1, ...related2]) relatedMap.set(f.rowid, f);

	const abilityInfo: Record<string, string | null> = {};
	for (const a of abilities) abilityInfo[a.name] = a.effect;

	const itemCategories = await fetchItemCategoriesForDrops(
		db,
		puppet.low_drops,
		puppet.high_drops,
	);

	return {
		puppet,
		siblings: sibs,
		relatedForms: [...relatedMap.values()],
		locations,
		learnset,
		skillCards,
		altForms,
		abilityInfo,
		itemCategories,
	};
}

async function fetchItemCategoriesForDrops(
	db: Database,
	lowDrops: string | null,
	highDrops: string | null,
): Promise<Record<string, string>> {
	const names = [
		...new Set(
			[...parseDrops(lowDrops), ...parseDrops(highDrops)].map(
				(d) => d.name,
			),
		),
	];
	if (names.length === 0) return {};

	const placeholders = names.map((_, i) => `$${i + 1}`).join(', ');
	const itemRows = await db.select<
		{ name: string; category: string | null }[]
	>(
		`SELECT name, category FROM items WHERE name IN (${placeholders})`,
		names,
	);
	const catMap: Record<string, string> = {};
	for (const it of itemRows) if (it.category) catMap[it.name] = it.category;
	return catMap;
}
