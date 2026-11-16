import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBank } from './bank.ts';
import { DEFAULT_CONFIG, generateDoNow, markTaught, newClass, unmarkTaught } from './scheduler.ts';
import type { Bank, ClassState, Config } from './types.ts';

/** Several tests reason about exactly four slots; the default size is 5. */
const SIZE4: Config = { ...DEFAULT_CONFIG, size: 4 };

/** Small deterministic PRNG (mulberry32) for reproducible random tests. */
function seeded(seed: number): () => number {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function makeBank(n: number, questionsPerSkill = 3): Bank {
	return {
		skills: Array.from({ length: n }, (_, i) => ({
			id: `s${i}`,
			title: `Skill ${i}`,
			topic: 'T',
			specRefs: ['4.0'],
			questions: Array.from({ length: questionsPerSkill }, (_, j) => ({
				id: `s${i}-q${j}`,
				command: 'State',
				prompt: 'p',
				answer: 'a',
				status: 'reviewed' as const
			}))
		}))
	};
}

/** Run `lessons` Do Nows, returning the lessons each skill appeared in. */
function appearances(bank: Bank, state: ClassState, lessons: number, config: Config) {
	const seen: Record<string, number[]> = {};
	for (let i = 0; i < lessons; i++) {
		const r = generateDoNow(bank, state, config);
		state = r.state;
		for (const item of r.doNow.items) (seen[item.skillId] ??= []).push(r.doNow.lesson);
	}
	return seen;
}

test('a single skill follows 1, 2, 4, 8, 16, 32 then repeats 32', () => {
	const bank = makeBank(1);
	const state = markTaught(bank, newClass(), 's0');
	const seen = appearances(bank, state, 100, { ...DEFAULT_CONFIG, fillToSize: false });
	// taught at 0: due at 1, then +2, +4, +8, +16, +32, +32
	assert.deepEqual(seen.s0, [1, 3, 7, 15, 31, 63, 95]);
});

test('padding with early skills is off when fillToSize is false', () => {
	const bank = makeBank(1);
	const state = markTaught(bank, newClass(), 's0');
	const first = generateDoNow(bank, state, { ...DEFAULT_CONFIG, fillToSize: false });
	const second = generateDoNow(bank, first.state, { ...DEFAULT_CONFIG, fillToSize: false });
	assert.equal(first.doNow.items.length, 1);
	assert.equal(second.doNow.items.length, 0);
});

test('with fillToSize, early skills pad the quiz soonest-due first and are marked early', () => {
	const bank = makeBank(6);
	let state = newClass();
	state = markTaught(bank, state, 's0');
	state = generateDoNow(bank, state, SIZE4).state; // lesson 1: s0 practised, next due lesson 3
	for (const id of ['s1', 's2', 's3', 's4']) state = markTaught(bank, state, id);
	const { doNow } = generateDoNow(bank, state, SIZE4); // lesson 2: s1..s4 due (overdue 0), s0 not due
	assert.deepEqual(doNow.items.map((i) => i.skillId).sort(), ['s1', 's2', 's3', 's4']);
	assert.ok(doNow.items.every((i) => i.reason !== 'early'));

	const small = markTaught(
		bank,
		generateDoNow(bank, markTaught(bank, newClass(), 's0'), SIZE4).state,
		's1'
	);
	const padded = generateDoNow(bank, small, SIZE4).doNow; // s1 due, s0 early
	assert.deepEqual(
		padded.items.map((i) => [i.skillId, i.reason]),
		[
			['s1', 'new'],
			['s0', 'early']
		]
	);
});

test('early padding does not advance a skill schedule and rotates by least recently shown', () => {
	const bank = makeBank(6);
	// Pinned so skills practised in lesson 1 are not due again until lesson 4.
	const config: Config = { ...SIZE4, intervals: [1, 3] };
	let state = newClass();
	for (const s of bank.skills) state = markTaught(bank, state, s.id);
	const l1 = generateDoNow(bank, state, config, seeded(3)); // lesson 1: 4 of 6 practised at random
	const l1Ids = new Set(l1.doNow.items.map((i) => i.skillId));
	const l2 = generateDoNow(bank, l1.state, config); // lesson 2: the other two due, two padded early
	state = l2.state;
	const l2Early = new Set(l2.doNow.items.filter((i) => i.reason === 'early').map((i) => i.skillId));
	assert.equal(l2Early.size, 2);
	const before = structuredClone(state);
	const { state: after, doNow } = generateDoNow(bank, state, config); // lesson 3: only early items
	assert.ok(doNow.items.every((i) => i.reason === 'early'));
	for (const item of doNow.items) {
		assert.deepEqual(after.skills[item.skillId], before.skills[item.skillId]);
	}
	const shown = new Set(doNow.items.map((i) => i.skillId));
	assert.equal(shown.size, 4);
	// Skills last shown in lesson 1 (not padded in lesson 2) come first, oldest first.
	for (const id of l1Ids) if (!l2Early.has(id)) assert.ok(shown.has(id));
});

test('a newly taught skill gets a slot even when older skills are more overdue', () => {
	const bank = makeBank(8);
	const config: Config = { ...DEFAULT_CONFIG, intervals: [1], size: 4 };
	let state = newClass();
	for (let i = 0; i < 6; i++) state = markTaught(bank, state, `s${i}`);
	state = generateDoNow(bank, state, config).state; // lesson 1: 4 of the 6 practised
	state = markTaught(bank, state, 's6');
	for (let seed = 1; seed <= 20; seed++) {
		const { doNow } = generateDoNow(bank, state, config, seeded(seed)); // lesson 2
		assert.equal(doNow.items.length, 4);
		assert.ok(doNow.items.some((i) => i.skillId === 's6' && i.reason === 'new'));
	}
});

test('when more skills are due than slots, the due ones are sampled randomly without duplicates', () => {
	const bank = makeBank(8);
	const config: Config = { ...DEFAULT_CONFIG, intervals: [1], size: 3, fillToSize: false };
	let state = newClass();
	for (const s of bank.skills) state = markTaught(bank, state, s.id);
	const chosen = new Set<string>();
	for (let seed = 1; seed <= 60; seed++) {
		const { doNow } = generateDoNow(bank, state, config, seeded(seed));
		const ids = doNow.items.map((i) => i.skillId);
		assert.equal(ids.length, 3);
		assert.equal(new Set(ids).size, 3);
		for (const id of ids) chosen.add(id);
	}
	// Not just the first N in bank order: every due skill gets picked sometimes.
	assert.equal(chosen.size, 8);
});

test('same rng seed gives the same Do Now', () => {
	const bank = makeBank(8);
	let state = newClass();
	for (const s of bank.skills) state = markTaught(bank, state, s.id);
	const ids = (seed: number) =>
		generateDoNow(bank, state, SIZE4, seeded(seed)).doNow.items.map((i) => i.skillId);
	assert.deepEqual(ids(7), ids(7));
});

test('items in a Do Now are ordered most overdue first, then earlier taught, then bank order', () => {
	const bank = makeBank(5);
	const config: Config = { ...DEFAULT_CONFIG, intervals: [1], size: 4, fillToSize: false };
	let state = newClass();
	state = markTaught(bank, state, 's3'); // taught at 0
	state = generateDoNow(bank, state, config).state; // lesson 1 (s3 practised)
	state = markTaught(bank, state, 's1'); // taught at 1
	state = markTaught(bank, state, 's0'); // taught at 1
	state = markTaught(bank, state, 's2'); // taught at 1
	// lesson 2: all four due with overdue 0, so all four fit.
	const { doNow } = generateDoNow(bank, state, config);
	assert.deepEqual(
		doNow.items.map((i) => i.skillId),
		['s3', 's0', 's1', 's2']
	);
});

test('rotation shows unseen questions first, then the least recently used', () => {
	const bank = makeBank(1, 3);
	const config: Config = { ...DEFAULT_CONFIG, intervals: [1], fillToSize: false };
	let state = markTaught(bank, newClass(), 's0');
	const shown: (string | undefined)[] = [];
	for (let i = 0; i < 7; i++) {
		const r = generateDoNow(bank, state, config);
		state = r.state;
		shown.push(r.doNow.items[0]?.question.id);
	}
	assert.deepEqual(shown, ['s0-q0', 's0-q1', 's0-q2', 's0-q0', 's0-q1', 's0-q2', 's0-q0']);
});

test('no taught skills: empty quiz and the lesson counter does not advance', () => {
	const bank = makeBank(2);
	const state = newClass();
	const r = generateDoNow(bank, state);
	assert.equal(r.doNow.items.length, 0);
	assert.equal(r.state.lesson, 0);
	assert.equal(r.state, state);
});

test('never more than one question per skill and never more than size', () => {
	const bank = makeBank(10);
	let state = newClass();
	for (const s of bank.skills) state = markTaught(bank, state, s.id);
	const { doNow } = generateDoNow(bank, state, SIZE4);
	assert.equal(doNow.items.length, 4);
	assert.equal(new Set(doNow.items.map((i) => i.skillId)).size, 4);
});

test('state transitions are immutable', () => {
	const bank = makeBank(2);
	const a = markTaught(bank, newClass(), 's0');
	const snapshot = structuredClone(a);
	generateDoNow(bank, a);
	assert.deepEqual(a, snapshot);
});

test('unticking a skill drops its schedule; re-ticking restarts from the current lesson', () => {
	const bank = makeBank(1);
	let state = markTaught(bank, newClass(), 's0');
	state = generateDoNow(bank, state).state;
	state = unmarkTaught(state, 's0');
	assert.equal(state.skills.s0, undefined);
	state = markTaught(bank, state, 's0');
	assert.deepEqual(state.skills.s0, { taughtAt: 1, practices: 0, lastPracticed: 1 });
});

test('markTaught rejects unknown skills', () => {
	assert.throws(() => markTaught(makeBank(1), newClass(), 'nope'), /Unknown skill/);
});

test('bank validation rejects duplicate ids and bad status', () => {
	const skill = {
		id: 'a',
		title: 't',
		topic: 'x',
		specRefs: ['4.1'],
		questions: [{ id: 'a-1', command: 'State', prompt: 'p', answer: 'a', status: 'draft' }]
	};
	assert.throws(() => buildBank([{ file: 'f.json', data: [skill, skill] }]), /duplicate id "a"/);
	const bad = { ...skill, questions: [{ ...skill.questions[0], status: 'ok' }] };
	assert.throws(() => buildBank([{ file: 'f.json', data: [bad] }]), /status/);
});

test('reviewedOnly drops draft questions and skills left empty', () => {
	const mk = (id: string, status: string) => ({
		id,
		title: 't',
		topic: 'x',
		specRefs: ['4.1'],
		questions: [{ id: `${id}-1`, command: 'State', prompt: 'p', answer: 'a', status }]
	});
	const bank = buildBank([{ file: 'f.json', data: [mk('a', 'reviewed'), mk('b', 'draft')] }], {
		reviewedOnly: true
	});
	assert.deepEqual(
		bank.skills.map((s) => s.id),
		['a']
	);
});
