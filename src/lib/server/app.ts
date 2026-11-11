import { error } from '@sveltejs/kit';
import { join } from 'node:path';
import { loadBank } from '../bank.ts';
import { DEFAULT_CONFIG, newClass } from '../scheduler.ts';
import type { Bank, ClassDoc } from '../types.ts';
import { normaliseCode } from './classCode.ts';
import { createStore, type Store } from './store.ts';

let store: Store | undefined;
let bank: Bank | undefined;

export function getStore(): Store {
	return (store ??= createStore(
		process.env.DB_PATH ?? join(process.cwd(), 'data', 'retrieval.db')
	));
}

export function getBank(): Bank {
	return (bank ??= loadBank(process.env.BANK_DIR ?? join(process.cwd(), 'bank')));
}

export function newDoc(): ClassDoc {
	return { state: newClass(), size: DEFAULT_CONFIG.size, doNow: null };
}

/** Resolve a class code from a URL; 404 if malformed or unknown. */
export function openClass(rawCode: string): { code: string; doc: ClassDoc } {
	const code = normaliseCode(rawCode);
	const doc = code ? getStore().get(code) : null;
	if (!code || !doc) error(404, 'No class with that code');
	return { code, doc };
}
