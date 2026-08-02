<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { createDexListViewModel } from '$lib/viewmodels/dexList.svelte';
  import { typeColor } from '$lib/utils/typeColors';
  import { STYLES } from '$lib/utils/styleUtils';
  import CustomSelect from '$lib/components/CustomSelect.svelte';
  import CustomAutocomplete from '$lib/components/CustomAutocomplete.svelte';
  import '../../styles/global.css';
  import '../../styles/dex.css';

  const vm = createDexListViewModel();

  onMount(() => vm.init());
</script>

<div class="dex-page">
  <div class="dex-header">
    <button class="back" onclick={() => goto('/')}>Back</button>
    <input
      class="search-input"
      type="search"
      placeholder="Search by name..."
      bind:value={vm.search}
    />
    <button class="toggle-filters" onclick={() => vm.toggleFilters()}>
      {vm.showFilters ? 'Hide Filters' : 'Advanced Filters'}
    </button>
    {#if !vm.loading && !vm.error}
      <span class="result-count">{vm.filtered.length} / {vm.puppets.length}</span>
    {/if}
  </div>

  {#if vm.showFilters}
    <div class="filter-panel">
      <div class="filter-section">
        <h3>Stats</h3>
        <div class="stat-row">
          <label for="hpMin">HP</label>
          <input id="hpMin" type="number" placeholder="min" bind:value={vm.filters.hpMin} />
          <input type="number" placeholder="max" bind:value={vm.filters.hpMax} />
        </div>
        <div class="stat-row">
          <label for="foAtkMin">Fo.Atk</label>
          <input id="foAtkMin" type="number" placeholder="min" bind:value={vm.filters.foAtkMin} />
          <input type="number" placeholder="max" bind:value={vm.filters.foAtkMax} />
        </div>
        <div class="stat-row">
          <label for="foDefMin">Fo.Def</label>
          <input id="foDefMin" type="number" placeholder="min" bind:value={vm.filters.foDefMin} />
          <input type="number" placeholder="max" bind:value={vm.filters.foDefMax} />
        </div>
        <div class="stat-row">
          <label for="spAtkMin">Sp.Atk</label>
          <input id="spAtkMin" type="number" placeholder="min" bind:value={vm.filters.spAtkMin} />
          <input type="number" placeholder="max" bind:value={vm.filters.spAtkMax} />
        </div>
        <div class="stat-row">
          <label for="spDefMin">Sp.Def</label>
          <input id="spDefMin" type="number" placeholder="min" bind:value={vm.filters.spDefMin} />
          <input type="number" placeholder="max" bind:value={vm.filters.spDefMax} />
        </div>
        <div class="stat-row">
          <label for="spdMin">Spd</label>
          <input id="spdMin" type="number" placeholder="min" bind:value={vm.filters.spdMin} />
          <input type="number" placeholder="max" bind:value={vm.filters.spdMax} />
        </div>
        <div class="stat-row">
          <label for="bstMin">BST</label>
          <input id="bstMin" type="number" placeholder="min" bind:value={vm.filters.bstMin} />
          <input type="number" placeholder="max" bind:value={vm.filters.bstMax} />
        </div>
      </div>

      <div class="filter-section">
        <h3>Other Filters</h3>
        <div class="filter-grid">
          <div class="filter-field range">
            <div>
              <label for="costMin">Cost min</label>
              <input id="costMin" type="number" bind:value={vm.filters.costMin} />
            </div>
            <div>
              <label for="costMax">Cost max</label>
              <input id="costMax" type="number" bind:value={vm.filters.costMax} />
            </div>
          </div>

          <div class="filter-field">
            <label for="ability">Ability</label>
            <CustomAutocomplete options={vm.abilityOptions} bind:value={vm.filters.ability} />
          </div>

          <div class="filter-field">
            <label for="isMod">Modded</label>
            <CustomSelect
              options={[
                { value: 'all', label: 'All' },
                { value: 'official', label: 'Official Only' },
                { value: 'modded', label: 'Modded Only' },
              ]}
              bind:value={vm.filters.isMod}
              placeholder="All"
            />
          </div>

          <div class="filter-field">
            <label for="location">Location</label>
            <CustomSelect
              options={vm.locationOptions.map((loc) => ({ value: loc, label: loc }))}
              bind:value={vm.filters.location}
            />
          </div>

          <div class="filter-field">
            <label for="move">Can Learn Move</label>
            <CustomAutocomplete options={vm.moveOptions} bind:value={vm.filters.move} />
          </div>

          <div class="filter-field">
            <label for="type">Type</label>
            <CustomSelect
              options={vm.typeOptions.map((t) => ({ value: t, label: t }))}
              bind:value={vm.filters.type}
            />
          </div>

          <div class="filter-field">
            <label for="style">Style</label>
            <CustomSelect
              options={STYLES.map((s) => ({ value: s, label: s }))}
              bind:value={vm.filters.style}
            />
          </div>
        </div>
      </div>

      <div class="filter-actions">
        <button class="reset-btn" onclick={() => vm.resetFilters()}>Reset</button>
        <button class="apply-btn" onclick={() => vm.applyFilters()}>Apply</button>
      </div>
    </div>
  {/if}

  {#if vm.loading}
    <div class="status">
      <img src="/funky-cirno.gif" alt="Loading" class="loading-gif" />
      <div>Funkily Loading...</div>
    </div>
  {:else if vm.error}
    <p class="status error">{vm.error}</p>
  {:else}
    <div class="puppet-grid">
      {#each vm.filtered as puppet (puppet.rowid)}
        <a class="puppet-card" href="/dex/{puppet.rowid}">
          {#if puppet.sprite_normal}
            <img src="/sprites/{puppet.sprite_normal}" alt={puppet.name} loading="lazy" />
          {:else}
            <div class="no-sprite">?</div>
          {/if}
          <span class="puppet-name">{puppet.name}</span>
          <div class="puppet-types">
            {#if puppet.type1}
              <span class="type-badge" style="background:{typeColor(puppet.type1)}">{puppet.type1}</span>
            {/if}
            {#if puppet.type2}
              <span class="type-badge" style="background:{typeColor(puppet.type2)}">{puppet.type2}</span>
            {/if}
          </div>
          <div class="puppet-meta">
            {#if puppet.bst}<span>BST {puppet.bst}</span>{/if}
            {#if puppet.cost}<span>Cost {puppet.cost}</span>{/if}
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
