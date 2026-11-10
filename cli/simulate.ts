// Simulate a run of lessons: teach one new skill every `--teach-every` lessons
// (bank order), generate a Do Now each lesson, and report scheduling health.
//
//   node cli/simulate.ts [--lessons 40] [--teach-every 2] [--size 4] [--reviewed-only] [--quiet]

import { parseArgs } from 'node:util';
import { loadBank } from '../src/lib/bank.ts';
import { DEFAULT_CONFIG, generateDoNow, markTaught, newClass } from '../src/lib/scheduler.ts';

const { values } = parseArgs({
	options: {
		lessons: { type: 'string', default: '40' },
		'teach-every': { type: 'string', default: '2' },
		size: { type: 'string', default: String(DEFAULT_CONFIG.size) },
		'reviewed-only': { type: 'boolean', default: false },
		quiet: { type: 'boolean', default: false }
	}
});

const lessons = Number(values.lessons);
const teachEvery = Number(values['teach-every']);
const config = { ...DEFAULT_CONFIG, size: Number(values.size) };
const bank = loadBank(new URL('../bank', import.meta.url).pathname, { reviewedOnly: values['reviewed-only'] });

let state = newClass();
let nextSkill = 0;
let padded = 0;
let short = 0;
let maxOverdue = 0;
const repeats: Record<string, number> = {};

for (let lesson = 1; lesson <= lessons; lesson++) {
	let taught = '';
	// Teaching happens after the previous Do Now, so it is ticked at counter = lesson - 1.
	if ((lesson - 1) % teachEvery === 0 && nextSkill < bank.skills.length) {
		const skill = bank.skills[nextSkill++]!;
		state = markTaught(bank, state, skill.id);
		taught = skill.id;
	}
	const result = generateDoNow(bank, state, config);
	state = result.state;
	const { items } = result.doNow;
	if (items.length === 0) {
		if (!values.quiet) console.log(`Lesson ${lesson}: nothing taught yet`);
		continue;
	}
	if (items.length < config.size) short++;
	for (const item of items) {
		if (item.reason === 'early') padded++;
		maxOverdue = Math.max(maxOverdue, item.overdue);
		if (item.priorPractices >= 3) repeats[item.question.id] = (repeats[item.question.id] ?? 0) + 1;
	}
	if (!values.quiet) {
		console.log(`Lesson ${result.doNow.lesson}${taught ? `  (taught: ${taught})` : ''}`);
		for (const item of items) {
			const tag = `${item.reason}${item.overdue > 0 ? ` +${item.overdue}` : ''}`;
			console.log(`  [${tag.padEnd(7)}] ${item.skillId} #${item.priorPractices + 1}  ${item.question.prompt}`);
		}
	}
}

const practices = Object.entries(state.skills).map(([id, s]) => `${id}=${s.practices}`);
console.log(`\nAfter ${lessons} lessons (${nextSkill}/${bank.skills.length} skills taught, one every ${teachEvery}):`);
console.log(`  Do Nows shorter than ${config.size}: ${short}`);
console.log(`  Early (padding) items: ${padded}`);
console.log(`  Max lessons overdue when picked: ${maxOverdue}`);
console.log(`  Questions shown at 4th+ practice (repeats): ${Object.keys(repeats).length}`);
console.log(`  Practice counts: ${practices.join(' ')}`);
