<script lang="ts">
	let {
		options,
		values = $bindable(),
		placeholder = 'Add...',
	}: {
		options: string[];
		values: string[];
		placeholder?: string;
	} = $props();

	let query = $state('');
	let open = $state(false);
	let root: HTMLDivElement;

	// Already-picked entries drop out of the list so every row is actionable.
	// Not truncated: hiding matches silently is worse than a long scroll, and
	// the rows use content-visibility so offscreen ones aren't rendered.
	let matches = $derived(
		options
			.filter((o) => !values.includes(o))
			.filter(
				(o) => !query || o.toLowerCase().includes(query.toLowerCase()),
			),
	);

	function add(v: string) {
		if (!values.includes(v)) values = [...values, v];
		query = '';
		open = false;
	}

	function remove(v: string) {
		values = values.filter((x) => x !== v);
	}

	function handleClickOutside(e: MouseEvent) {
		if (root && !root.contains(e.target as Node)) open = false;
	}

	$effect(() => {
		if (!open) return;
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="custom-multi">
	<div class="custom-select" bind:this={root}>
		<input
			type="text"
			class="custom-select-trigger custom-autocomplete-input"
			{placeholder}
			bind:value={query}
			onfocus={() => (open = true)}
		/>
		{#if open && matches.length > 0}
			<ul class="custom-select-list">
				{#each matches as opt}
					<li>
						<button type="button" onclick={() => add(opt)}
							>{opt}</button
						>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if values.length > 0}
		<div class="multi-chips">
			{#each values as v}
				<span class="multi-chip">
					{v}
					<button
						type="button"
						class="multi-chip-x"
						title="Remove"
						onclick={() => remove(v)}>×</button
					>
				</span>
			{/each}
		</div>
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
	.custom-autocomplete-input::placeholder {
		color: #777;
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
		/* Lists aren't truncated, so a broad query can render hundreds of rows.
		   Skipping offscreen ones keeps that cheap; the intrinsic size keeps
		   the scrollbar proportional. */
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

	.custom-multi {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.multi-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.multi-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.15rem 0.35rem 0.15rem 0.5rem;
		border: 1px solid #ff1493;
		background: rgba(255, 20, 147, 0.15);
		color: #fff;
		font-size: 0.7rem;
	}

	.multi-chip-x {
		border: none;
		background: transparent;
		color: #ff9ec7;
		font-size: 0.85rem;
		line-height: 1;
		padding: 0 0.1rem;
		cursor: pointer;
	}

	.multi-chip-x:hover {
		color: #fff;
	}
</style>
