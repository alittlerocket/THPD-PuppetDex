export interface PuppetListRow {
  rowid: number;
  id: number;
  name: string;
  type1: string | null;
  type2: string | null;
  bst: number | null;
  cost: number | null;
  is_mod: number;
  sprite_normal: string | null;
}

export interface PuppetRow {
  rowid: number;
  id: number;
  name: string;
  is_mod: number;
  mod_tab: string | null;
  type1: string | null;
  type2: string | null;
  hp: number | null;
  fo_atk: number | null;
  fo_def: number | null;
  sp_atk: number | null;
  sp_def: number | null;
  spd: number | null;
  bst: number | null;
  cost: number | null;
  ability1: string | null;
  ability2: string | null;
  imagename: string | null;
  sprite_normal: string | null;
  sprite_alt_color: string | null;
  sprite_alt_costume: string | null;
  sprite_wedding: string | null;
  jp_name: string | null;
  low_drops: string | null;
  high_drops: string | null;
  dex_entry: string | null;
  stat_ranges: string | null;
}

export interface StyleSibling {
  rowid: number;
  name: string;
}

export interface RelatedForm {
  rowid: number;
  name: string;
  imagename: string | null;
  type1: string | null;
}

export interface LocationRow {
  location: string;
  level_range: string | null;
  encounter_rate: string | null;
}

export interface LearnsetRow {
  level: string | null;
  name: string;
  type: string | null;
  category: string | null;
  class: string | null;
  power: number | null;
  accuracy: number | null;
  max_sp: number | null;
  priority: number | null;
  pp: number | null;
}

export interface SkillCardRow {
  sc: string | null;
  name: string;
  type: string | null;
  category: string | null;
  class: string | null;
  power: number | null;
  accuracy: number | null;
  max_sp: number | null;
  priority: number | null;
}

export interface AltFormRow {
  form_name: string | null;
  sprite: string | null;
  stat_ranges: string | null;
}

export interface AbilityInfo {
  name: string;
  effect: string | null;
}

export type StatKey = 'hp' | 'fo_atk' | 'fo_def' | 'sp_atk' | 'sp_def' | 'spd';

export type SpriteVariant = 'normal' | 'alt_color' | 'alt_costume' | 'wedding';

export interface StatRange {
  min: number;
  max: number;
}
