import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadLibrary } from './bank.ts';

const skill = (id: string) => [
	{
		id,
		title: id,
		topic: 't',
		specRefs: ['1.1'],
		questions: [{ id: `${id}-1`, command: 'State', prompt: 'p', answer: 'a', status: 'draft' }]
	}
];

function course(root: string, id: string, name: string, files: Record<string, unknown>) {
	mkdirSync(join(root, id));
	writeFileSync(join(root, id, 'course.json'), JSON.stringify({ name }));
	for (const [f, data] of Object.entries(files))
		writeFileSync(join(root, id, f), JSON.stringify(data));
}

test('library loads each course directory separately, so ids may repeat across courses', () => {
	const root = mkdtempSync(join(tmpdir(), 'bank-'));
	course(root, 'b-course', 'B', { '1.json': skill('shared') });
	course(root, 'a-course', 'A', { '1.json': skill('shared'), '2.json': skill('other') });
	mkdirSync(join(root, 'not-a-course')); // no course.json: ignored
	const lib = loadLibrary(root);
	assert.deepEqual(
		lib.courses.map((c) => [c.id, c.name, c.bank.skills.map((s) => s.id)]),
		[
			['a-course', 'A', ['shared', 'other']],
			['b-course', 'B', ['shared']]
		]
	);
});

test('ids must still be unique within a course', () => {
	const root = mkdtempSync(join(tmpdir(), 'bank-'));
	course(root, 'c', 'C', { '1.json': skill('x'), '2.json': skill('x') });
	assert.throws(() => loadLibrary(root), /duplicate id "x"/);
});
