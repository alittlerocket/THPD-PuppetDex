export interface AppSettings {
  pageSize: number;
}

export const ALL_ON_ONE_PAGE = 0;

export const PAGE_SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: '25', label: '25 per page' },
  { value: '50', label: '50 per page' },
  { value: '100', label: '100 per page' },
  { value: '200', label: '200 per page' },
  { value: String(ALL_ON_ONE_PAGE), label: 'All on one page' },
];

export function defaultSettings(): AppSettings {
  return { pageSize: 50 };
}
