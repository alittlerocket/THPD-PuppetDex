export interface DropEntry {
	percent: string;
	name: string;
}

export function parseDrops(text: string | null): DropEntry[] {
	if (!text) return [];
	return text
		.split(',')
		.map((part) => part.trim())
		.map((part) => {
			const match = part.match(/^(\d+%)\s+(.+)$/);
			return match
				? { percent: match[1], name: match[2] }
				: { percent: '', name: part };
		})
		.filter((d) => d.name);
}
