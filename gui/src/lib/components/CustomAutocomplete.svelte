<script lang="ts">
  let {
    options,
    value = $bindable(),
    placeholder = 'Any',
  }: {
    options: string[];
    value: string;
    placeholder?: string;
  } = $props();

  let open = $state(false);
  let root: HTMLDivElement;

  let matches = $derived(
    value
      ? options.filter((o) => o.toLowerCase().includes(value.toLowerCase())).slice(0, 50)
      : options.slice(0, 50)
  );

  function choose(v: string) {
    value = v;
    open = false;
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

<div class="custom-select" bind:this={root}>
  <input
    type="text"
    class="custom-select-trigger custom-autocomplete-input"
    {placeholder}
    bind:value
    onfocus={() => (open = true)}
  />
  {#if open && matches.length > 0}
    <ul class="custom-select-list">
      {#each matches as opt}
        <li>
          <button type="button" class:selected={value === opt} onclick={() => choose(opt)}>
            {opt}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
