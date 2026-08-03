/**
 * Item type/charm lookups, ported verbatim from tpdpextcalc's item_data.js.
 * MIT — Copyright (c) 2013-2018 Honko and other contributors.
 */

// Serves both the type-boosting gems/hairpins and the type-resisting charms.
const ITEM_TYPES: Record<string, string> = {
	Diamond: 'Void',
	'Diamond Hairpin': 'Void',
	'Anti-Fire Charm': 'Fire',
	Ruby: 'Fire',
	'Ruby Hairpin': 'Fire',
	'Anti-Aqua Charm': 'Water',
	Sapphire: 'Water',
	'Sapphire Hairpin': 'Water',
	'Anti-Flora Charm': 'Nature',
	Emerald: 'Nature',
	'Emerald Hairpin': 'Nature',
	'Anti-Earth Charm': 'Earth',
	'Tiger Eye': 'Earth',
	'Quartz Hairpin': 'Earth',
	'Anti-Steel Charm': 'Steel',
	Hematite: 'Steel',
	'Hematite Hairpin': 'Steel',
	'Anti-Wind Charm': 'Wind',
	Jade: 'Wind',
	'Jade Hairpin': 'Wind',
	'Anti-Bolt Charm': 'Electric',
	Topaz: 'Electric',
	'Topaz Hairpin': 'Electric',
	'Anti-Light Charm': 'Light',
	Opal: 'Light',
	'Opal Hairpin': 'Light',
	'Anti-Dark Charm': 'Dark',
	Obsidian: 'Dark',
	'Obsidian Hairpin': 'Dark',
	'Anti-Necro Charm': 'Nether',
	Sugilite: 'Nether',
	'Sugilite Hairpin': 'Nether',
	'Anti-Toxin Charm': 'Poison',
	Amethyst: 'Poison',
	'Amethyst Hairpin': 'Poison',
	'Anti-Fight Charm': 'Fighting',
	Amber: 'Fighting',
	'Amber Hairpin': 'Fighting',
	'Anti-Veil Charm': 'Illusion',
	Morganite: 'Illusion',
	'Clear Hairpin': 'Illusion',
	'Anti-Sound Charm': 'Sound',
	Onyx: 'Sound',
	'Onyx Hairpin': 'Sound',
	'Anti-Warp Charm': 'Warped',
	'Lapis Lazuli': 'Warped',
	'Lapis Hairpin': 'Warped',
};

export function getItemType(item: string): string {
	return ITEM_TYPES[item] ?? 'None';
}

export function isItemCharm(item: string): number {
	return item.startsWith('Anti-') &&
		item.endsWith(' Charm') &&
		item in ITEM_TYPES
		? 1
		: 0;
}
