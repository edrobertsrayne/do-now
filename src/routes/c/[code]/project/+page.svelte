<script lang="ts">
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';

	type Item = { n: number; prompt: string; answer: string };
	let { data } = $props();

	const DEFAULT_SECONDS = 240;

	const items: Item[] = $derived(data.items);
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
		if (document.fullscreenElement) document.exitFullscreen();
		else document.documentElement.requestFullscreen?.();
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
		void [step, overview, items, root];
		tick().then(fit);
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
			<div class="spacer"></div>
			{#if phase === 'think'}
				<button
					class="ring"
					type="button"
					onclick={toggleTimer}
					aria-label={running ? 'Pause timer' : 'Start timer'}
				>
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
				</button>
			{/if}
		</header>

		<main aria-live="polite">
			{#if view === 'think'}
				<ol class="list" aria-label="Questions">
					{#each items as it (it.n)}
						<li class="row">
							<span class="num">{it.n}</span>
							<p class="prompt">{it.prompt}</p>
						</li>
					{/each}
				</ol>
			{:else if view === 'question' && current}
				<section class="single" aria-label="Question {current.n}">
					<div class="card">
						<span class="num">{current.n}</span>
						<p class="prompt">{current.prompt}</p>
					</div>
					<div class="answer" class:shown={revealed(checkIndex)}>
						{#if revealed(checkIndex)}<p class="text">{current.answer}</p>{/if}
					</div>
				</section>
			{:else}
				<ul class="ov" aria-label={isSummary ? 'Summary' : 'Overview'}>
					{#each items as it, i (it.n)}
						<li>
							<span class="num">{it.n}</span>
							<span class="q">{it.prompt}</span>
							{#if revealed(i)}
								<span class="a">{it.answer}</span>
							{:else}
								<span class="a none"></span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
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
	.stage :global(button) {
		font: inherit;
		color: inherit;
	}
	.stage :focus-visible {
		outline: calc(var(--u) * 0.3) solid var(--yellow);
		outline-offset: calc(var(--u) * 0.2);
	}
	.stage[data-phase='think'] :focus-visible {
		outline-color: var(--navy);
	}

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

	/* timer */
	.ring {
		position: relative;
		width: calc(var(--u) * 7);
		height: calc(var(--u) * 7);
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
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

	main {
		position: relative;
		min-height: 0;
		display: flex;
		flex-direction: column;
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
		flex: none;
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
	.single {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
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
		align-items: flex-start;
		gap: calc(var(--u) * 1.2);
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
		min-height: 0;
		overflow: hidden;
		border: calc(var(--u) * 0.25) dashed #9fb2e0;
	}
	.answer.shown {
		background: var(--green);
		color: #fff;
		border: calc(var(--u) * 0.25) solid #fff;
	}
	.answer .text {
		margin: 0;
		font-size: var(--pf);
		line-height: 1.12;
		font-weight: 800;
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
		border: calc(var(--u) * 0.2) dashed var(--rule);
		min-height: 1em;
	}

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
		cursor: pointer;
	}
	.stage[data-phase='check'] .cta {
		background: var(--yellow);
		color: var(--ink);
		border-color: var(--yellow);
	}

	@media (prefers-reduced-motion: reduce) {
		.stage,
		.ring .bar {
			transition: none;
		}
	}
</style>
