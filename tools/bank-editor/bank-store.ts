// Read/modify/write layer for bank/<course>/*.json. Every mutation re-reads the course's files
// from disk, applies the change, validates the whole course with the app's own loader, then
// rewrites only the touched file in the repo's hand-formatted style (one question per line).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildBank, courseIds, readCourseName, topicFiles } from '../../src/lib/bank.ts';
import type { Question, QuestionStatus, Skill } from '../../src/lib/types.ts';

export interface QuestionInput {
	command: string;
	prompt: string;
	answer: string;
	status: QuestionStatus;
}

export interface BankFile {
	file: string;
	skills: Skill[];
}

export interface CourseFiles {
	id: string;
	name: string;
	files: BankFile[];
}

export class HttpError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

const j = JSON.stringify;

function formatQuestion(q: Question): string {
	return `{"id": ${j(q.id)}, "command": ${j(q.command)}, "prompt": ${j(q.prompt)}, "answer": ${j(q.answer)}, "status": ${j(q.status)}}`;
}

function formatSkill(s: Skill): string {
	const qs = s.questions.map((q) => `\t\t\t${formatQuestion(q)}`).join(',\n');
	return [
		'\t{',
		`\t\t"id": ${j(s.id)},`,
		`\t\t"title": ${j(s.title)},`,
		`\t\t"topic": ${j(s.topic)},`,
		`\t\t"specRefs": [${s.specRefs.map((r) => j(r)).join(', ')}],`,
		s.questions.length ? `\t\t"questions": [\n${qs}\n\t\t]` : '\t\t"questions": []',
		'\t}'
	].join('\n');
}

export function formatBankFile(skills: Skill[]): string {
	return `[\n${skills.map(formatSkill).join(',\n')}\n]\n`;
}

function cleanInput(raw: unknown): QuestionInput {
	if (typeof raw !== 'object' || raw === null) throw new HttpError(400, 'expected an object');
	const v = raw as Record<string, unknown>;
	for (const k of ['command', 'prompt', 'answer'] as const) {
		if (typeof v[k] !== 'string' || v[k].trim() === '')
			throw new HttpError(400, `${k} must be a non-empty string`);
	}
	if (v.status !== 'draft' && v.status !== 'reviewed')
		throw new HttpError(400, "status must be 'draft' or 'reviewed'");
	return {
		command: (v.command as string).trim(),
		prompt: (v.prompt as string).trim(),
		answer: (v.answer as string).trim(),
		status: v.status
	};
}

export class BankStore {
	#dir: string;
	#countersPath: string;

	constructor(bankDir: string, countersPath: string) {
		this.#dir = bankDir;
		this.#countersPath = countersPath;
	}

	#courseDir(course: string): string {
		// Matching against the directory listing also rules out path traversal.
		if (!courseIds(this.#dir).includes(course)) throw new HttpError(404, `no course "${course}"`);
		return join(this.#dir, course);
	}

	#read(course: string): BankFile[] {
		const dir = this.#courseDir(course);
		return topicFiles(dir).map((file) => ({
			file,
			skills: JSON.parse(readFileSync(join(dir, file), 'utf8')) as Skill[]
		}));
	}

	#validate(files: BankFile[]): void {
		try {
			buildBank(files.map((f) => ({ file: f.file, data: f.skills })));
		} catch (e) {
			throw new HttpError(400, (e as Error).message);
		}
	}

	#write(course: string, f: BankFile): void {
		writeFileSync(join(this.#courseDir(course), f.file), formatBankFile(f.skills));
	}

	#loadCounters(): Record<string, number> {
		return existsSync(this.#countersPath)
			? (JSON.parse(readFileSync(this.#countersPath, 'utf8')) as Record<string, number>)
			: {};
	}

	#saveCounters(counters: Record<string, number>): void {
		writeFileSync(this.#countersPath, j(counters, null, '\t') + '\n');
	}

	/**
	 * Highest number ever issued per skill, keyed `<course>/<skill id>` (skill ids are only
	 * unique within a course). Raised to the highest number currently on disk on every read,
	 * so a deleted question's number is never handed out again.
	 */
	#counters(course: string, files: BankFile[]): Record<string, number> {
		const counters = this.#loadCounters();
		let changed = !existsSync(this.#countersPath);
		for (const { skills } of files) {
			for (const s of skills) {
				const key = `${course}/${s.id}`;
				const re = new RegExp(`^${s.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`);
				let max = counters[key] ?? 0;
				for (const q of s.questions) {
					const n = Number(re.exec(q.id)?.[1] ?? 0);
					if (n > max) max = n;
				}
				if (max !== (counters[key] ?? 0) || !(key in counters)) {
					counters[key] = max;
					changed = true;
				}
			}
		}
		if (changed) this.#saveCounters(counters);
		return counters;
	}

	list(): CourseFiles[] {
		return courseIds(this.#dir).map((id) => {
			const files = this.#read(id);
			this.#counters(id, files);
			return { id, name: readCourseName(join(this.#dir, id)), files };
		});
	}

	#find(files: BankFile[], questionId: string) {
		for (const f of files)
			for (const s of f.skills) {
				const i = s.questions.findIndex((q) => q.id === questionId);
				if (i !== -1) return { file: f, skill: s, index: i };
			}
		throw new HttpError(404, `no question "${questionId}"`);
	}

	add(course: string, skillId: string, raw: unknown): Question {
		const input = cleanInput(raw);
		const files = this.#read(course);
		const counters = this.#counters(course, files);
		const file = files.find((f) => f.skills.some((s) => s.id === skillId));
		const skill = file?.skills.find((s) => s.id === skillId);
		if (!file || !skill) throw new HttpError(404, `no skill "${skillId}" in course "${course}"`);
		const key = `${course}/${skillId}`;
		const n = (counters[key] ?? 0) + 1;
		const q: Question = { id: `${skillId}-${n}`, ...input };
		skill.questions.push(q);
		this.#validate(files);
		counters[key] = n;
		this.#write(course, file);
		this.#saveCounters(counters);
		return q;
	}

	update(course: string, questionId: string, raw: unknown): Question {
		const input = cleanInput(raw);
		const files = this.#read(course);
		const { file, skill, index } = this.#find(files, questionId);
		const q: Question = { id: questionId, ...input };
		skill.questions[index] = q;
		this.#validate(files);
		this.#write(course, file);
		return q;
	}

	remove(course: string, questionId: string): void {
		const files = this.#read(course);
		this.#counters(course, files); // record the number before it disappears
		const { file, skill, index } = this.#find(files, questionId);
		skill.questions.splice(index, 1);
		this.#validate(files);
		this.#write(course, file);
	}
}
