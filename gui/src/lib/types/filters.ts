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
  move: string;
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
    move: '',
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
