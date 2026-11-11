import { join } from 'node:path';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'sqlite',
	schema: './src/lib/server/schema.ts',
	out: './drizzle',
	dbCredentials: { url: process.env.DB_PATH ?? join(process.cwd(), 'data', 'retrieval.db') }
});
