# GCSE Physics retrieval tool

Spaced-retrieval Do Nows for AQA GCSE Physics, after Craig Barton's Ultimate
Retrieval Tool. Design choices and open risks: [DECISIONS.md](DECISIONS.md).

## Layout

- `bank/*.json` - skills and their recall questions (all `draft` until reviewed; spec refs need checking against the AQA spec).
- `src/lib/scheduler.ts` - pure scheduler: `markTaught`, `unmarkTaught`, `generateDoNow`.
- `src/lib/bank.ts` - bank loader and validation.
- `cli/simulate.ts` - simulate a run of lessons and report scheduling health.

## Commands

```sh
npm test                                   # scheduler + bank tests (Node, no build)
npm run typecheck
npm run simulate -- --lessons 40 --teach-every 2 [--reviewed-only] [--quiet]
```

Requires Node with TypeScript type stripping (Node 24+).

## Next

SvelteKit app: class code, taught checklist, Do Now generation, projector / print / answer-key views, SQLite persistence.
