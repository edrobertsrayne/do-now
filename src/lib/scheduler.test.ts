import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBank } from './bank.ts';
import { DEFAULT_CONFIG, generateDoNow, markTaught, newClass, unmarkTaught } from './scheduler.ts';
import type { Bank, ClassState, Config } from './types.ts';

/** Several tests reason about exactly four slots; the default size is 5. */
const SIZE4: Config = { ...DEFAULT_CONFIG, size: 4 };

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

/** Run `lessons` Do Nows, returning the lessons each question appeared in. */
function appearances(bank: Bank, state: ClassState, lessons: number, config: Config) {
	const seen: Record<string, number[]> = {};
	for (let i = 0; i < lessons; i++) {
		const r = generateDoNow(bank, state, config);
		state = r.state;
		for (const item of r.doNow.items) (seen[item.question.id] ??= []).push(r.doNow.lesson);
	}
	return seen;
}

test('a single question follows 1, 2, 4, 8, 16, 32 then repeats 32', () => {
	const bank = makeBank(1, 1);
	const state = markTaught(bank, newClass(), 's0');
	const seen = appearances(bank, state, 100, { ...DEFAULT_CONFIG, fillToSize: false });
	// taught at 0: due at 1, then +2, +4, +8, +16, +32, +32
	assert.deepEqual(seen['s0-q0'], [1, 3, 7, 15, 31, 63, 95]);
});

test('padding with early skills is off when fillToSize is false', () => {
	const bank = makeBank(1, 1);
	const state = markTaught(bank, newClass(), 's0');
	const first = generateDoNow(bank, state, { ...DEFAULT_CONFIG, fillToSize: false });
	const second = generateDoNow(bank, first.state, { ...DEFAULT_CONFIG, fillToSize: false });
	assert.equal(first.doNow.items.length, 1);
	assert.equal(second.doNow.items.length, 0);
});

test('with fillToSize, early skills pad the quiz soonest-due first and are marked early', () => {
	const bank = makeBank(6, 1);
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
	const bank = makeBank(6, 1);
	// Pinned so skills practised in lesson 1 are not due again until lesson 4.
	const config: Config = { ...SIZE4, intervals: [1, 3] };
	let state = newClass();
	for (const s of bank.skills) state = markTaught(bank, state, s.id);
	state = generateDoNow(bank, state, config).state; // lesson 1: s0..s3 practised, s4/s5 not
	state = generateDoNow(bank, state, config).state; // lesson 2: s4, s5 due; s0, s1 padded early
	const before = structuredClone(state);
	const { state: after, doNow } = generateDoNow(bank, state, config); // lesson 3: only early items
	assert.ok(doNow.items.every((i) => i.reason === 'early'));
	for (const item of doNow.items) {
		assert.deepEqual(after.questions[item.question.id], before.questions[item.question.id]);
	}
	const shown = new Set(doNow.items.map((i) => i.skillId));
	assert.equal(shown.size, 4);
	// s2 and s3 were last shown in lesson 1; s0, s1, s4, s5 in lesson 2. Oldest first.
	assert.ok(shown.has('s2') && shown.has('s3'));
	assert.ok(!shown.has('s4') && !shown.has('s5'));
});

test('a newly taught skill gets a slot even when older skills are more overdue', () => {
	const bank = makeBank(8, 1);
	const config: Config = { ...DEFAULT_CONFIG, intervals: [1], size: 4 };
	let state = newClass();
	for (let i = 0; i < 6; i++) state = markTaught(bank, state, `s${i}`);
	// Skip 3 lessons of nothing by never generating: all six are overdue by the same amount.
	// Tick two more skills later; they become the latest batch.
	state = generateDoNow(bank, state, config).state; // lesson 1: 4 of the 6 practised
	state = markTaught(bank, state, 's6');
	const { doNow } = generateDoNow(bank, state, config); // lesson 2
	assert.equal(doNow.items.length, 4);
	assert.ok(doNow.items.some((i) => i.skillId === 's6' && i.reason === 'new'));
	// The other three are the most overdue: the two skills skipped in lesson 1 come first.
	const others = doNow.items.filter((i) => i.skillId !== 's6').map((i) => i.skillId);
	assert.deepEqual(others.slice(0, 2).sort(), ['s4', 's5']);
});

