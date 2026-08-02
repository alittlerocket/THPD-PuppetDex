import { STAT_COLUMN_ORDER, type StatColumn } from '$lib/utils/statConstants';

export interface PuppetFilters {
  hpMin: number | null; hpMax: number | null;
  foAtkMin: number | null; foAtkMax: number | null;
  foDefMin: number | null; foDefMax: number | null;
  spAtkMin: number | null; spAtkMax: number | null;
  spDefMin: number | null; spDefMax: number | null;
  spdMin: number | null; spdMax: number | null;
  bstMin: number | null; bstMax: number | null;
  costMin: number | null; costMax: number | null;
  ability: string;
  isMod: string;
  location: string;
  moves: string[];
  type: string;
  style: string;
}

export function emptyFilters(): PuppetFilters {
  return {
    hpMin: null, hpMax: null,
    foAtkMin: null, foAtkMax: null,
    foDefMin: null, foDefMax: null,
    spAtkMin: null, spAtkMax: null,
    spDefMin: null, spDefMax: null,
    spdMin: null, spdMax: null,
    bstMin: null, bstMax: null,
    costMin: null, costMax: null,
    ability: '',
    isMod: 'all',
    location: '',
    moves: [],
    type: '',
    style: '',
  };
}

export interface FilterOptions {
  abilities: string[];
  locations: string[];
  moves: string[];
  types: string[];
}

// Maps each range-filterable puppet column to its [min, max] filter fields, so
// the dex list can work out which stats the user is currently filtering on.
export const STAT_FILTER_RANGE: Record<StatColumn, [keyof PuppetFilters, keyof PuppetFilters]> = {
  hp: ['hpMin', 'hpMax'],
  fo_atk: ['foAtkMin', 'foAtkMax'],
  fo_def: ['foDefMin', 'foDefMax'],
  sp_atk: ['spAtkMin', 'spAtkMax'],
  sp_def: ['spDefMin', 'spDefMax'],
  spd: ['spdMin', 'spdMax'],
  bst: ['bstMin', 'bstMax'],
  cost: ['costMin', 'costMax'],
};

/** The stat columns with at least one bound set — these get shown on each card. */
export function activeStatColumns(filters: PuppetFilters): StatColumn[] {
  return STAT_COLUMN_ORDER.filter((col) => {
    const [minKey, maxKey] = STAT_FILTER_RANGE[col];
    return filters[minKey] !== null || filters[maxKey] !== null;
  });
}
