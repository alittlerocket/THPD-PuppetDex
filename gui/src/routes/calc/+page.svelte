<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		createCalcViewModel,
		WEATHERS,
		TERRAINS,
		NATURES,
		MAX_PP_PER_STAT,
		MAX_PP_TOTAL,
		MIN_BOOST,
		MAX_BOOST,
	} from '$lib/viewmodels/calc.svelte';
	import CustomAutocomplete from '$lib/components/CustomAutocomplete.svelte';
	import { CALC_STAT_LABELS } from '$lib/calc/types';
	import { typeColor } from '$lib/utils/typeColors';
	import '../../styles/global.css';
	import '../../styles/calc.css';

	const vm = createCalcViewModel();

	onMount(() => vm.init());
</script>

<div class="calc-page">
	<div class="calc-header">
		<button class="back" onclick={() => goto('/')}>Back</button>
		<div class="calc-header-actions">
			<button class="calc-btn" onclick={() => vm.swap()}
				>Swap Sides</button
			>
			<button class="calc-btn" onclick={() => vm.reset()}>Reset</button>
		</div>
	</div>

	{#if vm.loading}
		<div class="calc-status">
			<img src="/funky-cirno.gif" alt="Loading" class="loading-gif" />
		</div>
	{:else if vm.error}
		<p class="calc-status error">{vm.error}</p>
	{:else}
		<div class="calc-grid">
			{#each [{ side: vm.attacker, row: vm.attackerRow, label: 'Attacker', ppTotal: vm.attackerPpTotal, setPuppet: (n: string) => vm.setAttackerPuppet(n) }, { side: vm.defender, row: vm.defenderRow, label: 'Defender', ppTotal: vm.defenderPpTotal, setPuppet: (n: string) => vm.setDefenderPuppet(n) }] as pane}
				<div class="calc-pane">
					<div class="pane-title">{pane.label}</div>

					<div class="field">
						<label for="{pane.label}-puppet">Puppet</label>
						<CustomAutocomplete
							options={vm.puppetNames}
							bind:value={pane.side.name}
							onchange={pane.setPuppet}
							placeholder="Type to search..."
						/>
					</div>

					{#if pane.row}
						<div class="pane-types">
							<span
								class="type-badge"
								style="background:{typeColor(pane.row.type1)}"
								>{pane.row.type1}</span
							>
							{#if pane.row.type2}
								<span
									class="type-badge"
									style="background:{typeColor(
										pane.row.type2,
									)}">{pane.row.type2}</span
								>
							{/if}
							<span class="pane-cost">Cost {pane.row.cost}</span>
						</div>
					{/if}

					<div class="field-row">
						<div class="field">
							<label for="{pane.label}-level">Level</label>
							<input
								type="number"
								min="1"
								max="100"
								bind:value={pane.side.level}
							/>
						</div>
						<div class="field">
							<label for="{pane.label}-hp">HP %</label>
							<input
								type="number"
								min="0"
								max="100"
								bind:value={pane.side.hpPercent}
							/>
						</div>
					</div>

					<div class="field">
						<label for="{pane.label}-nature">Nature</label>
						<CustomAutocomplete
							options={vm.natureLabels}
							value={vm.natureLabel(pane.side.mark)}
							onchange={(label) =>
								(pane.side.mark = vm.natureValue(label))}
							placeholder="None"
						/>
					</div>

					<div class="field">
						<label for="{pane.label}-ability">Ability</label>
						<CustomAutocomplete
							options={vm.abilityOptions}
							bind:value={pane.side.ability}
							placeholder="None"
						/>
					</div>

					<div class="field">
						<label for="{pane.label}-item">Item</label>
						<CustomAutocomplete
							options={vm.itemOptions}
							bind:value={pane.side.item}
						/>
					</div>

					<div class="field-row">
						{#each [0, 1] as slot}
							<div class="field">
								<label for="{pane.label}-status{slot}"
									>Status {slot + 1}</label
								>
								<CustomAutocomplete
									options={vm.statusLabels}
									value={vm.statusLabel(
										pane.side.status[slot],
									)}
									onchange={(label) =>
										(pane.side.status[slot] =
											vm.statusValue(label))}
								/>
							</div>
						{/each}
					</div>

					<div class="stat-inputs">
						<div class="stat-input-head">
							<span></span>
							<span>PP</span>
							<span>Boost</span>
						</div>

						<div class="stat-input-row">
							<span class="stat-input-label">HP</span>
							<input
								type="number"
								min="0"
								max={MAX_PP_PER_STAT}
								bind:value={pane.side.pp.hp}
							/>
							<span class="stat-input-na">—</span>
						</div>

						{#each vm.statKeys as key}
							<div class="stat-input-row">
								<span class="stat-input-label"
									>{CALC_STAT_LABELS[key]}</span
								>
								<input
									type="number"
									min="0"
									max={MAX_PP_PER_STAT}
									bind:value={pane.side.pp[key]}
								/>
								<input
									type="number"
									min={MIN_BOOST}
									max={MAX_BOOST}
									bind:value={pane.side.boosts[key]}
								/>
							</div>
						{/each}

						<div
							class="pp-summary"
							class:over={pane.ppTotal > MAX_PP_TOTAL}
						>
							<span>PP used {pane.ppTotal} / {MAX_PP_TOTAL}</span>
							<span class="pp-hint"
								>max {MAX_PP_PER_STAT} per stat · boosts {MIN_BOOST}
								to +{MAX_BOOST}</span
							>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<div class="calc-controls">
			<div class="field field-move">
				<label for="move">Move</label>
				<CustomAutocomplete
					options={vm.moveNames}
					bind:value={vm.moveName}
					placeholder="Type to search..."
				/>
			</div>
			<div class="field">
				<label for="weather">Weather</label>
				<CustomAutocomplete
					options={WEATHERS}
					bind:value={vm.weather}
					placeholder="None"
				/>
			</div>
			<div class="field">
				<label for="terrain">Terrain</label>
				<CustomAutocomplete
					options={TERRAINS}
					bind:value={vm.terrain}
					placeholder="None"
				/>
			</div>
			<div class="field">
				<label for="crit">Modifiers</label>
				<button
					type="button"
					class="toggle-pill"
					class:on={vm.isCrit}
					aria-pressed={vm.isCrit}
					onclick={() => (vm.isCrit = !vm.isCrit)}
				>
					<span class="toggle-dot"></span>
					Critical hit
				</button>
			</div>
		</div>

		{#if vm.result}
			<div class="calc-result">
				<div class="result-headline">
					{vm.result.minDamage}–{vm.result.maxDamage}
					<span class="result-percent"
						>({vm.result.minPercent}% – {vm.result
							.maxPercent}%)</span
					>
				</div>
				<div class="result-ko">
					{#if vm.result.koHits === null}
						Cannot KO
					{:else}
						{vm.result.koHits} hit{vm.result.koHits === 1
							? ''
							: 's'} to KO
						<span class="result-hp"
							>· defender max HP {vm.result.defenderMaxHP}</span
						>
					{/if}
				</div>
				<p class="result-description">{vm.result.description}</p>
				<div class="result-rolls">
					{#each vm.result.damage as roll}<span class="roll"
							>{roll}</span
						>{/each}
				</div>
			</div>
		{:else}
			<p class="calc-status">
				Pick two puppets and a move to see damage.
			</p>
		{/if}

		<p class="calc-credit">
			Damage engine ported from
			<a href="https://github.com/Gengetsu12/tpdpextcalc">tpdpextcalc</a>
			-- MIT Licensed (2013-2018).
		</p>
	{/if}
</div>
