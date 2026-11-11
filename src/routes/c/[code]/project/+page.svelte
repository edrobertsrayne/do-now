<script lang="ts">
	import { resolve } from '$app/paths';
	import { tick, untrack } from 'svelte';
	import type { PageProps } from './$types.js';

	import { SECONDS_PER_QUESTION } from '#lib/timing.ts';

	type Item = PageProps['data']['items'][number];
	let { data }: PageProps = $props();

	const items: Item[] = $derived(data.items);
	const today = new Date().toLocaleDateString(undefined, {
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	});
	const count = $derived(items.length);
	const defaultSeconds = $derived(Math.max(1, count) * SECONDS_PER_QUESTION);

	/* Step model: 0 = Think. Check question i (0-based): step 1+2i = answer hidden, 2+2i = revealed.
	   Last step (2*count+1) = summary of every question with its answer. */
	let step = $state(0);
	let overview = $state(false);
	let secs = $state(untrack(() => defaultSeconds));
	let total = $state(untrack(() => defaultSeconds));
	let running = $state(false);
	let timerId: ReturnType<typeof setInterval> | undefined;
	let root: HTMLElement | undefined = $state();

	const lastStep = $derived(2 * count + 1);
	const phase = $derived(step === 0 ? 'think' : 'check');
	const isSummary = $derived(step === lastStep);
	const checkIndex = $derived(Math.floor((step - 1) / 2));
	const revealed = (i: number) => step >= 2 + 2 * i;
	const view = $derived(
		phase === 'think' ? 'think' : isSummary ? 'list' : overview ? 'list' : 'question'
	);
	const current = $derived(items[checkIndex]);
	/* Re-keys the view so it animates in only when the visible content changes. */
	const viewKey = $derived(
		view === 'question'
			? `q${checkIndex}${revealed(checkIndex) ? 'r' : ''}`
			: isSummary
				? 'sum'
				: view
	);
	const currentPip = $derived(overview || isSummary ? -1 : checkIndex);
	const cta = $derived(
		step === 0
			? 'Start checking'
			: isSummary
				? 'Back to start'
				: revealed(checkIndex)
					? checkIndex === count - 1
						? 'Finish'
						: 'Next question'
					: 'Reveal answer'
	);

	const CIRCUMFERENCE = 2 * Math.PI * 44;
	const fraction = $derived(total ? Math.max(0, secs / total) : 0);
	const clock = $derived(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);

	function setStep(s: number) {
		step = Math.max(0, Math.min(lastStep, s));
		if (step === 0 || isSummary) overview = false;
	}
	function next() {
		if (isSummary) setStep(0);
		else setStep(step + 1);
	}
	function back() {
		if (overview) overview = false;
		else setStep(step - 1);
	}
	function jump(i: number) {
		overview = false;
		setStep(revealed(i) ? 2 + 2 * i : 1 + 2 * i);
	}
	function toggleOverview() {
		if (phase === 'think') return;
		if (isSummary) setStep(lastStep - 1);
		else overview = !overview;
	}

	function adjust(d: number) {
		secs = Math.max(0, secs + d);
		total = Math.max(total, secs, 30);
		if (!running) total = secs || total;
	}
	function toggleTimer() {
		if (running) {
			clearInterval(timerId);
			running = false;
			return;
		}
		if (secs === 0) secs = total = defaultSeconds;
		running = true;
		timerId = setInterval(() => {
			secs = Math.max(0, secs - 1);
			if (secs === 0) {
				clearInterval(timerId);
				running = false;
			}
		}, 1000);
	}
	function resetTimer() {
		clearInterval(timerId);
		running = false;
		secs = total = defaultSeconds;
	}
	function toggleFullscreen() {
		if (document.fullscreenElement) void document.exitFullscreen();
		// iPhone Safari lacks Element.requestFullscreen though the DOM types say it exists.
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		else void document.documentElement.requestFullscreen?.();
	}

	function onkey(e: KeyboardEvent) {
		if (e.ctrlKey || e.metaKey || e.altKey || count === 0) return;
		const k = e.key;
		if (k === ' ' || k === 'ArrowRight' || k === 'PageDown') {
			e.preventDefault();
			(document.activeElement as HTMLElement | null)?.blur();
			next();
		} else if (k === 'ArrowLeft' || k === 'Backspace' || k === 'PageUp') {
			e.preventDefault();
			back();
		} else if (k === 'o' || k === 'O') toggleOverview();
		else if (k === 'Escape' && overview) overview = false;
		else if (k === 't' || k === 'T') toggleTimer();
		else if (k === '+' || k === '=') adjust(30);
		else if (k === '-' || k === '_') adjust(-30);
		else if (k === '0') resetTimer();
		else if (k === 'f' || k === 'F') toggleFullscreen();
	}

	/* Shrink text until it fits its box (down to a legibility floor) rather than scrolling.
	   Sizes are in units of --u, which is 1% of a 16:9 screen width. */
	function fit() {
		if (!root) return;
		const u = Math.min(innerWidth / 100, innerHeight / 56.25);
		const run = (box: HTMLElement, start: number, min: number, overflows: () => boolean) => {
			let s = start;
			box.style.setProperty('--pf', `${s * u}px`);
			while (s > min && overflows()) {
				s *= 0.95;
				box.style.setProperty('--pf', `${s * u}px`);
			}
		};
		const list = root.querySelector<HTMLElement>('.list');
		if (list) {
			const rows = [...list.children] as HTMLElement[];
			const start =
				({ 4: 3.0, 5: 2.6, 6: 2.3 } as Record<number, number>)[Math.min(Math.max(count, 4), 6)] ??
				2.6;
			run(list, start, 1.7, () => rows.some((r) => r.scrollHeight > r.clientHeight + 1));
		}
		const card = root.querySelector<HTMLElement>('.qcard');
		if (card) run(card, 3.8, 2.2, () => card.scrollHeight > card.clientHeight + 1);
		const ans = root.querySelector<HTMLElement>('.answer.shown');
		if (ans) run(ans, 3.2, 1.8, () => ans.scrollHeight > ans.clientHeight + 1);
		const ov = root.querySelector<HTMLElement>('.ov');
		if (ov) {
			const lis = [...ov.children] as HTMLElement[];
			run(ov, 2.0, 1.3, () =>
				lis.some((li) =>
					[...li.querySelectorAll<HTMLElement>('.q,.a')].some(
						(e) => e.offsetHeight > li.clientHeight - 2
					)
				)
			);
		}
	}

	$effect(() => {
		// Read these so the effect re-runs when any of them changes.
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		[step, overview, items, root];
		void tick().then(fit);
	});
	$effect(() => () => clearInterval(timerId));
