import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ClassDoc } from '../types.ts';

export interface Store {
	get(code: string): ClassDoc | null;
	/** Insert a new class. Returns false if the code is already taken. */
	create(code: string, doc: ClassDoc): boolean;
	/** Overwrite an existing class document. Returns false if the code is unknown. */
	save(code: string, doc: ClassDoc): boolean;
}

/** A class's whole state is one JSON document keyed by its code. */
export function createStore(path: string): Store {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	const db = new DatabaseSync(path);
	db.exec(
		'CREATE TABLE IF NOT EXISTS classes (code TEXT PRIMARY KEY, doc TEXT NOT NULL, updated_at INTEGER NOT NULL)'
	);
	const select = db.prepare('SELECT doc FROM classes WHERE code = ?');
	const insert = db.prepare(
		'INSERT OR IGNORE INTO classes (code, doc, updated_at) VALUES (?, ?, ?)'
	);
	const update = db.prepare('UPDATE classes SET doc = ?, updated_at = ? WHERE code = ?');
	return {
		get(code) {
			const row = select.get(code) as { doc: string } | undefined;
			return row ? (JSON.parse(row.doc) as ClassDoc) : null;
		},
		create(code, doc) {
			return Number(insert.run(code, JSON.stringify(doc), Date.now()).changes) === 1;
		},
		save(code, doc) {
			return Number(update.run(JSON.stringify(doc), Date.now(), code).changes) === 1;
		}
	};
}
