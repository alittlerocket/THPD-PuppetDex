export const TYPE_COLORS: Record<string, string> = {
  Void: '#f5a0b8', Illusion: '#e847b8', Fighting: '#f2703c',
  Wind: '#c5e065', Water: '#5b9bd5', Fire: '#ef4444',
  Electric: '#ff7300', Earth: '#b98a65', Steel: '#a0a0a0',
  Dark: '#585863', Light: '#dfc24c', Nature: '#4caf50',
  Dream: '#ce209d', Warped: '#4a5fc1', Nether: '#5c4066',
  Sound: '#fc9f08', Poison: '#b19cd9',
};

export function typeColor(type: string | null | undefined): string {
  return type ? (TYPE_COLORS[type] ?? '#555') : '#555';
}
