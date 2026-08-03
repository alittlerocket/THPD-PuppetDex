import { loadSettings, saveSettings } from '$lib/data/settingsStore';
import { defaultSettings, type AppSettings } from '$lib/types/settings';

export class SettingsViewModel {
	#settings = $state<AppSettings>(defaultSettings());
	saved = $state(false);

	#savedTimer: ReturnType<typeof setTimeout> | undefined;

	/** Bound as a string because the select works in strings. */
	get pageSize(): string {
		return String(this.#settings.pageSize);
	}

	set pageSize(v: string) {
		const n = Number(v);
		if (!Number.isFinite(n) || n < 0) return;
		this.#settings = { ...this.#settings, pageSize: Math.floor(n) };
		this.persist();
	}

	load() {
		this.#settings = loadSettings();
	}

	private persist() {
		saveSettings($state.snapshot(this.#settings) as AppSettings);
		// Brief confirmation so a silent save doesn't look like a no-op.
		this.saved = true;
		if (this.#savedTimer !== undefined) clearTimeout(this.#savedTimer);
		this.#savedTimer = setTimeout(() => {
			this.saved = false;
			this.#savedTimer = undefined;
		}, 1500);
	}
}

export function createSettingsViewModel() {
	return new SettingsViewModel();
}
