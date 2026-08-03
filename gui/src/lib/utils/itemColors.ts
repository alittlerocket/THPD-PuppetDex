export const CATEGORY_COLORS: Record<string, string> = {
	'Battle Items': '#c0392b',
	'Core Skill Cards': '#ff1493',
	'Healing Items': '#27ae60',
	'Hold 1': '#2980b9',
	'Hold 2': '#8e44ad',
	'Key Items': '#f1c40f',
	'Shard of Dreams Skill Cards': '#9b59b6',
	'Sign Skill Cards': '#00bcd4',
	Tools: '#78909c',
};

export function categoryColor(category: string | null | undefined): string {
	return category ? (CATEGORY_COLORS[category] ?? '#555') : '#555';
}
