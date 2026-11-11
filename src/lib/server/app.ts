import { error } from '@sveltejs/kit';
import { join } from 'node:path';
import { loadLibrary } from '../bank.ts';
import { DEFAULT_CONFIG, newClass } from '../scheduler.ts';
import type { Bank, ClassDoc, Course, Library } from '../types.ts';
import { normaliseCode } from './classCode.ts';
import { createStore, type Store } from './store.ts';

let store: Store | undefined;
let library: Library | undefined;

export function getStore(): Store {
	return (store ??= createStore(
		process.env.DB_PATH ?? join(process.cwd(), 'data', 'retrieval.db')
	));
}

export function getLibrary(): Library {
	return (library ??= loadLibrary(process.env.BANK_DIR ?? join(process.cwd(), 'bank')));
}

export function getCourse(id: string): Course {
	const course = getLibrary().courses.find((c) => c.id === id);
	if (!course) error(500, `This class's course "${id}" is not in the question bank`);
	return course;
}

export function getBank(courseId: string): Bank {
	return getCourse(courseId).bank;
}

export function newDoc(course: string): ClassDoc {
	return { course, state: newClass(), size: DEFAULT_CONFIG.size, doNow: null };
}

/** Resolve a class code from a URL; 404 if malformed or unknown. */
export function openClass(rawCode: string): { code: string; doc: ClassDoc } {
	const code = normaliseCode(rawCode);
	const doc = code ? getStore().get(code) : null;
	if (!code || !doc) error(404, 'No class with that code');
	return { code, doc };
}
