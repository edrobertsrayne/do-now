<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const groups = $derived.by(() => {
		const byTopic = new Map<string, typeof data.skills>();
		for (const skill of data.skills) {
			byTopic.set(skill.topic, [...(byTopic.get(skill.topic) ?? []), skill]);
		}
		return [...byTopic];
	});
	const taughtCount = $derived(data.skills.filter((s: { taught: boolean }) => s.taught).length);
</script>

<svelte:head><title>Class {data.code}</title></svelte:head>

<div class="page">
	<h1>Class <code>{data.code}</code></h1>
	<p class="muted">
		Anyone with this code or link can edit this class. Bookmark this page. {data.lesson} Do Now{data.lesson === 1 ? '' : 's'}
		generated so far.
	</p>

	{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}

	<section>
		<h2>Do Now</h2>
		<form method="POST" action="?/size" use:enhance class="row">
			<label>
				Questions
				<select name="size" value={String(data.size)} onchange={(e) => e.currentTarget.form?.requestSubmit()}>
					{#each [4, 5, 6] as n}<option value={String(n)}>{n}</option>{/each}
				</select>
			</label>
			<noscript><button type="submit">Set</button></noscript>
		</form>
		<form method="POST" action="?/generate" use:enhance class="row">
			<button type="submit" disabled={taughtCount === 0}>Generate next Do Now</button>
		</form>
		{#if data.doNowLesson !== null}
			<p>
				Do Now {data.doNowLesson}:
				<a class="btn" href="/c/{data.code}/project">Projector</a>
				<a class="btn secondary" href="/c/{data.code}/print">Print sheet</a>
				<a class="btn secondary" href="/c/{data.code}/key">Answer key (teacher)</a>
			</p>
		{/if}
	</section>

	<section>
		<h2>Skills taught</h2>
		<p class="muted">Tick a skill when you teach it. Unticking resets its schedule.</p>
		{#each groups as [topic, skills]}
			<h3>{topic}</h3>
			<ul class="skills">
				{#each skills as skill (skill.id)}
					<li>
						<form method="POST" action="?/toggle" use:enhance>
							<input type="hidden" name="skill" value={skill.id} />
							<input type="hidden" name="taught" value={skill.taught ? '0' : '1'} />
							<label>
								<input
									type="checkbox"
									checked={skill.taught}
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
								/>
								{skill.title}
							</label>
							<span class="muted">
								{skill.specRefs.join(', ')}
								{#if skill.taught}· practised {skill.practices}×{/if}
							</span>
							<noscript><button type="submit">{skill.taught ? 'Untick' : 'Tick'}</button></noscript>
						</form>
					</li>
				{/each}
			</ul>
		{/each}
	</section>
</div>

<style>
	.row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 0.75rem;
	}
	.skills {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.skills li {
		padding: 0.25rem 0;
		border-bottom: 1px solid var(--rule);
	}
	.skills input[type='checkbox'] {
		width: 1.1rem;
		height: 1.1rem;
		margin-right: 0.4rem;
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