test('most overdue is chosen first, then earlier taught, then bank order', () => {
	const bank = makeBank(5, 1);
	const config: Config = { ...DEFAULT_CONFIG, intervals: [1], size: 2, fillToSize: false };
	let state = newClass();
	state = markTaught(bank, state, 's3'); // taught at 0
	state = generateDoNow(bank, state, config).state; // lesson 1 (s3 practised)
	state = markTaught(bank, state, 's1'); // taught at 1
	state = markTaught(bank, state, 's0'); // taught at 1
	state = markTaught(bank, state, 's2'); // taught at 1
	// lesson 2: s3 overdue 0 (due 2), s0/s1/s2 overdue 0 (due 2). Reserved new slot: first by order => s0.
	const { doNow } = generateDoNow(bank, state, config);
	assert.equal(doNow.items.length, 2);
	assert.deepEqual(
		doNow.items.map((i) => i.skillId),
		['s3', 's0']
	);
});

test('each question of a taught skill is scheduled on its own', () => {
	const bank = makeBank(1, 3);
	const config: Config = { ...DEFAULT_CONFIG, intervals: [1, 3], size: 2, fillToSize: false };
	let state = markTaught(bank, newClass(), 's0');
	const run = () => {
		const r = generateDoNow(bank, state, config);
		state = r.state;
		return r.doNow.items;
	};
	assert.deepEqual(
		run().map((i) => [i.question.id, i.reason]),
		[
			['s0-q0', 'new'],
			['s0-q1', 'due']
		]
	);
	const second = run();
	assert.deepEqual(
		second.map((i) => [i.question.id, i.overdue]),
		[['s0-q2', 1]]
	);
	assert.equal(run().length, 0);
	const fourth = run();
	assert.deepEqual(
		fourth.map((i) => [i.question.id, i.priorPractices]),
		[
			['s0-q0', 1],
			['s0-q1', 1]
		]
	);
	assert.deepEqual(
		run().map((i) => i.question.id),
		['s0-q2']
	);
});

test('no taught skills: empty quiz and the lesson counter does not advance', () => {
	const bank = makeBank(2);
	const state = newClass();
	const r = generateDoNow(bank, state);
	assert.equal(r.doNow.items.length, 0);
	assert.equal(r.state.lesson, 0);
	assert.equal(r.state, state);
});

test('never more than size; questions of one skill may share a Do Now', () => {
	const bank = makeBank(10);
	let state = newClass();
	for (const s of bank.skills) state = markTaught(bank, state, s.id);
	const { doNow } = generateDoNow(bank, state, SIZE4);
	assert.deepEqual(
		doNow.items.map((i) => i.question.id),
		['s0-q0', 's0-q1', 's0-q2', 's1-q0']
	);
});

test('state transitions are immutable', () => {
	const bank = makeBank(2);
	const a = markTaught(bank, newClass(), 's0');
	const snapshot = structuredClone(a);
	generateDoNow(bank, a);
	assert.deepEqual(a, snapshot);
});

test('unticking a skill drops its schedules; re-ticking restarts from the current lesson', () => {
	const bank = makeBank(1);
	let state = markTaught(bank, newClass(), 's0');
	state = generateDoNow(bank, state).state;
	state = unmarkTaught(bank, state, 's0');
	assert.equal(state.taught.s0, undefined);
	assert.equal(state.questions['s0-q0'], undefined);
	state = markTaught(bank, state, 's0');
	assert.equal(state.taught.s0, 1);
	const first = generateDoNow(bank, state).doNow.items[0];
	assert.equal(first?.question.id, 's0-q0');
	assert.equal(first.reason, 'new');
	assert.equal(first.priorPractices, 0);
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
