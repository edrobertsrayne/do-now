<script lang="ts">
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import type { PageProps } from './$types.js';

	type Item = { n: number; prompt: string; answer: string };
	let { data }: PageProps = $props();

	const DEFAULT_SECONDS = 240;

	const items: Item[] = $derived(data.items);
	const today = new Date().toLocaleDateString(undefined, {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
	const count = $derived(items.length);

	/* Step model: 0 = Think. Check question i (0-based): step 1+2i = answer hidden, 2+2i = revealed.
	   Last step (2*count+1) = summary of every question with its answer. */
	let step = $state(0);
	let overview = $state(false);
	let secs = $state(DEFAULT_SECONDS);
	let total = $state(DEFAULT_SECONDS);
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

	const CIRCUMFERENCE = 2 * Math.PI * 45;
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
		if (secs === 0) secs = total = DEFAULT_SECONDS;
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
		secs = total = DEFAULT_SECONDS;
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
				({ 4: 3.8, 5: 3.4, 6: 3.0 } as Record<number, number>)[Math.min(Math.max(count, 4), 6)] ??
				3.4;
			run(list, start, 2.2, () => rows.some((r) => r.scrollHeight > r.clientHeight + 1));
		}
		const card = root.querySelector<HTMLElement>('.card');
		if (card) run(card, 5.4, 2.6, () => card.scrollHeight > card.clientHeight + 1);
		const ans = root.querySelector<HTMLElement>('.answer.shown');
		if (ans) run(ans, 4.4, 2.2, () => ans.scrollHeight > ans.clientHeight + 1);
		const ov = root.querySelector<HTMLElement>('.ov');
		if (ov) {
			const lis = [...ov.children] as HTMLElement[];
			run(ov, 2.4, 1.6, () =>
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
		<p>
			No Do Now yet. <a href={resolve('/c/[code]', { code: data.code })}>Generate one</a> first.
		</p>
	</div>
{:else}
	<div class="stage" data-phase={phase} bind:this={root}>
		<header>
			<h1>Do Now</h1>
			{#if data.title}<span class="lesson-title">{data.title}</span>{/if}
			<div class="spacer"></div>
			<div class="side">
				<span class="today">{today}</span>
				{#if phase === 'think'}
					<div class="timer" aria-label="Timer">
						<button
							class="tbtn"
							type="button"
							onclick={() => adjust(-30)}
							aria-label="Minus 30 seconds">−</button
						>
						<div class="ring">
							<svg viewBox="0 0 100 100" aria-hidden="true">
								<circle class="track" cx="50" cy="50" r="45" />
								<circle
									class="bar"
									cx="50"
									cy="50"
									r="45"
									stroke-dasharray={CIRCUMFERENCE}
									stroke-dashoffset={CIRCUMFERENCE * (1 - fraction)}
								/>
							</svg>
							<output>{clock}</output>
						</div>
						<button
							class="tbtn play"
							type="button"
							onclick={toggleTimer}
							aria-label={running ? 'Pause timer' : 'Start timer'}
						>
							{#if running}
								<svg viewBox="0 0 10 10" aria-hidden="true"
									><rect x="1.5" y="1" width="2.4" height="8" /><rect
										x="6.1"
										y="1"
										width="2.4"
										height="8"
									/></svg
								>
							{:else}
								<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l7 4-7 4z" /></svg>
							{/if}
						</button>
						<button
							class="tbtn"
							type="button"
							onclick={() => adjust(30)}
							aria-label="Plus 30 seconds">+</button
						>
						{#if secs === 0}<span class="done">Time</span>{/if}
					</div>
				{/if}
			</div>
		</header>

		<main aria-live="polite">
			{#key viewKey}
				{#if view === 'think'}
					<section class="view enter" aria-label="Questions">
						<ol class="list">
							{#each items as it (it.n)}
								<li class="row">
									<span class="num" aria-label="Question {it.n}">{it.n}</span>
									<p class="prompt">{it.prompt}</p>
								</li>
							{/each}
						</ol>
					</section>
				{:else}
					<section
						class="view enter"
						aria-label={view === 'question' && current
							? `Checking question ${current.n}`
							: isSummary
								? 'Summary'
								: 'Overview'}
					>
						<div class="pips" role="group" aria-label="Question progress">
							{#each items as it, i (it.n)}
								<button
									class="pip"
									class:seen={revealed(i) && i !== currentPip}
									type="button"
									onclick={() => jump(i)}
									aria-current={i === currentPip ? 'step' : undefined}
									aria-label="Question {it.n}">{it.n}</button
								>
							{/each}
							<button
								class="pip ovb"
								type="button"
								onclick={toggleOverview}
								aria-pressed={overview || isSummary}>Overview</button
							>
						</div>
						{#if view === 'question' && current}
							<div class="card">
								<p class="prompt">{current.prompt}</p>
							</div>
							{#if revealed(checkIndex)}
								<div class="answer shown">
									<span class="label">Answer</span>
									<p class="text">{current.answer}</p>
									<p class="mark">Tick it, or correct it in a different colour.</p>
								</div>
							{:else}
								<div class="answer hidden">
									<span class="label">Answer</span>
									<p class="think">Think first&hellip;</p>
								</div>
							{/if}
						{:else}
							<ul class="ov">
								{#each items as it, i (it.n)}
									<li>
										<span class="num">{it.n}</span>
										<span class="q">{it.prompt}</span>
										{#if revealed(i)}
											<span class="a">{it.answer}</span>
										{:else}
											<span class="a none">Answer not yet shown</span>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</section>
				{/if}
			{/key}
		</main>

		<footer>
			<button class="cta" type="button" onclick={next}>{cta}</button>
		</footer>
	</div>
{/if}

<style>
	.stage {
		--u: min(1vw, 1.7778vh); /* 1 unit = 1% of a 16:9 screen width */
		--paper: #fcfbf6;
		--ink: #0b0f1a;
		--ink-2: #2a3350; /* secondary text, still AAA on paper */
		--navy: #0d2b5c;
		--navy-deep: #08183a;
		--yellow: #ffd23f;
		--green: #0f3d2e;
		--rule: #c9c4b4;
		position: fixed;
		inset: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		padding: calc(var(--u) * 1.6) calc(var(--u) * 3) calc(var(--u) * 1.2);
		gap: calc(var(--u) * 1.2);
		font-weight: 700;
		line-height: normal;
		color: var(--ink);
		background: var(--paper);
		overflow: hidden;
		transition:
			background-color 0.5s ease,
			color 0.5s ease;
	}
	.stage[data-phase='check'] {
		background: var(--navy-deep);
		color: #fff;
	}
	/* Kept at element+hash specificity so the class rules below (.cta, .tbtn, .pip) win. */
	button {
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
	.stage :focus-visible {
		outline: calc(var(--u) * 0.3) solid var(--yellow);
		outline-offset: calc(var(--u) * 0.2);
	}
	.stage[data-phase='think'] :focus-visible {
		outline-color: var(--navy);
	}

	/* header */
	header {
		display: flex;
		align-items: center;
		gap: calc(var(--u) * 2);
		min-height: calc(var(--u) * 7);
	}
	h1 {
		margin: 0;
		font-size: calc(var(--u) * 3.6);
		line-height: 1;
		letter-spacing: -0.01em;
	}
	.spacer {
		flex: 1;
	}
	.lesson-title {
		font-size: calc(var(--u) * 3.6);
		line-height: 1;
		letter-spacing: -0.01em;
		font-weight: 400;
		padding-left: calc(var(--u) * 2);
		border-left: calc(var(--u) * 0.2) solid var(--rule);
	}
	.side {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: calc(var(--u) * 0.5);
	}
	.today {
		font-size: calc(var(--u) * 1.5);
		font-weight: 400;
		color: var(--ink-2);
	}
	.stage[data-phase='check'] .today {
		color: #dbe4ff;
	}

	/* timer */
	.timer {
		display: flex;
		align-items: center;
		gap: calc(var(--u) * 1);
	}
	.ring {
		position: relative;
		width: calc(var(--u) * 7);
		height: calc(var(--u) * 7);
	}
	.ring svg {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}
	.ring circle {
		fill: none;
		stroke-width: 9;
	}
	.ring .track {
		stroke: var(--rule);
	}
	.ring .bar {
		stroke: var(--navy);
		stroke-linecap: round;
		transition: stroke-dashoffset 1s linear;
	}
	.ring output {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: calc(var(--u) * 1.9);
		font-variant-numeric: tabular-nums;
	}
	.tbtn {
		width: calc(var(--u) * 3.4);
		height: calc(var(--u) * 3.4);
		border-radius: 50%;
		border: calc(var(--u) * 0.2) solid var(--ink);
		background: var(--paper);
		font-size: calc(var(--u) * 1.8);
		line-height: 1;
		display: grid;
		place-items: center;
		padding: 0;
	}
	.tbtn.play {
		background: var(--navy);
		border-color: var(--navy);
		color: #fff;
	}
	.tbtn svg {
		width: 50%;
		height: 50%;
		fill: currentColor;
	}
	.timer .done {
		font-size: calc(var(--u) * 1.6);
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
		width: calc(var(--u) * 3.8);
		height: calc(var(--u) * 3.8);
		border-radius: 50%;
		border: calc(var(--u) * 0.22) solid var(--ink);
		display: grid;
		place-items: center;
		font-size: calc(var(--u) * 2);
		line-height: 1;
	}
	.prompt {
		margin: 0;
		line-height: 1.18;
		font-weight: 400;
	}

	/* THINK */
	.list {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-auto-rows: 1fr;
		gap: calc(var(--u) * 1.4);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.row {
		display: grid;
		grid-template-columns: calc(var(--u) * 4.4) minmax(0, 1fr);
		align-items: center;
		column-gap: calc(var(--u) * 2);
		min-height: 0;
		overflow: hidden;
		background: #fff;
		border: calc(var(--u) * 0.2) solid var(--rule);
		border-left: calc(var(--u) * 0.7) solid var(--navy);
		border-radius: calc(var(--u) * 1.2);
		padding: 0 calc(var(--u) * 2.4) 0 calc(var(--u) * 1.6);
	}
	.row .prompt {
		font-size: var(--pf);
	}

	/* CHECK */
	.pips {
		flex: none;
		display: flex;
		gap: calc(var(--u) * 0.8);
		margin-bottom: calc(var(--u) * 1);
	}
	.pip {
		min-width: calc(var(--u) * 3.2);
		height: calc(var(--u) * 3.2);
		padding: 0 calc(var(--u) * 0.6);
		border-radius: calc(var(--u) * 1);
		white-space: nowrap;
		border: calc(var(--u) * 0.22) solid #fff;
		display: grid;
		place-items: center;
		font-size: calc(var(--u) * 1.9);
		background: transparent;
		color: #fff;
	}
	.pip[aria-current='step'] {
		background: var(--yellow);
		border-color: var(--yellow);
		color: var(--ink);
	}
	.pip.seen {
		background: #fff;
		color: var(--navy-deep);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.pip.seen::after {
		content: '\2713';
		margin-left: 0.25em;
		font-size: 0.8em;
	}
	.pip.ovb {
		margin-left: auto;
		padding: 0 calc(var(--u) * 1.6);
		border-style: dashed;
		display: inline-flex;
		align-items: center;
		gap: calc(var(--u) * 0.6);
	}
	.card {
		flex: 1 1 0;
		min-height: 0;
		overflow: hidden;
		background: var(--paper);
		color: var(--ink);
		border-radius: calc(var(--u) * 1.6);
		padding: calc(var(--u) * 1.4) calc(var(--u) * 3);
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: calc(var(--u) * 1);
	}
	.card .prompt {
		font-size: var(--pf);
	}
	.answer {
		flex: 0 0 calc(var(--u) * 13);
		margin-top: calc(var(--u) * 1);
		border-radius: calc(var(--u) * 1.6);
		padding: calc(var(--u) * 1.1) calc(var(--u) * 3);
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: calc(var(--u) * 0.4);
		min-height: 0;
		overflow: hidden;
	}
	.answer.hidden {
		border: calc(var(--u) * 0.25) dashed #9fb2e0;
		color: #dbe4ff;
	}
	.answer.shown {
		background: var(--green);
		color: #fff;
		border: calc(var(--u) * 0.25) solid #fff;
		animation: rise 0.3s ease both;
	}
	.answer .label {
		font-size: calc(var(--u) * 1.5);
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.answer .text {
		margin: 0;
		font-size: var(--pf);
		line-height: 1.12;
		font-weight: 800;
	}
	.answer .think {
		margin: 0;
		font-size: calc(var(--u) * 2.6);
	}
	.mark {
		margin: 0;
		font-size: calc(var(--u) * 1.7);
		color: var(--yellow);
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
		background: var(--paper);
		color: var(--ink);
		border-radius: calc(var(--u) * 1.2);
		display: grid;
		align-items: center;
		min-height: 0;
		grid-template-columns: calc(var(--u) * 4.4) minmax(0, 1.15fr) minmax(0, 1fr);
		column-gap: calc(var(--u) * 1.6);
		padding: 0 calc(var(--u) * 1.6);
	}
	.ov .q {
		font-size: var(--pf);
		line-height: 1.15;
		font-weight: 400;
	}
	.ov .a {
		font-size: var(--pf);
		line-height: 1.12;
		background: var(--green);
		color: #fff;
		border-radius: calc(var(--u) * 0.9);
		padding: calc(var(--u) * 0.5) calc(var(--u) * 1.2);
	}
	.ov .a.none {
		background: transparent;
		color: var(--ink-2);
		border: calc(var(--u) * 0.2) dashed var(--ink-2);
	}

	/* footer */
	footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		min-height: calc(var(--u) * 3.6);
	}
	.cta {
		background: var(--navy);
		color: #fff;
		border: calc(var(--u) * 0.2) solid var(--navy);
		border-radius: calc(var(--u) * 0.9);
		padding: calc(var(--u) * 0.7) calc(var(--u) * 1.8);
		font-size: calc(var(--u) * 1.9);
		white-space: nowrap;
	}
	.stage[data-phase='check'] .cta {
		background: var(--yellow);
		color: var(--ink);
		border-color: var(--yellow);
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
