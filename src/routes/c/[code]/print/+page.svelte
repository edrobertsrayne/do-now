<script lang="ts">
	import { resolve } from '$app/paths';
	import { SECONDS_PER_QUESTION } from '#lib/timing.ts';
	import type { PageProps } from './$types.js';
	let { data }: PageProps = $props();

	const minutes = $derived(Math.round((data.items.length * SECONDS_PER_QUESTION) / 60));
</script>

<svelte:head><title>Do Now sheet</title></svelte:head>

{#if data.items.length === 0}
	<div class="page">
		<div class="card empty">
			<p style="margin: 0;">
				No Do Now yet. <a href={resolve('/c/[code]', { code: data.code })}>Generate one</a> first.
			</p>
		</div>
	</div>
{:else}
	<div class="toolbar noprint">
		<a class="btn ghost small" href={resolve('/c/[code]', { code: data.code })}>Back to class</a>
		<button class="btn small" type="button" onclick={() => window.print()}>Print</button>
	</div>
	<article class="sheet">
		<header>
			<div class="titles">
				<span class="badge">Do Now</span>
				{#if data.title}<span class="title">{data.title}</span>{/if}
				<span class="grow"></span>
				<span class="mins">{minutes} minute{minutes === 1 ? '' : 's'}</span>
			</div>
			<div class="fields">
				<span class="f name">Name <span class="line"></span></span>
				<span class="f date">Date <span class="line"></span></span>
			</div>
		</header>

		<ol>
			{#each data.items as it (it.n)}
				<li>
					<span class="num">{it.n}</span>
					<div class="body">
						<p class="q">{it.prompt}</p>
						<div class="write"></div>
						<div class="write"></div>
					</div>
				</li>
			{/each}
		</ol>

		<span class="grow"></span>
		<footer>
			<span>Do Now {data.lesson} · Class {data.code}</span>
			<span>Mark it in another colour when we check.</span>
		</footer>
	</article>
{/if}

<style>
	.toolbar {
		display: flex;
		justify-content: center;
		gap: 10px;
		padding: 20px 16px 0;
	}
	.sheet {
		width: 210mm;
		max-width: calc(100% - 32px);
		min-height: 297mm;
		margin: 20px auto 40px;
		background: #fff;
		color: var(--ink);
		padding: 15mm 16mm 13mm;
		display: flex;
		flex-direction: column;
		gap: 7mm;
		border-radius: 8px;
		box-shadow: 0 1px 2px rgba(35, 32, 58, 0.08);
	}
	header {
		display: flex;
		flex-direction: column;
		gap: 5mm;
	}
	.titles {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.badge {
		font-weight: 800;
		font-size: 24px;
		border: 2.5px solid var(--ink);
		padding: 2px 16px;
		border-radius: 999px;
		white-space: nowrap;
	}
	.title {
		font-weight: 800;
		font-size: 22px;
		line-height: 1.2;
	}
	.grow {
		flex-grow: 1;
	}
	.mins {
		font-weight: 700;
		font-size: 14px;
		color: var(--ink-2);
		white-space: nowrap;
	}
	.fields {
		display: flex;
		gap: 24px;
		font-size: 15px;
		font-weight: 700;
	}
	.f {
		display: flex;
		gap: 8px;
		align-items: flex-end;
	}
	.f.name {
		flex: 2;
	}
	.f.date {
		flex: 1;
	}
	.line {
		flex-grow: 1;
		border-bottom: 1.5px solid var(--ink);
		height: 18px;
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6mm;
	}
	li {
		display: flex;
		gap: 16px;
		align-items: flex-start;
		border: 1.5px solid var(--line-2);
		border-radius: 18px;
		padding: 16px 20px 12px;
		break-inside: avoid;
	}
	.num {
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		border-radius: 50%;
		border: 2.5px solid var(--ink);
		display: grid;
		place-items: center;
		font-weight: 800;
		font-size: 16px;
	}
	.body {
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.q {
		margin: 0;
		font-size: 17px;
		font-weight: 700;
		line-height: 1.35;
		padding-top: 4px;
	}
	.write {
		height: 36px;
		border-bottom: 1px solid #9c97b3;
	}
	footer {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 12px;
		font-weight: 700;
		color: var(--ink-2);
		border-top: 1px solid var(--line-2);
		padding-top: 10px;
	}
	@media print {
		.sheet {
			width: auto;
			max-width: none;
			min-height: calc(297mm - 24mm);
			margin: 0;
			padding: 0;
			box-shadow: none;
			border-radius: 0;
		}
	}
	@page {
		size: A4;
		margin: 12mm 14mm;
	}
</style>
