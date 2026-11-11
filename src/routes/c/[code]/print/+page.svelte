<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types.js';
	let { data }: PageProps = $props();
</script>

<svelte:head><title>Do Now sheet</title></svelte:head>

{#if data.items.length === 0}
	<div class="page">
		<p>
			No Do Now yet. <a href={resolve('/c/[code]', { code: data.code })}>Generate one</a> first.
		</p>
	</div>
{:else}
	<div class="sheet">
		<header>
			<h1>Do Now</h1>
			<p>Name: ______________________ &nbsp; Date: ____________</p>
		</header>
		<ol>
			{#each data.items as it (it.n)}
				<li>
					<p class="q">{it.prompt}</p>
					<div class="lines"></div>
				</li>
			{/each}
		</ol>
	</div>
	<p class="noprint page"><button type="button" onclick={() => window.print()}>Print</button></p>
{/if}

<style>
	.sheet {
		max-width: 190mm;
		margin: 0 auto;
		padding: 10mm;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		border-bottom: 2px solid var(--ink);
		margin-bottom: 6mm;
	}
	ol {
		margin: 0;
		padding-left: 1.5em;
	}
	li {
		break-inside: avoid;
		margin-bottom: 5mm;
	}
	.q {
		margin: 0 0 2mm;
		font-size: 13pt;
	}
	.lines {
		height: 22mm;
		background-image: repeating-linear-gradient(
			to bottom,
			transparent 0,
			transparent 10mm,
			#999 10mm,
			#999 10.3mm
		);
	}
	@media print {
		.noprint {
			display: none;
		}
		.sheet {
			padding: 0;
			max-width: none;
		}
	}
	@page {
		size: A4;
		margin: 15mm;
	}
</style>
