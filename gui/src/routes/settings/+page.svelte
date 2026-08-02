<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { createSettingsViewModel } from '$lib/viewmodels/settings.svelte';
  import { PAGE_SIZE_OPTIONS } from '$lib/types/settings';
  import CustomSelect from '$lib/components/CustomSelect.svelte';
  import '../../styles/global.css';
  import '../../styles/page.css';

  const vm = createSettingsViewModel();

  onMount(() => vm.load());
</script>

<div class="page">
  <button class="back" onclick={() => goto('/')}>Back</button>
  <h1 class="title">Settings</h1>

  <div class="settings-panel">
    <div class="settings-row">
      <div class="settings-label">
        <span class="settings-name">Puppets per page</span>
        <span class="settings-hint">
          How many puppets the dex renders at once. Smaller pages draw fewer
          animated sprites, which keeps the list lighter on large result sets.
        </span>
      </div>
      <div class="settings-control">
        <CustomSelect options={PAGE_SIZE_OPTIONS} bind:value={vm.pageSize} clearable={false} />
      </div>
    </div>

    <div class="settings-status" class:visible={vm.saved}>Saved</div>
  </div>
</div>
