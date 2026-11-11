import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Bank, Library, Question, Skill } from './types.ts';

/** Per-course metadata file, beside the course's topic files: `{"name": "OCR A-Level Physics"}`. */
export const COURSE_FILE = 'course.json';

function fail(file: string, path: string, msg: string): never {
	throw new Error(`${file}: ${path}: ${msg}`);
}

function str(file: string, path: string, v: unknown): string {
	if (typeof v !== 'string' || v.trim() === '') fail(file, path, 'expected a non-empty string');
	return v;
}

function obj(file: string, path: string, v: unknown): Record<string, unknown> {
	if (typeof v !== 'object' || v === null || Array.isArray(v))
		fail(file, path, 'expected an object');
	return v as Record<string, unknown>;
}

function parseQuestion(file: string, path: string, raw: unknown): Question {
	const v = obj(file, path, raw);
	const status = v.status;
	if (status !== 'draft' && status !== 'reviewed')
		fail(file, `${path}.status`, "expected 'draft' or 'reviewed'");
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
	if (!Array.isArray(v.specRefs) || v.specRefs.length === 0)
		fail(file, `${path}.specRefs`, 'expected a non-empty array');
	if (!Array.isArray(v.questions)) fail(file, `${path}.questions`, 'expected an array');
	return {
		id: str(file, `${path}.id`, v.id),
		title: str(file, `${path}.title`, v.title),
		topic: str(file, `${path}.topic`, v.topic),
		specRefs: v.specRefs.map((r: unknown, i: number) => str(file, `${path}.specRefs[${i}]`, r)),
		questions: v.questions.map((q: unknown, i: number) =>
			parseQuestion(file, `${path}.questions[${i}]`, q)
		)
	};
}

/** Validate parsed bank files (each an array of skills) and combine them. Throws on any structural error or duplicate id. */
export function buildBank(
	files: { file: string; data: unknown }[],
	opts: { reviewedOnly?: boolean } = {}
): Bank {
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
			if (opts.reviewedOnly)
				skill.questions = skill.questions.filter((q) => q.status === 'reviewed');
			if (skill.questions.length > 0) skills.push(skill);
		});
	}
	return { skills };
}

/** Topic files of one course directory, in filename order (everything `*.json` except `course.json`). */
export function topicFiles(courseDir: string): string[] {
	return readdirSync(courseDir)
		.filter((f) => f.endsWith('.json') && f !== COURSE_FILE)
		.sort();
}

/** Course ids under a bank directory: every subdirectory holding a `course.json`, in name order. */
export function courseIds(bankDir: string): string[] {
	return readdirSync(bankDir, { withFileTypes: true })
		.filter((d) => d.isDirectory() && readdirSync(join(bankDir, d.name)).includes(COURSE_FILE))
		.map((d) => d.name)
		.sort();
}

/** Read and validate a course's display name. */
export function readCourseName(courseDir: string): string {
	const raw: unknown = JSON.parse(readFileSync(join(courseDir, COURSE_FILE), 'utf8'));
	return str(COURSE_FILE, 'name', obj(COURSE_FILE, '$', raw).name);
}

/** Load every topic file in one course directory. */
export function loadBank(courseDir: string, opts: { reviewedOnly?: boolean } = {}): Bank {
	const files = topicFiles(courseDir).map((f) => ({
		file: f,
		data: JSON.parse(readFileSync(join(courseDir, f), 'utf8')) as unknown
	}));
	return buildBank(files, opts);
}

/** Load every course under `dir` (`dir/<course-id>/{course.json,*.json}`). */
export function loadLibrary(dir: string, opts: { reviewedOnly?: boolean } = {}): Library {
	return {
		courses: courseIds(dir).map((id) => {
			const courseDir = join(dir, id);
			return { id, name: readCourseName(courseDir), bank: loadBank(courseDir, opts) };
		})
	};
}
