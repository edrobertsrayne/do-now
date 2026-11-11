import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newClass } from '../scheduler.ts';
import type { ClassDoc } from '../types.ts';
import { CODE_ALPHABET, CODE_LENGTH, generateCode, normaliseCode } from './classCode.ts';
import { createStore } from './store.ts';

const doc = (size = 5): ClassDoc => ({
	course: 'aqa-gcse-physics',
	state: newClass(),
	size,
	doNow: null
});

test('class codes are 8 characters from the unambiguous alphabet', () => {
	for (const bad of ['0', 'O', '1', 'I', 'L']) assert.ok(!CODE_ALPHABET.includes(bad), bad);
	for (let i = 0; i < 200; i++) {
		const code = generateCode();
		assert.equal(code.length, CODE_LENGTH);
		assert.ok(
			[...code].every((c) => CODE_ALPHABET.includes(c)),
			code
		);
		assert.equal(normaliseCode(code), code);
	}
});

test('normaliseCode tolerates case, spaces and dashes and rejects malformed codes', () => {
	assert.equal(normaliseCode('abcd-2345'), 'ABCD2345');
	assert.equal(normaliseCode(' abcd 2345 '), 'ABCD2345');
	assert.equal(normaliseCode('ABCD234'), null); // too short
	assert.equal(normaliseCode('ABCD2340'), null); // contains 0
	assert.equal(normaliseCode(''), null);
});

test('store round-trips a class document and refuses duplicate or unknown codes', () => {
	const store = createStore(':memory:');
	assert.equal(store.get('ABCD2345'), null);
	assert.equal(store.save('ABCD2345', doc()), false);
	assert.equal(store.create('ABCD2345', doc()), true);
	assert.equal(store.create('ABCD2345', doc(6)), false);
	assert.deepEqual(store.get('ABCD2345'), doc());
	assert.equal(store.save('ABCD2345', doc(6)), true);
	assert.equal(store.get('ABCD2345')?.size, 6);
});

test('a class document saved before courses existed reads back as GCSE Physics', () => {
	const store = createStore(':memory:');
	const { course: _course, ...legacy } = doc();
	store.create('ABCD2345', legacy as ClassDoc);
	assert.equal(store.get('ABCD2345')?.course, 'aqa-gcse-physics');
});
