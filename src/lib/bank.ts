import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Bank, Question, Skill } from './types.ts';

function fail(file: string, path: string, msg: string): never {
	throw new Error(`${file}: ${path}: ${msg}`);
}

function str(file: string, path: string, v: unknown): string {
	if (typeof v !== 'string' || v.trim() === '') fail(file, path, 'expected a non-empty string');
	return v;
}

function obj(file: string, path: string, v: unknown): Record<string, unknown> {
	if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(file, path, 'expected an object');
	return v as Record<string, unknown>;
}

function parseQuestion(file: string, path: string, raw: unknown): Question {
	const v = obj(file, path, raw);
	const status = v.status;
	if (status !== 'draft' && status !== 'reviewed') fail(file, `${path}.status`, "expected 'draft' or 'reviewed'");
	return {
		id: str(file, `${path}.id`, v.id),
		command: str(file, `${path}.command`, v.command),
		prompt: str(file, `${path}.prompt`, v.prompt),
		answer: str(file, `${path}.answer`, v.answer),
		status
	};
}

function parseSkill(file: string, path: string, raw: unknown): Skill {
	const v = obj(file, path, raw);
	if (!Array.isArray(v.specRefs) || v.specRefs.length === 0) fail(file, `${path}.specRefs`, 'expected a non-empty array');
	if (!Array.isArray(v.questions)) fail(file, `${path}.questions`, 'expected an array');
	return {
		id: str(file, `${path}.id`, v.id),
		title: str(file, `${path}.title`, v.title),
		topic: str(file, `${path}.topic`, v.topic),
		specRefs: v.specRefs.map((r: unknown, i: number) => str(file, `${path}.specRefs[${i}]`, r)),
		questions: v.questions.map((q: unknown, i: number) => parseQuestion(file, `${path}.questions[${i}]`, q))
	};
}

/** Validate parsed bank files (each an array of skills) and combine them. Throws on any structural error or duplicate id. */
export function buildBank(files: { file: string; data: unknown }[], opts: { reviewedOnly?: boolean } = {}): Bank {
	const skills: Skill[] = [];
	const ids = new Set<string>();
	for (const { file, data } of files) {
		if (!Array.isArray(data)) fail(file, '$', 'expected an array of skills');
		data.forEach((raw: unknown, i: number) => {
			const skill = parseSkill(file, `[${i}]`, raw);
			for (const id of [skill.id, ...skill.questions.map((q) => q.id)]) {
				if (ids.has(id)) fail(file, skill.id, `duplicate id "${id}"`);
				ids.add(id);
			}
			if (opts.reviewedOnly) skill.questions = skill.questions.filter((q) => q.status === 'reviewed');
			if (skill.questions.length > 0) skills.push(skill);
		});
	}
	return { skills };
}

/** Load every `*.json` in `dir`, in filename order. */
export function loadBank(dir: string, opts: { reviewedOnly?: boolean } = {}): Bank {
	const files = readdirSync(dir)
		.filter((f) => f.endsWith('.json'))
		.sort()
		.map((f) => ({ file: f, data: JSON.parse(readFileSync(join(dir, f), 'utf8')) as unknown }));
	return buildBank(files, opts);
}