</script>

<svelte:head><title>Do Now</title></svelte:head>
<svelte:window onkeydown={onkey} onresize={fit} />

{#if count === 0}
	<div class="page">
		<div class="card empty">
			<p style="margin: 0;">
				No Do Now yet. <a href={resolve('/c/[code]', { code: data.code })}>Generate one</a> first.
			</p>
		</div>
	</div>
{:else}
	<div class="stage" data-phase={phase} bind:this={root}>
		<header>
			{#if phase === 'think'}
				<h1 class="badge">Do Now</h1>
			{:else}
				<h1 class="badge check">Check</h1>
			{/if}
			{#if data.title}<span class="lesson-title">{data.title}</span>{/if}
			<div class="spacer"></div>
			{#if phase === 'think'}
				<span class="today">{today}</span>
				<div class="timer" class:done={secs === 0} role="group" aria-label="Timer">
					<button
						class="tbtn"
						type="button"
						onclick={() => adjust(-30)}
						aria-label="Minus 30 seconds">−</button
					>
					<button
						class="ring"
						type="button"
						onclick={toggleTimer}
						aria-label={running ? 'Pause timer' : 'Start timer'}
					>
						<svg viewBox="0 0 100 100" aria-hidden="true">
							<circle class="track" cx="50" cy="50" r="44" />
							<circle
								class="bar"
								cx="50"
								cy="50"
								r="44"
								stroke-dasharray={CIRCUMFERENCE}
								stroke-dashoffset={CIRCUMFERENCE * (1 - fraction)}
							/>
						</svg>
						<output>{secs === 0 ? 'Time' : clock}</output>
					</button>
					<button
						class="tbtn play"
						type="button"
						onclick={toggleTimer}
						aria-label={running ? 'Pause timer' : 'Start timer'}
					>
						{#if running}
							<svg viewBox="0 0 10 10" aria-hidden="true"
								><rect x="1.5" y="1" width="2.4" height="8" rx="0.6" /><rect
									x="6.1"
									y="1"
									width="2.4"
									height="8"
									rx="0.6"
								/></svg
							>
						{:else}
							<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2.5 1.2l6 3.8-6 3.8z" /></svg>
						{/if}
					</button>
					<button class="tbtn" type="button" onclick={() => adjust(30)} aria-label="Plus 30 seconds"
						>+</button
					>
				</div>
			{:else}
				<div class="pips" role="group" aria-label="Question progress">
					{#each items as it, i (it.n)}
						<button
							class="pip"
							class:seen={revealed(i) || i === currentPip}
							type="button"
							style:--chip={it.chip}
							onclick={() => jump(i)}
							aria-current={i === currentPip ? 'step' : undefined}
							aria-label="Question {it.n}">{it.n}</button
						>
					{/each}
				</div>
			{/if}
		</header>

		<main aria-live="polite">
			{#key viewKey}
				{#if view === 'think'}
					<section class="view enter" aria-label="Questions">
						<ol class="list">
							{#each items as it (it.n)}
								<li class="row">
									<span class="num" style:background={it.chip} aria-label="Question {it.n}"
										>{it.n}</span
									>
									<p class="prompt">{it.prompt}</p>
								</li>
							{/each}
						</ol>
					</section>
				{:else if view === 'question' && current}
					<section class="view enter" aria-label="Checking question {current.n}">
						<div class="qcard">
							{#if current.topic}
								<div class="topic" style:color={current.ink}>
									<span class="dot" style:background={current.dot}></span>
									{current.topic}{current.skill ? ` · ${current.skill}` : ''}
								</div>
							{/if}
							<p class="prompt">{current.prompt}</p>
							<div class="answer-slot">
								{#if revealed(checkIndex)}
									<div class="answer shown" style:background={current.tint}>
										<span class="label" style:color={current.ink}>Answer</span>
										<p class="text">{current.answer}</p>
									</div>
								{:else}
									<div class="answer hidden">
										<span class="label">Answer</span>
										<p class="think">Think first&hellip;</p>
									</div>
								{/if}
							</div>
						</div>
					</section>
				{:else}
					<section class="view enter" aria-label={isSummary ? 'Summary' : 'Overview'}>
						<ul class="ov">
							{#each items as it, i (it.n)}
								<li>
									<span class="num" style:background={it.chip}>{it.n}</span>
									<span class="q">{it.prompt}</span>
									{#if revealed(i)}
										<span class="a" style:background={it.tint}>{it.answer}</span>
									{:else}
										<span class="a none">Answer not yet shown</span>
									{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			{/key}
		</main>

		<footer>
			{#if phase === 'think'}
				<span class="lead">Think on your own, in silence.</span>
				<div class="spacer"></div>
				<span class="keys" aria-hidden="true">
					<kbd>Space</kbd>check answers <kbd>T</kbd>timer <kbd>F</kbd>fullscreen
				</span>
			{:else}
				<button class="ghost" type="button" onclick={back}>Back</button>
				<button
					class="ghost"
					type="button"
					onclick={toggleOverview}
					aria-pressed={overview || isSummary}>All questions</button
				>
				<div class="spacer"></div>
				<span class="keys" aria-hidden="true"><kbd>O</kbd>overview</span>
			{/if}
			<button class="cta" type="button" onclick={next}>{cta}</button>
		</footer>
	</div>
{/if}

<style>
	.stage {
		--u: min(1vw, 1.7778vh); /* 1 unit = 1% of a 16:9 screen width */
		position: fixed;
		inset: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		padding: calc(var(--u) * 2.2) calc(var(--u) * 3.1) calc(var(--u) * 1.7);
		gap: calc(var(--u) * 1.4);
		font-family: Nunito, system-ui, sans-serif;
		font-weight: 700;
		line-height: normal;
		color: var(--ink);
		background: var(--ground);
		overflow: hidden;
	}
	button {
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
	.stage :focus-visible {
		outline: calc(var(--u) * 0.25) solid var(--accent);
		outline-offset: calc(var(--u) * 0.2);
	}
	.spacer {
		flex: 1;
	}

	/* header */
	header {
		display: flex;
		align-items: center;
		gap: calc(var(--u) * 1.4);
		min-height: calc(var(--u) * 7);
	}
	.badge {
		margin: 0;
		font-size: calc(var(--u) * 2.65);
		font-weight: 800;
		line-height: 1.2;
		color: #fff;
		background: var(--accent);
		padding: calc(var(--u) * 0.47) calc(var(--u) * 1.7);
		border-radius: 999px;
		white-space: nowrap;
	}
	.badge.check {
		color: var(--accent-deep);
		background: var(--surface);
		border: calc(var(--u) * 0.23) solid var(--accent);
		padding: calc(var(--u) * 0.24) calc(var(--u) * 1.7);
	}
	.lesson-title {
		font-size: calc(var(--u) * 2.35);
		font-weight: 800;
		line-height: 1.15;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.today {
		font-size: calc(var(--u) * 1.4);
		color: var(--muted);
		white-space: nowrap;
	}

	/* timer */
	.timer {
		display: flex;
		align-items: center;
		gap: calc(var(--u) * 0.6);
		background: var(--surface);
		border-radius: 999px;
		padding: calc(var(--u) * 0.47);
	}
	.ring {
		position: relative;
		width: calc(var(--u) * 5.9);
		height: calc(var(--u) * 5.9);
		padding: 0;
		border: 0;
		background: transparent;
		border-radius: 50%;
	}
	.ring svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}
	.ring circle {
		fill: none;
		stroke-width: 9;
	}
	.ring .track {
		stroke: var(--accent-soft);
	}
	.ring .bar {
		stroke: var(--accent);
		stroke-linecap: round;
		transition: stroke-dashoffset 1s linear;
	}
	.ring output {
		position: relative;
		font-size: calc(var(--u) * 1.55);
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.timer.done .ring output {
		color: var(--accent-deep);
	}
	.tbtn {
		width: calc(var(--u) * 3.4);
		height: calc(var(--u) * 3.4);
		border-radius: 50%;
		border: 0;
		background: var(--ground);
		color: var(--accent-deep);
		font-size: calc(var(--u) * 1.7);
		font-weight: 800;
		line-height: 1;
		display: grid;
		place-items: center;
		padding: 0;
	}
	.tbtn.play {
		background: var(--accent);
		color: #fff;
	}
	.tbtn svg {
		width: 40%;
		height: 40%;
		fill: currentColor;
	}

	/* pips */
	.pips {
		display: flex;
		align-items: center;
		gap: calc(var(--u) * 0.8);
	}
	.pip {
		width: calc(var(--u) * 3.1);
		height: calc(var(--u) * 3.1);
		padding: 0;
		border-radius: 50%;
		border: calc(var(--u) * 0.23) solid var(--line-3);
		background: var(--surface);
		color: var(--muted);
		display: grid;
		place-items: center;
		font-size: calc(var(--u) * 1.35);
		font-weight: 800;
		transition:
			width 0.2s ease,
			height 0.2s ease;
	}
	.pip.seen {
		border-color: var(--chip);
		background: var(--chip);
		color: var(--ink);
	}
	.pip[aria-current='step'] {
		width: calc(var(--u) * 4.05);
		height: calc(var(--u) * 4.05);
		border: calc(var(--u) * 0.31) solid var(--ink);
		font-size: calc(var(--u) * 1.65);
	}

	main {
		position: relative;
		min-height: 0;
	}
	.view {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.view.enter {
		animation: rise 0.35s ease both;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(calc(var(--u) * 1));
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.num {
		width: calc(var(--u) * 4.2);
		height: calc(var(--u) * 4.2);
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-size: calc(var(--u) * 2);
		font-weight: 800;
		line-height: 1;
		color: var(--ink);
	}
	.prompt {
		margin: 0;
		line-height: 1.22;
		font-weight: 700;
	}

	/* THINK */
	.list {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-auto-rows: 1fr;
		gap: calc(var(--u) * 0.95);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.row {
		display: grid;
		grid-template-columns: calc(var(--u) * 4.2) minmax(0, 1fr);
		align-items: center;
		column-gap: calc(var(--u) * 1.7);
		min-height: 0;
		overflow: hidden;
		background: var(--surface);
		border-radius: calc(var(--u) * 1.7);
		padding: 0 calc(var(--u) * 2.2);
	}
	.row .prompt {
		font-size: var(--pf);
	}

	/* CHECK */
	.qcard {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		background: var(--surface);
		border-radius: calc(var(--u) * 2.2);
		padding: calc(var(--u) * 2.8) calc(var(--u) * 3.4);
		display: flex;
		flex-direction: column;
		gap: calc(var(--u) * 2);
	}
	.topic {
		display: flex;
		align-items: center;
		gap: calc(var(--u) * 0.9);
		font-size: calc(var(--u) * 1.4);
		font-weight: 800;
	}
	.dot {
		width: calc(var(--u) * 1.1);
		height: calc(var(--u) * 1.1);
		border-radius: 50%;
		flex-shrink: 0;
	}
	.qcard .prompt {
		font-size: var(--pf);
		font-weight: 800;
		flex: 1 1 auto;
		min-height: 0;
	}
	.answer-slot {
		flex: 0 0 calc(var(--u) * 13);
		display: flex;
		min-height: 0;
	}
	.answer {
		flex: 1;
		border-radius: calc(var(--u) * 1.7);
		padding: calc(var(--u) * 1.6) calc(var(--u) * 2.5);
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: calc(var(--u) * 0.6);
		min-height: 0;
		overflow: hidden;
	}
	.answer.hidden {
		border: calc(var(--u) * 0.23) dashed var(--line-3);
		color: var(--muted);
	}
	.answer.shown {
		animation: rise 0.3s ease both;
	}
	.answer .label {
		font-size: calc(var(--u) * 1.25);
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.answer .text {
		margin: 0;
		font-size: var(--pf);
		font-weight: 800;
		line-height: 1.2;
	}
	.answer .think {
		margin: 0;
		font-size: calc(var(--u) * 2.2);
	}

	/* OVERVIEW / SUMMARY */
	.ov {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-auto-rows: 1fr;
		gap: calc(var(--u) * 0.8);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.ov li {
		background: var(--surface);
		border-radius: calc(var(--u) * 1.7);
		display: grid;
		align-items: center;
		min-height: 0;
		grid-template-columns: calc(var(--u) * 4.2) minmax(0, 1.15fr) minmax(0, 1fr);
		column-gap: calc(var(--u) * 1.6);
		padding: 0 calc(var(--u) * 1.6);
	}
	.ov .q {
		font-size: var(--pf);
		line-height: 1.18;
	}
	.ov .a {
		font-size: var(--pf);
		font-weight: 800;
		line-height: 1.15;
		border-radius: calc(var(--u) * 1.1);
		padding: calc(var(--u) * 0.6) calc(var(--u) * 1.2);
	}
	.ov .a.none {
		font-weight: 700;
		color: var(--muted);
		border: calc(var(--u) * 0.18) dashed var(--line-3);
	}

	/* footer */
	footer {
		display: flex;
		align-items: center;
		gap: calc(var(--u) * 1);
		min-height: calc(var(--u) * 4.1);
		font-size: calc(var(--u) * 1.25);
		color: var(--muted);
	}
	.lead {
		font-weight: 800;
		color: var(--accent-deep);
	}
	.keys {
		display: inline-flex;
		align-items: center;
		gap: calc(var(--u) * 0.6);
		margin-right: calc(var(--u) * 0.6);
	}
	kbd {
		font:
			800 calc(var(--u) * 1.1) Nunito,
			system-ui,
			sans-serif;
		background: var(--surface);
		padding: calc(var(--u) * 0.3) calc(var(--u) * 0.8);
		border-radius: calc(var(--u) * 0.6);
		margin-left: calc(var(--u) * 0.5);
		color: var(--ink);
	}
	.ghost,
	.cta {
		height: calc(var(--u) * 4.1);
		padding: 0 calc(var(--u) * 1.9);
		border-radius: 999px;
		font-size: calc(var(--u) * 1.33);
		font-weight: 800;
		white-space: nowrap;
	}
	.ghost {
		border: calc(var(--u) * 0.16) solid var(--line-3);
		background: var(--surface);
		color: var(--accent-deep);
	}
	.ghost[aria-pressed='true'] {
		background: var(--accent-soft);
		border-color: var(--accent);
	}
	.cta {
		border: 0;
		background: var(--accent);
		color: #fff;
		padding: 0 calc(var(--u) * 2.3);
	}

	@media (prefers-reduced-motion: reduce) {
		.stage,
		.stage :global(*),
		.stage :global(*::before),
		.stage :global(*::after) {
			animation: none !important;
			transition: none !important;
		}
	}
</style>
