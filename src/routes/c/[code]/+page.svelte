<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	import type { PageProps } from './$types.js';

	let { data, form }: PageProps = $props();

	const taughtIn = (topic: string) =>
		data.skills.filter((s) => s.topic === topic && s.taught).length;
	const totalIn = (topic: string) => data.skills.filter((s) => s.topic === topic).length;
	const taughtCount = $derived(data.skills.filter((s) => s.taught).length);

	let picked = $state('');
	const topic = $derived(data.topics.find((t) => t.name === picked) ?? data.topics[0]);
	const skills = $derived(data.skills.filter((s) => s.topic === topic?.name));
	const topicTaught = $derived(skills.filter((s) => s.taught).length);

	let copied = $state(false);
	async function copyLink() {
		try {
			await navigator.clipboard.writeText(page.url.origin + page.url.pathname);
			copied = true;
			setTimeout(() => (copied = false), 1800);
		} catch {
			/* Clipboard blocked: the address bar still has the link. */
		}
	}
</script>

<svelte:head><title>Class {data.code} · Do Now</title></svelte:head>

<div class="page">
	<div class="wrap" style="max-width: 1240px;">
		<header class="top">
			<a class="brand" href={resolve('/')}><span class="logo">D</span>Do Now</a>
			<span class="course">{data.course}</span>
			<div class="grow"></div>
			<span class="code" title="Anyone with this code can edit the class">{data.code}</span>
			<button class="btn ghost small" type="button" onclick={copyLink} aria-live="polite"
				>{copied ? 'Link copied' : 'Copy link'}</button
			>
		</header>

		{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}

		<div class="cols">
			<nav class="card topics" aria-label="Topics">
				<span class="label">Topics</span>
				{#each data.topics as t (t.name)}
					<button
						type="button"
						class="topic"
						class:on={t.name === topic?.name}
						aria-current={t.name === topic?.name ? 'true' : undefined}
						onclick={() => (picked = t.name)}
					>
						<span class="dot" style:background={t.dot}></span>
						<span class="name">{t.name}</span>
						<span class="count">{taughtIn(t.name)}/{totalIn(t.name)}</span>
					</button>
				{/each}
			</nav>

			{#if topic}
				<section class="card skills" aria-labelledby="topic-heading">
					<div class="head">
						<span class="dot big" style:background={topic.dot}></span>
						<h2 id="topic-heading">{topic.name}</h2>
						<span class="summary">{topicTaught} of {skills.length} taught</span>
					</div>
					<div class="bar" aria-hidden="true">
						<div
							style:width="{skills.length ? (100 * topicTaught) / skills.length : 0}%"
							style:background={topic.dot}
						></div>
					</div>
					<p class="hint">Tick a skill when you teach it. Unticking resets its schedule.</p>
					<ul>
						{#each skills as skill (skill.id)}
							<li>
								<form method="POST" action="?/toggle" use:enhance>
									<input type="hidden" name="skill" value={skill.id} />
									<input type="hidden" name="taught" value={skill.taught ? '0' : '1'} />
									<label class="skill" style:background={skill.taught ? topic.tint : undefined}>
										<input
											type="checkbox"
											checked={skill.taught}
											onchange={(e) => e.currentTarget.form?.requestSubmit()}
										/>
										<span class="title">{skill.title}</span>
										<span class="spec">{skill.specRefs.join(', ')}</span>
										<span class="reps" title="Times practised"
											>{skill.taught ? `${skill.practices}×` : ''}</span
										>
									</label>
									<noscript
										><button class="btn ghost small" type="submit"
											>{skill.taught ? 'Untick' : 'Tick'}</button
										></noscript
									>
								</form>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section class="card gen" aria-labelledby="donow-heading">
				<div class="row between">
					<span class="eyebrow">Next Do Now · Lesson {data.lesson + 1}</span>
					<span class="mix">{taughtCount} skill{taughtCount === 1 ? '' : 's'} in the mix</span>
				</div>

				<form id="generate" method="POST" action="?/generate" use:enhance></form>
				<label class="title-field">
					Lesson title
					<input
						form="generate"
						type="text"
						name="title"
						maxlength="120"
						placeholder="e.g. Forces and motion"
					/>
				</label>

				<div class="row wrap-row">
					<form class="sizes" method="POST" action="?/size" use:enhance>
						<span class="sizes-label" id="sizes-label">Questions</span>
						<div role="group" aria-labelledby="sizes-label" class="sizes-group">
							{#each [4, 5, 6] as n (n)}
								<button
									type="submit"
									name="size"
									value={String(n)}
									class="size"
									class:on={data.size === n}
									aria-pressed={data.size === n}>{n}</button
								>
							{/each}
						</div>
					</form>
					<div class="grow"></div>
					<button class="btn light" type="submit" form="generate" disabled={taughtCount === 0}
						>Generate</button
					>
				</div>
				{#if taughtCount === 0}
					<p class="sub">Tick at least one skill you have taught to generate a Do Now.</p>
				{/if}

				<div class="rule"></div>

				{#if data.doNowLesson !== null}
					<div class="row between baseline">
						<h2 id="donow-heading">Do Now {data.doNowLesson}</h2>
						{#if data.doNowTitle}<span class="sub">{data.doNowTitle}</span>{/if}
					</div>
					<ol class="qs">
						{#each data.doNowItems as q (q.n)}
							<li>
								<span class="chip" style:background={q.chip}>{q.n}</span>
								<span>{q.prompt}</span>
							</li>
						{/each}
					</ol>
					<div class="row wrap-row">
						<a class="btn light" href={resolve('/c/[code]/project', { code: data.code })}
							>Show on projector</a
						>
						<a class="btn outline" href={resolve('/c/[code]/print', { code: data.code })}
							>Print sheet</a
						>
						<a class="btn outline" href={resolve('/c/[code]/key', { code: data.code })}
							>Answer key</a
						>
					</div>
				{:else}
					<h2 id="donow-heading">No Do Now yet</h2>
					<p class="sub">
						Your first one appears here, ready for the projector, a print sheet or the answer key.
					</p>
				{/if}
			</section>
		</div>
	</div>
</div>

<style>
	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 16px;
	}
	.course {
		font-size: 15px;
		font-weight: 700;
		color: var(--muted);
	}
	.grow {
		flex-grow: 1;
	}
	.code {
		font-weight: 800;
		font-size: 15px;
		background: var(--surface);
		padding: 10px 16px;
		border-radius: 999px;
		letter-spacing: 0.1em;
	}
	.top .btn.ghost {
		background: transparent;
		border-color: var(--line-2);
	}
	.cols {
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
		align-items: flex-start;
	}
	.cols > .card {
		min-width: 0;
	}

	/* Topics */
	.topics {
		flex: 1 1 220px;
		padding: 16px 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.label {
		font-size: 12px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
		padding: 6px 10px 8px;
	}
	.topic {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 8px 12px;
		border: 0;
		border-radius: 12px;
		font-weight: 700;
		font-size: 15px;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
		background: transparent;
	}
	.topic:hover {
		background: var(--field);
	}
	.topic.on {
		background: var(--accent-soft);
	}
	.topic .name {
		flex-grow: 1;
		line-height: 1.25;
	}
	.topic .count {
		font-size: 13px;
		color: var(--muted);
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.dot.big {
		width: 12px;
		height: 12px;
	}

	/* Skills */
	.skills {
		flex: 2 1 340px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.head h2 {
		margin: 0;
		font-size: 20px;
		flex-grow: 1;
		line-height: 1.2;
	}
	.summary {
		font-size: 14px;
		font-weight: 700;
		color: var(--muted);
		white-space: nowrap;
	}
	.bar {
		height: 8px;
		border-radius: 999px;
		background: #f1eef8;
		overflow: hidden;
	}
	.bar div {
		height: 100%;
		border-radius: 999px;
		transition: width 0.3s ease;
	}
	.hint {
		margin: 0 0 4px;
		font-size: 14px;
		color: var(--muted);
	}
	.skills ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.skill {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		padding: 8px 12px;
		border-radius: var(--r-row);
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
		background: var(--field);
	}
	.skill input {
		width: 20px;
		height: 20px;
		margin: 0;
		accent-color: var(--accent);
		flex-shrink: 0;
	}
	.skill .title {
		flex-grow: 1;
		line-height: 1.3;
	}
	.skill .spec {
		font-size: 12px;
		color: var(--muted);
		text-align: right;
	}
	.skill .reps {
		font-size: 12px;
		font-weight: 800;
		min-width: 28px;
		text-align: right;
		color: var(--accent-deep);
	}

	/* Generator */
	.gen {
		flex: 3 1 420px;
		background: var(--accent);
		color: #fff;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.between {
		justify-content: space-between;
		gap: 12px;
	}
	.baseline {
		align-items: baseline;
	}
	.wrap-row {
		flex-wrap: wrap;
	}
	.eyebrow {
		font-weight: 800;
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.mix {
		font-weight: 700;
		font-size: 13px;
		background: rgba(255, 255, 255, 0.18);
		padding: 6px 12px;
		border-radius: 999px;
		white-space: nowrap;
	}
	.title-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
		font-weight: 700;
	}
	.title-field input {
		font-weight: 700;
		font-size: 18px;
		color: var(--ink);
		padding: 12px 16px;
		border: 0;
		border-radius: var(--r-row);
		background: #fff;
		min-width: 0;
	}
	.gen :focus-visible {
		outline-color: #fff;
	}
	.sizes {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.sizes-label {
		font-size: 14px;
		font-weight: 700;
		margin-right: 4px;
	}
	.sizes-group {
		display: flex;
		gap: 8px;
	}
	.size {
		font-weight: 800;
		font-size: 16px;
		width: 48px;
		height: 44px;
		border-radius: 999px;
		cursor: pointer;
		border: 2px solid #fff;
		background: transparent;
		color: #fff;
	}
	.size.on {
		background: #fff;
		color: var(--accent-deep);
	}
	.btn.light {
		background: #fff;
		border-color: #fff;
		color: var(--accent-deep);
	}
	.btn.light:hover {
		background: var(--accent-soft);
		border-color: var(--accent-soft);
	}
	.btn.outline {
		background: transparent;
		border-color: rgba(255, 255, 255, 0.7);
		color: #fff;
		font-weight: 700;
		padding: 0 20px;
	}
	.btn.outline:hover {
		background: rgba(255, 255, 255, 0.12);
		border-color: #fff;
	}
	.rule {
		height: 1px;
		background: rgba(255, 255, 255, 0.25);
	}
	.gen h2 {
		margin: 0;
		font-size: 22px;
	}
	.sub {
		margin: 0;
		font-size: 14px;
		font-weight: 700;
		opacity: 0.9;
	}
	.qs {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.qs li {
		display: flex;
		gap: 12px;
		align-items: center;
		background: rgba(255, 255, 255, 0.12);
		border-radius: var(--r-row);
		padding: 10px 14px;
		font-size: 16px;
		font-weight: 600;
		line-height: 1.35;
	}
</style>
