<script lang="ts">
	let { src, alt = '' }: { src: string; alt?: string } = $props();

	let scanning = $state(false);
	let hasAnimated = false;

	$effect(() => {
		src;
		if (!hasAnimated) {
			hasAnimated = true;
			scanning = false;
			let raf2 = 0;
			let timeout = 0;
			const raf1 = requestAnimationFrame(() => {
				raf2 = requestAnimationFrame(() => {
					timeout = setTimeout(() => {
						scanning = true;
					}, 500);
				});
			});
			return () => {
				cancelAnimationFrame(raf1);
				cancelAnimationFrame(raf2);
				clearTimeout(timeout);
			};
		}
	});
</script>

<div class="sprite-reveal-wrapper">
	<div class="sprite-reveal">
		<img class="sprite-reveal-color" {src} {alt} />
		<img class="sprite-reveal-silhouette" class:scanning {src} alt="" />
	</div>
</div>

<style>
	.sprite-reveal-wrapper {
		display: inline-block;
		padding: 1rem;
	}

	.sprite-reveal {
		position: relative;
		display: inline-block;
		line-height: 0;
		overflow: hidden;
	}

	.sprite-reveal-color {
		display: block;
		image-rendering: pixelated;
	}

	.sprite-reveal-silhouette {
		position: absolute;
		inset: 0;
		display: block;
		image-rendering: pixelated;
		filter: brightness(0) invert(1)
			drop-shadow(0 0 3px rgba(255, 20, 147, 0.9))
			drop-shadow(0 0 1px rgba(255, 20, 147, 0.5));
		clip-path: inset(0 0 0 0);
		transition: clip-path 1.1s linear;
	}

	.sprite-reveal-silhouette.scanning {
		clip-path: inset(100% 0 0 0);
	}
</style>
