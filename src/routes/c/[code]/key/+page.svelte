<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Answer key</title></svelte:head>

<div class="page">
	<h1>Answer key (teacher only)</h1>
	{#if data.items.length === 0}
		<p>No Do Now yet. <a href="/c/{data.code}">Generate one</a> first.</p>
	{:else}
		<p class="muted">Do Now {data.lesson}. Questions marked draft have not been reviewed.</p>
		<table>
			<thead>
				<tr><th>#</th><th>Question</th><th>Answer</th><th>Skill</th></tr>
			</thead>
			<tbody>
				{#each data.items as it (it.n)}
					<tr>
						<td>{it.n}</td>
						<td>{it.prompt}</td>
						<td><strong>{it.answer}</strong></td>
						<td class="muted">
							{it.skill} ({it.topic}; {it.specRefs.join(', ')})
							{#if it.reason !== 'due'} · {it.reason}{/if}
							{#if it.status === 'draft'} · draft{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p><button type="button" onclick={() => window.print()}>Print</button></p>
	{/if}
</div>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		text-align: left;
		vertical-align: top;
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid var(--rule);
	}
	@media print {
		button {
			display: none;
		}
	}
</style>
