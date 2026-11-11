// Local question-bank editor. Dev machine only: binds to loopback.
//
//   npm run bank-editor            # http://127.0.0.1:5175  (PORT=... to change)

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BankStore, HttpError } from './bank-store.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const bankDir = process.env.BANK_DIR ?? fileURLToPath(new URL('../../bank', import.meta.url));
const port = Number(process.env.PORT ?? 5175);
const host = '127.0.0.1';

const store = new BankStore(bankDir, `${here}id-counters.json`);

function send(res: ServerResponse, status: number, body: unknown): void {
	res.writeHead(status, { 'content-type': 'application/json' });
	res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
	if (!req.headers['content-type']?.startsWith('application/json'))
		throw new HttpError(415, 'content-type must be application/json');
	const chunks: Buffer[] = [];
	for await (const c of req) chunks.push(c as Buffer);
	try {
		return JSON.parse(Buffer.concat(chunks).toString('utf8'));
	} catch {
		throw new HttpError(400, 'invalid JSON');
	}
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
	try {
		// DNS-rebinding guard: only answer to our own loopback origin.
		const hostHeader = req.headers.host ?? '';
		if (hostHeader !== `${host}:${port}` && hostHeader !== `localhost:${port}`)
			throw new HttpError(403, 'bad host');

		const url = new URL(req.url ?? '/', `http://${hostHeader}`);
		const path = url.pathname;

		if (req.method === 'GET' && path === '/') {
			res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
			res.end(readFileSync(`${here}index.html`));
			return;
		}
		if (req.method === 'GET' && path === '/api/bank') return send(res, 200, store.list());

		const coll = /^\/api\/courses\/([^/]+)\/questions$/.exec(path);
		if (coll && req.method === 'POST') {
			const body = (await readJson(req)) as { skillId?: unknown } | null;
			if (typeof body?.skillId !== 'string') throw new HttpError(400, 'skillId required');
			return send(res, 201, store.add(decodeURIComponent(coll[1] ?? ''), body.skillId, body));
		}

		const m = /^\/api\/courses\/([^/]+)\/questions\/([^/]+)$/.exec(path);
		if (m) {
			const course = decodeURIComponent(m[1] ?? '');
			const id = decodeURIComponent(m[2] ?? '');
			if (req.method === 'PUT')
				return send(res, 200, store.update(course, id, await readJson(req)));
			if (req.method === 'DELETE') {
				store.remove(course, id);
				return send(res, 204, undefined);
			}
		}
		throw new HttpError(404, 'not found');
	} catch (e) {
		if (e instanceof HttpError) return send(res, e.status, { error: e.message });
		console.error(e);
		send(res, 500, { error: (e as Error).message });
	}
}

const server = createServer((req, res) => {
	void handle(req, res);
});

server.listen(port, host, () => console.log(`Bank editor: http://${host}:${port}  (${bankDir})`));
