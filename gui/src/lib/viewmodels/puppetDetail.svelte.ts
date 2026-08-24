import type Database from '@tauri-apps/plugin-sql';
import { getDb } from '$lib/data/db';
import { fetchPuppetDetail } from '$lib/data/puppetRepository';
import { parseDrops, type DropEntry } from '$lib/utils/drops';
import type {
	PuppetRow,
	StyleSibling,
	RelatedForm,
	LocationRow,
	LearnsetRow,
	SkillCardRow,
	AltFormRow,
	SpriteVariant,
	StatRange,
} from '$lib/types/puppet';

function variantSprite(p: PuppetRow, v: SpriteVariant): string | null {
	if (v === 'normal') return p.sprite_normal;
	if (v === 'alt_color') return p.sprite_alt_color;
	if (v === 'alt_costume') return p.sprite_alt_costume;
	return p.sprite_wedding;
}

const VARIANT_KEYS: SpriteVariant[] = [
	'normal',
	'alt_color',
	'alt_costume',
	'wedding',
];

export class PuppetDetailViewModel {
	puppet = $state<PuppetRow | null>(null);
	siblings = $state<StyleSibling[]>([]);
	relatedForms = $state<RelatedForm[]>([]);
	locations = $state<LocationRow[]>([]);
	learnset = $state<LearnsetRow[]>([]);
	skillCards = $state<SkillCardRow[]>([]);
	altForms = $state<AltFormRow[]>([]);
	abilityInfo = $state<Record<string, string | null>>({});
	itemCategories = $state<Record<string, string>>({});
	loading = $state(true);
	error = $state<string | null>(null);
	activeFormIndex = $state(-1);
	spriteVariant = $state<SpriteVariant>('normal');

	private db: Database | null = null;

	get baseStatRanges(): Record<string, StatRange> {
		return this.puppet?.stat_ranges
			? JSON.parse(this.puppet.stat_ranges)
			: {};
	}

	get variantOptions(): SpriteVariant[] {
		if (!this.puppet) return [];
		const p = this.puppet;
		return VARIANT_KEYS.filter((v) => Boolean(variantSprite(p, v)));
	}

	get displaySprite(): string | null {
		if (this.activeFormIndex === -1) {
			return this.puppet
				? variantSprite(this.puppet, this.spriteVariant)
				: null;
		}
		return this.altForms[this.activeFormIndex]?.sprite ?? null;
	}

	get displayStatRanges(): Record<string, StatRange> {
		if (this.activeFormIndex === -1) return this.baseStatRanges;
		const raw = this.altForms[this.activeFormIndex]?.stat_ranges;
		return raw ? JSON.parse(raw) : {};
	}

	get lowDrops(): DropEntry[] {
		return parseDrops(this.puppet?.low_drops ?? null);
	}

	get highDrops(): DropEntry[] {
		return parseDrops(this.puppet?.high_drops ?? null);
	}

	get relatedFormsUseType(): boolean {
		if (!this.puppet || this.relatedForms.length === 0) return false;
		const imagenames = new Set([
			this.puppet.imagename,
			...this.relatedForms.map((f) => f.imagename),
		]);
		return imagenames.size === 1;
	}

	get allRelatedForms(): RelatedForm[] {
		if (!this.puppet) return [];
		const self: RelatedForm = {
			rowid: this.puppet.rowid,
			name: this.puppet.name,
			imagename: this.puppet.imagename,
			type1: this.puppet.type1,
		};
		return [self, ...this.relatedForms].sort((a, b) => a.rowid - b.rowid);
	}

	relatedFormLabel(form: {
		imagename: string | null;
		type1: string | null;
	}): string {
		if (this.relatedFormsUseType) return form.type1 || 'Base';
		return form.imagename || 'Base';
	}

	setActiveForm(index: number) {
		this.activeFormIndex = index;
	}

	setSpriteVariant(variant: SpriteVariant) {
		this.spriteVariant = variant;
	}

	async load(rowid: number) {
		if (!this.db) this.db = await getDb();
		this.loading = true;
		this.error = null;
		this.activeFormIndex = -1;
		this.spriteVariant = 'normal';
		try {
			const bundle = await fetchPuppetDetail(this.db, rowid);
			if (!bundle) {
				this.error = 'Puppet not found';
				return;
			}
			this.puppet = bundle.puppet;
			this.siblings = bundle.siblings;
			this.relatedForms = bundle.relatedForms;
			this.locations = bundle.locations;
			this.learnset = bundle.learnset;
			this.skillCards = bundle.skillCards;
			this.altForms = bundle.altForms;
			this.abilityInfo = bundle.abilityInfo;
			this.itemCategories = bundle.itemCategories;
		} catch (e) {
			this.error = String(e);
		} finally {
			this.loading = false;
		}
	}
}

export function createPuppetDetailViewModel() {
	return new PuppetDetailViewModel();
}
