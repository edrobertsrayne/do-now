<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types.js';
	let { data }: PageProps = $props();
</script>

<svelte:head><title>Answer key · Do Now</title></svelte:head>

<div class="page">
	<div class="wrap" style="max-width: 880px;">
		<header class="top noprint">
			<a class="back" href={resolve('/c/[code]', { code: data.code })}>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"><path d="M15 18l-6-6 6-6"></path></svg
				>
				Class {data.code}
			</a>
			<div class="grow"></div>
			<span class="warn">
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
					><path
						d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"
					></path></svg
				>
				Teacher only: not for the projector
			</span>
			{#if data.items.length > 0}
				<button class="btn small" type="button" onclick={() => window.print()}>Print</button>
			{/if}
		</header>

		{#if data.items.length === 0}
			<div class="card">
				<p style="margin: 0;">
					No Do Now yet. <a href={resolve('/c/[code]', { code: data.code })}>Generate one</a> first.
				</p>
			</div>
		{:else}
			<div>
				<div class="eyebrow">Answer key · Do Now {data.lesson}</div>
				<h1>{data.title || 'Untitled lesson'}</h1>
			</div>

			<ol class="items">
				{#each data.items as it (it.n)}
					<li>
						<span class="num" style:background={it.chip}>{it.n}</span>
						<div class="body">
							<div class="meta">
								<span>{it.topic}</span>
								<span>{it.skill}</span>
								<span>{it.specRefs.join(', ')}</span>
								{#if it.reason !== 'due'}<span class="tag">{it.reason}</span>{/if}
								{#if it.status === 'draft'}<span class="tag">draft</span>{/if}
							</div>
							<div class="q">{it.prompt}</div>
							<div class="a" style:background={it.tint}>{it.answer}</div>
						</div>
					</li>
				{/each}
			</ol>
			<p class="muted foot">Questions marked draft have not been reviewed.</p>
		{/if}
	</div>
</div>

<style>
	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}
	.grow {
		flex-grow: 1;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 16px 0 12px;
		border-radius: 999px;
		background: var(--surface);
		font-weight: 800;
		font-size: 15px;
		text-decoration: none;
	}
	.warn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		font-weight: 800;
		color: #8c3b17;
		background: #fde9e0;
		padding: 10px 14px;
		border-radius: 999px;
	}
	.eyebrow {
		font-size: 14px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
	}
	h1 {
		margin: 6px 0 0;
		font-size: 34px;
		line-height: 1.15;
	}
	.items {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.items li {
		background: var(--surface);
		border-radius: var(--r-card);
		padding: 20px 22px;
		display: flex;
		gap: 16px;
		align-items: flex-start;
		break-inside: avoid;
	}
	.num {
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-weight: 800;
		font-size: 16px;
	}
	.body {
		flex-grow: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		font-size: 13px;
		font-weight: 700;
		color: var(--muted);
	}
	.tag {
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: 11px;
		font-weight: 800;
		color: var(--accent-deep);
		background: var(--accent-soft);
		padding: 1px 8px;
		border-radius: 999px;
	}
	.q {
		font-size: 18px;
		font-weight: 700;
		line-height: 1.4;
	}
	.a {
		font-size: 17px;
		font-weight: 600;
		line-height: 1.45;
		padding: 12px 16px;
		border-radius: var(--r-row);
	}
	.foot {
		margin: 0;
		font-size: 14px;
	}
	@media print {
		.page {
			padding: 0;
		}
		.items li {
			border: 1.5px solid var(--line-2);
		}
		* {
			print-color-adjust: exact;
			-webkit-print-color-adjust: exact;
		}
	}
</style>
