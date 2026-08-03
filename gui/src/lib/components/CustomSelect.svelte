<script lang="ts">
	let {
		options,
		value = $bindable(),
		placeholder = 'Any',
		clearable = true,
		onchange,
	}: {
		options: { value: string; label: string }[];
		value: string;
		placeholder?: string;
		clearable?: boolean;
		/** Fired after a selection, for side effects the binding alone can't do. */
		onchange?: (value: string) => void;
	} = $props();

	let open = $state(false);
	let root: HTMLDivElement;

	function choose(v: string) {
		value = v;
		open = false;
		onchange?.(v);
	}

	function handleClickOutside(e: MouseEvent) {
		if (root && !root.contains(e.target as Node)) open = false;
	}

	$effect(() => {
		if (!open) return;
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});

	let selectedLabel = $derived(
		options.find((o) => o.value === value)?.label ?? placeholder,
	);
</script>

<div class="custom-select" bind:this={root}>
	<button
		type="button"
		class="custom-select-trigger"
		class:placeholder-text={!value}
		onclick={() => (open = !open)}
	>
		<span>{selectedLabel}</span>
		<svg width="12" height="8" viewBox="0 0 12 8"
			><path fill="currentColor" d="M1 1l5 5 5-5" /></svg
		>
	</button>
	{#if open}
		<ul class="custom-select-list">
			{#if clearable}
				<li>
					<button
						type="button"
						class:selected={!value}
						onclick={() => choose('')}>{placeholder}</button
					>
				</li>
			{/if}
			{#each options as opt}
				<li>
					<button
						type="button"
						class:selected={value === opt.value}
						onclick={() => choose(opt.value)}
					>
						{opt.label}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	/* Widget styling lives with the component so every page that uses it gets the
     theme. These previously sat in dex.css, so any other page rendered them
     unstyled. */
	.custom-select {
		position: relative;
	}

	.custom-select-trigger {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.4rem 0.5rem;
		border: 1px solid #444;
		background: #111;
		color: #fff;
		font-size: 0.85rem;
		font-family: inherit;
		cursor: pointer;
		text-align: left;
	}

	.custom-select-trigger:hover {
		border-color: #666;
	}
	.custom-select-trigger:focus {
		outline: none;
		border-color: #ff1493;
	}
	.custom-select-trigger.placeholder-text {
		color: #777;
	}
	.custom-select-trigger svg {
		flex-shrink: 0;
		color: #ff1493;
	}

	.custom-select-list {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		z-index: 20;
		max-height: 260px;
		overflow-y: auto;
		list-style: none;
		border: 1px solid #ff1493;
		background: #111;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
	}

	.custom-select-list li {
		display: block;
		content-visibility: auto;
		contain-intrinsic-size: auto 30px;
	}

	.custom-select-list button {
		display: block;
		width: 100%;
		padding: 0.4rem 0.6rem;
		border: none;
		background: transparent;
		color: #fff;
		font-size: 0.82rem;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	.custom-select-list button:hover {
		background: rgba(255, 20, 147, 0.2);
	}
	.custom-select-list button.selected {
		background: rgba(255, 20, 147, 0.35);
	}
</style>
