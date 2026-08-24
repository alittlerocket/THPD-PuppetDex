<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { createPuppetDetailViewModel } from '$lib/viewmodels/puppetDetail.svelte';
	import SpriteReveal from '$lib/components/SpriteReveal.svelte';
	import { typeColor } from '$lib/utils/typeColors';
	import { categoryColor } from '$lib/utils/itemColors';
	import { styleOf } from '$lib/utils/styleUtils';
	import {
		STAT_LABELS,
		STAT_MAX,
		STAT_ORDER,
		BST_MAX,
		VARIANT_LABELS,
		statBarSegment,
	} from '$lib/utils/statConstants';
	import '../../../styles/global.css';
	import '../../../styles/puppet-detail.css';

	const vm = createPuppetDetailViewModel();

	$effect(() => {
		vm.load(Number(page.params.rowid));
	});
</script>

<div class="detail-page">
	{#if vm.loading}
		<div class="detail-status">
			<img src="/funky-cirno.gif" alt="Loading" class="loading-gif" />
		</div>
	{:else if vm.error}
		<p class="detail-status error">{vm.error}</p>
	{:else if vm.puppet}
		<div class="detail-header">
			<a class="back" href="/dex">Back</a>
			<span class="detail-title">{vm.puppet.name}</span>
			{#if vm.siblings.length > 1}
				<div class="style-switcher">
					{#each vm.siblings as sib}
						<button
							class="style-pill"
							class:active={sib.rowid === vm.puppet.rowid}
							onclick={() => goto(`/dex/${sib.rowid}`)}
						>
							{styleOf(sib.name)}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		{#if vm.relatedForms.length > 0}
			<div class="related-forms-row">
				<span class="related-forms-label">Alt Form:</span>
				{#each vm.allRelatedForms as form (form.rowid)}
					<button
						class="style-pill"
						class:active={form.rowid === vm.puppet.rowid}
						onclick={() => goto(`/dex/${form.rowid}`)}
					>
						{vm.relatedFormLabel(form)}
					</button>
				{/each}
			</div>
		{/if}

		<div class="detail-main">
			<div class="detail-left">
				{#if vm.altForms.length > 0}
					<div class="alt-form-toggle">
						<button
							class="style-pill"
							class:active={vm.activeFormIndex === -1}
							onclick={() => vm.setActiveForm(-1)}
						>
							Base
						</button>
						{#each vm.altForms as form, i}
							<button
								class="style-pill"
								class:active={vm.activeFormIndex === i}
								onclick={() => vm.setActiveForm(i)}
							>
								{form.form_name ?? `Alt ${i + 1}`}
							</button>
						{/each}
					</div>
				{/if}

				<div class="detail-sprite-frame">
					{#if vm.displaySprite}
						<SpriteReveal
							src="/sprites/{vm.displaySprite}"
							alt={vm.puppet.name}
						/>
					{/if}
				</div>

				{#if vm.activeFormIndex === -1 && vm.variantOptions.length > 1}
					<div class="sprite-variant-toggle">
						{#each vm.variantOptions as v}
							<button
								class="variant-pill"
								class:active={vm.spriteVariant === v}
								onclick={() => vm.setSpriteVariant(v)}
							>
								{VARIANT_LABELS[v]}
							</button>
						{/each}
					</div>
				{/if}

				<div class="detail-types">
					{#if vm.puppet.type1}
						<span
							class="detail-type-badge"
							style="background:{typeColor(vm.puppet.type1)}"
							>{vm.puppet.type1}</span
						>
					{/if}
					{#if vm.puppet.type2}
						<span
							class="detail-type-badge"
							style="background:{typeColor(vm.puppet.type2)}"
							>{vm.puppet.type2}</span
						>
					{/if}
				</div>

				<div class="meta-row">
					<div class="meta-label">Cost</div>
					<div class="meta-label">BST</div>
					<div class="meta-label">Modded?</div>
					{#if vm.puppet.cost}
						<div class="meta-value">{vm.puppet.cost}</div>
					{/if}
					{#if vm.puppet.bst}
						<div class="meta-value">{vm.puppet.bst}</div>
					{/if}
					<div class="meta-value">
						{vm.puppet.is_mod ? 'True' : 'False'}
					</div>
				</div>

				{#if vm.puppet.ability1 || vm.puppet.ability2}
					<div class="abilities-list">
						{#if vm.puppet.ability1}
							<div class="ability-block">
								<span class="ability-tag"
									>{vm.puppet.ability1}</span
								>
								{#if vm.abilityInfo[vm.puppet.ability1]}
									<p class="ability-effect">
										{vm.abilityInfo[vm.puppet.ability1]}
									</p>
								{/if}
							</div>
						{/if}
						{#if vm.puppet.ability2}
							<div class="ability-block">
								<span class="ability-tag"
									>{vm.puppet.ability2}</span
								>
								{#if vm.abilityInfo[vm.puppet.ability2]}
									<p class="ability-effect">
										{vm.abilityInfo[vm.puppet.ability2]}
									</p>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="detail-right">
				<div>
					<div class="section-title">
						Base Stats{#if vm.activeFormIndex !== -1}
							— {vm.altForms[vm.activeFormIndex]?.form_name}{/if}
					</div>
					<div class="stat-bar-row stat-bar-header">
						<span></span>
						<span class="stat-bar-base">Base</span>
						<span></span>
						<span class="stat-bar-value">Level 50 Range</span>
					</div>
					{#each STAT_ORDER as stat}
						{#if vm.displayStatRanges[stat]}
							{@const range = vm.displayStatRanges[stat]}
							{@const seg = statBarSegment(
								range.min,
								range.max,
								STAT_MAX[stat],
							)}
							{@const base =
								vm.activeFormIndex === -1
									? vm.puppet[stat]
									: null}
							<div class="stat-bar-row">
								<span class="stat-bar-label"
									>{STAT_LABELS[stat]}</span
								>
								<span class="stat-bar-base">{base ?? '—'}</span>
								<div class="stat-bar-track">
									<div
										class="stat-bar-fill"
										style="margin-left:{seg.leftPct}%; width:{seg.widthPct}%"
									></div>
								</div>
								<span class="stat-bar-value"
									>{range.min}–{range.max}</span
								>
							</div>
						{/if}
					{/each}
					{#if vm.activeFormIndex === -1 && vm.puppet.bst}
						{@const bstPct = Math.min(
							100,
							(vm.puppet.bst / BST_MAX) * 100,
						)}
						<div class="stat-bar-row">
							<span class="stat-bar-label">BST</span>
							<span class="stat-bar-base">{vm.puppet.bst}</span>
							<div class="stat-bar-track">
								<div
									class="stat-bar-fill"
									style="width:{bstPct}%"
								></div>
							</div>
							<span class="stat-bar-value"></span>
						</div>
					{/if}
				</div>

				{#if vm.puppet.dex_entry}
					<div>
						<div class="section-title">Dex Entry</div>
						<p class="dex-entry">{vm.puppet.dex_entry}</p>
					</div>
				{/if}

				{#if vm.lowDrops.length > 0 || vm.highDrops.length > 0}
					<div>
						<div class="section-title">Drops</div>
						<div class="drops-row">
							{#if vm.lowDrops.length > 0}
								<div class="drops-line">
									<strong>Low:</strong>
									{#each vm.lowDrops as d}
										<a
											class="item-chip"
											href="/items/{encodeURIComponent(
												d.name,
											)}"
											style="background:{categoryColor(
												vm.itemCategories[d.name],
											)}"
										>
											{d.percent}
											{d.name}
										</a>
									{/each}
								</div>
							{/if}
							{#if vm.highDrops.length > 0}
								<div class="drops-line">
									<strong>High:</strong>
									{#each vm.highDrops as d}
										<a
											class="item-chip"
											href="/items/{encodeURIComponent(
												d.name,
											)}"
											style="background:{categoryColor(
												vm.itemCategories[d.name],
											)}"
										>
											{d.percent}
											{d.name}
										</a>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</div>

		{#if vm.locations.length > 0}
			<div class="detail-section">
				<div class="section-title">Locations</div>
				<div class="table-scroll">
					<table class="data-table">
						<thead>
							<tr
								><th>Location</th><th>Level Range</th><th
									>Encounter Rate</th
								></tr
							>
						</thead>
						<tbody>
							{#each vm.locations as loc}
								<tr>
									<td>{loc.location}</td>
									<td>{loc.level_range ?? '—'}</td>
									<td>{loc.encounter_rate ?? '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		{#if vm.learnset.length > 0}
			<div class="detail-section">
				<div class="section-title">Learnset</div>
				<div class="table-scroll">
					<table class="data-table">
						<thead>
							<tr>
								<th>Lv</th><th>Move</th><th>Type</th><th
									>Category</th
								><th>Class</th>
								<th>Power</th><th>Acc</th><th>Max SP</th><th
									>Priority</th
								><th>PP</th>
							</tr>
						</thead>
						<tbody>
							{#each vm.learnset as mv}
								<tr>
									<td>{mv.level ?? '—'}</td>
									<td
										><a
											class="move-link"
											href="/skills/{encodeURIComponent(
												mv.name,
											)}">{mv.name}</a
										></td
									>
									<td>
										{#if mv.type}
											<span
												class="table-type-badge"
												style="background:{typeColor(
													mv.type,
												)}">{mv.type}</span
											>
										{:else}—{/if}
									</td>
									<td>{mv.category ?? '—'}</td>
									<td>{mv.class ?? '—'}</td>
									<td>{mv.power ?? '—'}</td>
									<td>{mv.accuracy ?? '—'}</td>
									<td>{mv.max_sp ?? '—'}</td>
									<td>{mv.priority ?? '—'}</td>
									<td>{mv.pp ?? '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		{#if vm.skillCards.length > 0}
			<div class="detail-section">
				<div class="section-title">Skill Cards</div>
				<div class="table-scroll">
					<table class="data-table">
						<thead>
							<tr>
								<th>SC</th><th>Move</th><th>Type</th><th
									>Category</th
								><th>Class</th>
								<th>Power</th><th>Acc</th><th>Max SP</th><th
									>Priority</th
								>
							</tr>
						</thead>
						<tbody>
							{#each vm.skillCards as sc}
								<tr>
									<td>{sc.sc ?? '—'}</td>
									<td
										><a
											class="move-link"
											href="/skills/{encodeURIComponent(
												sc.name,
											)}">{sc.name}</a
										></td
									>
									<td>
										{#if sc.type}
											<span
												class="table-type-badge"
												style="background:{typeColor(
													sc.type,
												)}">{sc.type}</span
											>
										{:else}—{/if}
									</td>
									<td>{sc.category ?? '—'}</td>
									<td>{sc.class ?? '—'}</td>
									<td>{sc.power ?? '—'}</td>
									<td>{sc.accuracy ?? '—'}</td>
									<td>{sc.max_sp ?? '—'}</td>
									<td>{sc.priority ?? '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	{/if}
</div>
