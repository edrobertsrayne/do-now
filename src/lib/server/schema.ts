import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** A class's whole state is one JSON document keyed by its code. */
export const classes = sqliteTable('classes', {
	code: text('code').primaryKey(),
	doc: text('doc').notNull(),
	updatedAt: integer('updated_at').notNull()
});
