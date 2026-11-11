<script lang="ts">
	let { form } = $props();
</script>

<svelte:head><title>Retrieval Do Now</title></svelte:head>

<div class="page">
	<h1>Retrieval Do Now</h1>
	<p class="muted">Spaced retrieval for AQA GCSE Physics. No login: your class code is the key.</p>

	<form method="POST" action="?/create">
		<button type="submit">Create a new class</button>
	</form>

	<h2>Open an existing class</h2>
	<form method="POST" action="?/join">
		<label>
			Class code
			<input name="code" value={form?.code ?? ''} autocomplete="off" autocapitalize="characters" required />
		</label>
		<button type="submit">Open</button>
		{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
	</form>
</div>
