<script lang="ts">
  import { page } from '$app/state';
  import { createSkillDetailViewModel } from '$lib/viewmodels/skillDetail.svelte';
  import { typeColor } from '$lib/utils/typeColors';
  import '../../../styles/global.css';
  import '../../../styles/ref-detail.css';

  const vm = createSkillDetailViewModel();

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
  {:else}
    {#each vm.rows as skill}
      <div class="ref-card">
        <div class="ref-card-header">
          {#if skill.type}
            <span class="ref-badge" style="background:{typeColor(skill.type)}">{skill.type}</span>
          {/if}
          {#if skill.category}<span class="ref-badge" style="background:#444">{skill.category}</span>{/if}
          {#if skill.class}<span class="ref-badge" style="background:#333">{skill.class}</span>{/if}
          {#if skill.is_mod}<span class="ref-mod-tag">{skill.mod_tab ?? 'Modded'}</span>{/if}
        </div>
        {#if skill.jp_name}<div class="ref-jp-name">{skill.jp_name}</div>{/if}
        <div class="ref-stat-grid">
          <div>Power<strong>{skill.power ?? '—'}</strong></div>
          <div>Accuracy<strong>{skill.accuracy ?? '—'}</strong></div>
          <div>Max SP<strong>{skill.max_sp ?? '—'}</strong></div>
          <div>Priority<strong>{skill.priority ?? '—'}</strong></div>
        </div>
        {#if skill.description}
          <p class="ref-description">{skill.description}</p>
        {/if}
      </div>
    {/each}
  {/if}
</div>
