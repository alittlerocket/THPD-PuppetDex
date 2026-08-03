export const STYLES = [
	'Normal',
	'Power',
	'Defense',
	'Speed',
	'Extra',
	'Assist',
];

export function styleOf(name: string): string {
	return STYLES.find((s) => name.startsWith(s + ' ')) ?? name;
}
