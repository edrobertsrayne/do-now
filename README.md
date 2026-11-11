# GCSE Physics retrieval tool

Spaced-retrieval Do Nows for AQA GCSE Physics, after Craig Barton's Ultimate
Retrieval Tool. Design choices and open risks: [DECISIONS.md](DECISIONS.md).

## Layout

- `bank/*.json` - skills and their recall questions (all `draft` until reviewed; spec refs need checking against the AQA spec).
- `src/lib/scheduler.ts` - pure scheduler: `markTaught`, `unmarkTaught`, `generateDoNow`.
- `src/lib/bank.ts` - bank loader and validation.
- `cli/simulate.ts` - simulate a run of lessons and report scheduling health.
- `src/routes/` - SvelteKit app: home (create/open class), `c/[code]` (taught checklist, Do Now size, generate), `project` (fullscreen Think -> Check view), `print` (one-page sheet), `key` (teacher answer key).
- `src/lib/server/` - class codes, `node:sqlite` store (one JSON document per class), bank/store singletons.

## Commands

```sh
npm test                                   # scheduler, bank and server-module tests (Node, no build)
npm run typecheck
npm run simulate -- --lessons 40 --teach-every 2 [--reviewed-only] [--quiet]
npm run dev                                # web app, dev server
npm run build && npm start                 # production server (adapter-node)
```

Env: `DB_PATH` (default `data/retrieval.db`), `BANK_DIR` (default `bank/`), `PORT`, and `ORIGIN` (required behind a proxy for form posts).

Requires Node with TypeScript type stripping and `node:sqlite` (Node 24+). TypeScript is pinned to 6.x because SvelteKit 3 needs the TypeScript JS API, which TypeScript 7 does not provide.
