<script lang="ts">
	import { page } from '$app/state';
	import { createItemDetailViewModel } from '$lib/viewmodels/itemDetail.svelte';
	import { categoryColor } from '$lib/utils/itemColors';
	import '../../../styles/global.css';
	import '../../../styles/ref-detail.css';

	const vm = createItemDetailViewModel();

	$effect(() => {
		if (page.params.name) vm.load(page.params.name);
	});
</script>

<div class="ref-page">
	<div class="ref-header">
		<button class="back" onclick={() => window.history.back()}>Back</button>
		<span class="ref-title">{page.params.name}</span>
	</div>

	{#if vm.loading}
		<div class="ref-status">
			<img src="/funky-cirno.gif" alt="Loading" class="loading-gif" />
		</div>
	{:else if vm.error}
		<p class="ref-status error">{vm.error}</p>
	{:else if vm.item}
		<div class="ref-card">
			<div class="ref-card-header">
				{#if vm.item.category}
					<span
						class="ref-badge"
						style="background:{categoryColor(vm.item.category)}"
						>{vm.item.category}</span
					>
				{/if}
			</div>
			{#if vm.item.jp_name}<div class="ref-jp-name">
					{vm.item.jp_name}
				</div>{/if}
			{#if vm.item.price !== null}
				<div class="ref-stat-grid">
					<div>Price<strong>{vm.item.price}</strong></div>
				</div>
			{/if}
			{#if vm.item.description}
				<p class="ref-description">{vm.item.description}</p>
			{/if}
		</div>
	{/if}
</div>
