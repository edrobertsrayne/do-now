<script lang="ts">
	import { CHIP_COLOURS, topicColour } from '#lib/palette.ts';
	import type { PageProps } from './$types.js';
	let { data, form }: PageProps = $props();

	let course = $state('');
	const selected = $derived(course || data.courses[0]?.id || '');

	const steps = [
		{
			title: 'Tick what you teach',
			text: 'Each skill joins the review schedule once it is taught.'
		},
		{
			title: 'Generate a Do Now',
			text: 'Four to six questions, spaced out over the lessons that follow.'
		},
		{
			title: 'Think, then check',
			text: 'Project it, run the timer, then reveal answers one at a time.'
		}
	];
	const stepColours = [topicColour(0), topicColour(1), topicColour(4)];
</script>

<svelte:head><title>Do Now</title></svelte:head>

<div class="page">
	<div class="wrap" style="max-width: 1080px; gap: 32px;">
		<header><span class="brand"><span class="logo">D</span>Do Now</span></header>

		<div class="hero">
			<div class="stripes" aria-hidden="true">
				{#each CHIP_COLOURS.slice(0, 5) as c (c)}<span style:background={c}></span>{/each}
			</div>
			<h1>Start every physics lesson with a Do Now.</h1>
			<p>
				Spaced retrieval from what you have already taught. No login: your class code is the key.
			</p>
		</div>

		<div class="forms">
			<form class="card create" method="POST" action="?/create">
				<h2>Create a new class</h2>
				<fieldset>
					<legend>Course</legend>
					{#each data.courses as c (c.id)}
						<label class="option" class:on={selected === c.id}>
							<input
								type="radio"
								name="course"
								value={c.id}
								checked={selected === c.id}
								onchange={() => (course = c.id)}
							/>
							<span class="name">{c.name}</span>
							<span class="meta">{c.topics} topics · {c.skills} skills</span>
						</label>
					{/each}
				</fieldset>
				<button class="btn" type="submit">Create class</button>
			</form>

			<form class="card open" method="POST" action="?/join">
				<h2>Open a class</h2>
				<label class="code">
					Class code
					<input
						name="code"
						value={form?.code ?? ''}
						autocomplete="off"
						autocapitalize="characters"
						spellcheck="false"
						required
					/>
				</label>
				{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
				<p class="note">
					Anyone with the code can edit the class, so share it only with colleagues.
				</p>
				<div class="grow"></div>
				<button class="btn ghost" type="submit">Open</button>
			</form>
		</div>

		<ol class="steps">
			{#each steps as s, i (s.title)}
				<li>
					<span class="n" style:background={stepColours[i]?.tint} style:color={stepColours[i]?.ink}
						>{i + 1}</span
					>
					<div>
						<div class="t">{s.title}</div>
						<div class="d">{s.text}</div>
					</div>
				</li>
			{/each}
		</ol>
	</div>
</div>

<style>
	.hero {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-width: 720px;
		padding-top: 24px;
	}
	.stripes {
		display: flex;
		gap: 6px;
	}
	.stripes span {
		width: 28px;
		height: 8px;
		border-radius: 999px;
	}
	h1 {
		margin: 0;
		font-size: clamp(32px, 5vw, 52px);
		line-height: 1.08;
		letter-spacing: -0.01em;
	}
	.hero p {
		margin: 0;
		font-size: 19px;
		line-height: 1.5;
		color: var(--ink-2);
	}
	.forms {
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
	}
	form.card {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 28px;
	}
	.create {
		flex: 3 1 420px;
	}
	.open {
		flex: 2 1 300px;
	}
	h2 {
		margin: 0;
		font-size: 22px;
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	legend {
		font-size: 14px;
		font-weight: 700;
		color: var(--muted);
		padding: 0 0 8px;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px;
		border-radius: 16px;
		border: 2px solid var(--line);
		font-weight: 700;
		font-size: 17px;
		cursor: pointer;
	}
	.option.on {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.option input {
		width: 20px;
		height: 20px;
		margin: 0;
		accent-color: var(--accent);
	}
	.option .name {
		flex-grow: 1;
	}
	.option .meta {
		font-size: 13px;
		color: var(--muted);
		text-align: right;
	}
	form .btn {
		align-self: flex-start;
		min-height: 52px;
		padding: 0 28px;
		font-size: 17px;
	}
	.code {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 14px;
		font-weight: 700;
		color: var(--muted);
	}
	.code input {
		font-weight: 800;
		font-size: 28px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--ink);
		padding: 14px 18px;
		border: 2px solid var(--line);
		border-radius: 16px;
		background: var(--field);
		min-width: 0;
	}
	.code input:focus {
		border-color: var(--accent);
		outline: none;
	}
	.note {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--muted);
	}
	.grow {
		flex-grow: 1;
	}
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 20px;
	}
	.steps li {
		display: flex;
		gap: 14px;
		align-items: flex-start;
	}
	.steps .n {
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-weight: 800;
	}
	.steps .t {
		font-weight: 800;
		font-size: 17px;
	}
	.steps .d {
		font-size: 15px;
		color: var(--muted);
		line-height: 1.45;
	}
</style>
