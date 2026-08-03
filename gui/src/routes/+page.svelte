<script lang="ts">
	import { goto } from '$app/navigation';
	import '../styles/global.css';
	import '../styles/home.css';
</script>

<div class="screen">
	<div class="sprites-container">
		<img
			src="/sprites/Shard of Dreams - Extended - Teireida.gif"
			alt="Teireida"
			class="sprite-img"
		/>
		<h1 class="title">Puppetdex</h1>
		<img
			src="/sprites/Shard of Dreams - Extended - Satono.gif"
			alt="Satono"
			class="sprite-img"
		/>
	</div>

	<div class="button-group">
		<button class="btn" onclick={() => goto('/dex')}>Dex</button>
		<button class="btn" onclick={() => goto('/calc')}>Calculator</button>
		<button class="btn" onclick={() => goto('/settings')}>Settings</button>
	</div>
</div>
