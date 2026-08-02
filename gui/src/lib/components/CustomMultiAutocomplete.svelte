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
  let matches = $derived(
    options
      .filter((o) => !values.includes(o))
      .filter((o) => !query || o.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 50)
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
            <button type="button" onclick={() => add(opt)}>{opt}</button>
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
          <button type="button" class="multi-chip-x" title="Remove" onclick={() => remove(v)}>×</button>
        </span>
      {/each}
    </div>
  {/if}
</div>
