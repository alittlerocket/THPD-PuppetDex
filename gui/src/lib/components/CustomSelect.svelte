<script lang="ts">
  let {
    options,
    value = $bindable(),
    placeholder = 'Any',
  }: {
    options: { value: string; label: string }[];
    value: string;
    placeholder?: string;
  } = $props();

  let open = $state(false);
  let root: HTMLDivElement;

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

  let selectedLabel = $derived(
    options.find((o) => o.value === value)?.label ?? placeholder
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
    <svg width="12" height="8" viewBox="0 0 12 8"><path fill="currentColor" d="M1 1l5 5 5-5" /></svg>
  </button>
  {#if open}
    <ul class="custom-select-list">
      <li>
        <button type="button" class:selected={!value} onclick={() => choose('')}>{placeholder}</button>
      </li>
      {#each options as opt}
        <li>
          <button type="button" class:selected={value === opt.value} onclick={() => choose(opt.value)}>
            {opt.label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
