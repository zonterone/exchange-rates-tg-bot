# Project conventions

Source of truth for structure, naming, exports, theming, and verification. The
domain glossary lives in [`CONTEXT.md`](../CONTEXT.md) — use its terms verbatim
in code, tests, and issues.

## Architecture

One Node.js process, bundled by webpack into `dist/main.cjs`. `src/main.ts`
wires the two halves together:

- a cron job (`*/30 * * * *`) runs `updateRates` — fetch all providers, accept
  valid fresh quotes, carry stale ones over marked, persist a `Snapshot`;
- a grammY bot serves everything from the stored snapshot — handlers never
  fetch.

Data flows one way: `providers → snapshot (db) → presentation`. Presentation
modules read the snapshot and nothing else.

| Module               | Owns                                                          |
| -------------------- | ------------------------------------------------------------- |
| `src/rates.ts`       | domain core: rate ids, units, sanity ranges, the provider registry, `Snapshot`; no I/O |
| `src/providers/*`    | one file per source: a `Provider` and its pure `parse`        |
| `src/updateRates.ts` | the update cycle and snapshot merging                         |
| `src/trend.ts`       | history pruning, 24h delta, 7d average                        |
| `src/format.ts`      | cell/number/age formatting, currency symbols                  |
| `src/table.ts`       | monospace grid shared by all text messages                    |
| `src/messages.ts`    | HTML messages and the card caption                            |
| `src/card.ts`        | SVG card layout and theme                                     |
| `src/image.ts`       | resvg rasterisation and the per-update PNG cache              |
| `src/bot.ts`         | grammY handlers, sum parsing, card `file_id` reuse            |
| `src/db.ts`          | json-db init and the oversized-file guard                     |
| `src/session.ts`     | mints and caches the MultiTransfer antifraud session in headless chromium |
| `src/env.ts`         | loads `.env` and exposes every environment variable           |
| `src/result.ts`      | the shared neverthrow adapters (zod, promises) every boundary uses |

## Adding a provider

1. New file in `src/providers/` exporting a `Provider` (`{ name, ids, fetch }`)
   and a **pure, exported `parse`** so tests can feed it fixtures.
2. Validate responses with zod `safeParse`; on any shape mismatch return
   `err("shape")` — a parse never throws and never returns a bare value.
   Validate the one element you need, not the whole list: a broken neighbour
   must not cost the rates that parsed fine, and partial success is still
   `ok({...})`.
3. Register it in `src/providers/index.ts`; add its ids to `rateIds`,
   `providerOf` and `providerNames` in `src/rates.ts` (a new unit needs a new
   sanity range there).
4. Add an entry to `transfers` or `exchanges` in `src/rates.ts` — that registry
   is what both renderers read. A provider missing from it is fetched, stored
   and never shown.
5. `fetch` returns `ResultAsync<Payload, Failure>` and never rejects: a request
   that fails is `err("unavailable")`, an antifraud rejection is
   `err("session")`, an unreadable answer is `err("shape")`.
6. Use the shared `api` (ky with retries, GET and POST alike), `userAgent`,
   `request` and `body` from `src/providers/types.ts` — no `try/catch` and no
   `fromPromise` of your own. `request(name, api.get(…))` owns the
   `unavailable` word, `body(name, res)` reads the json and owns `shape`, and
   between them they are the only place a provider's raw cause is logged.
   Keeping the two steps apart is what tells a source that never answered from
   one that answered with a page we cannot read.
7. Record a real response in `test/fixtures/` and cover `parse` in
   `test/core.test.js`; check the live endpoint with `npm run probe`.

## Naming and exports

- Rate ids are `<unit>.<source>` (`rubPerUsd.unired`); the unit prefix decides
  formatting, sanity range, and reading direction (see `CONTEXT.md`).
- Named exports only; no default exports (`webpack.config.ts` is the one
  exception).
- Prefer single-word camelCase names; reach for a second word only when one
  would mislead.
- Types over interfaces; rely on inference, annotate only where exports or
  clarity demand it.

## Style

- Strict tsconfig is the guard-rail (`exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`, unused code is an error) — new code must compile
  clean.
- `unknown` at every boundary, never `any`; narrow with zod or a type guard.
- Guard clauses and early returns over `else`; arrow functions; functional
  array methods — `flatMap` returning `[]` is the house filter-map idiom.
- Comments only where the code can't say it: start lowercase, explain why.
- Branching over a fixed union: `ts-pattern` per `AGENTS.md` — `match` closed
  with `.exhaustive()`, so a new variant of `Mode` or `Failure` breaks the
  build instead of falling into a default. A one-off ternary over two trivial
  outcomes may stay a ternary; a third outcome is a `match`, and a nested
  ternary always is.

## Errors

Failure is a value with a type: `Result` / `ResultAsync` from `neverthrow`
([ADR 0002](adr/0002-errors-as-values-with-neverthrow.md), full reference in
`.claude/skills/neverthrow/SKILL.md`).

- Anything that can fail — a request, a zod or JSON parse, a db read or write, a
  PNG render — returns a `Result`. Nothing in `src/` throws, and `try/catch`
  appears nowhere: the throwing call is wrapped in `fromPromise` /
  `fromThrowable` where it is made.
- The error channel is a closed union of string literals, never `Error` and
  never a free-form message. Branch over it with `match(...).exhaustive()`. A
  provider's `Failure` (`session` / `unavailable` / `shape`) is a domain word
  and is defined in `CONTEXT.md`; the rest are one-word technical vocabularies
  local to their boundary (`"cold" | "unreadable"`, `"store"`, `"render"`,
  `"unmovable"`, `"telegram"`, `"unidentified"`). One word, one reason, no
  glossary entry needed unless a user ever reads it.
- Absence is not failure. A missing quote is `undefined`, a trend with too
  little history is `null`, no candidate to compare is `null` — those render as
  `n/a` or `—` and stay as they are.
- Log the original cause once, where it is caught (inside the `fromPromise` /
  `fromThrowable` mapper), and carry only the word onward. An edge may log what
  the word costs ("not starting"), never the cause a second time.
- The shared bridges live in `src/result.ts` (`fromZod`, `read`, `write`) and
  `src/providers/types.ts` (`request`, `body`). Reach for one before writing a
  `fromPromise` by hand — that is how the log stays in one place.
- `_unsafeUnwrap()` belongs in tests and nowhere else. Three edges are exempt
  from "nothing throws": the missing `BOT_TOKEN` at import in `src/bot.ts`,
  grammY's own `bot.catch`, and the outermost `main().catch` / `probe().catch`
  — a net under an unforeseen rejection, not a way to handle a known one.

## Theming

All card colours live in the `theme` object in `src/card.ts` — no colour
literals anywhere else. Text is Noto Sans Mono from `assets/`, and every width
in the layout is arithmetic on its 0.6 em glyph advance; the card renders at 2×
(`density` in `src/image.ts`). The card depends on the snapshot alone — that is
what makes the per-update PNG cache and the Telegram `file_id` reuse correct.

## Secrets

No token, session id, or path literal in the source: `src/env.ts` is the only
module that touches `process.env`, and it loads `.env` on import so importers
never race the loader. A new variable goes into `env`, into `.env.example`, and
into the README table; `.env` itself stays gitignored, and production passes it
with `docker run --env-file`. Missing configuration degrades — with no
`CHROMIUM_PATH` to mint with, MultiTransfer reports a `session` failure rather
than throwing — except `BOT_TOKEN`, without which the process cannot start.
The image sets `CHROMIUM_PATH` itself, so nothing but the token is required to
run it.

## Persistence

json-db file at `DB_PATH` (default `db/db.json`): `/rates` holds the single
`Snapshot`, `/users/<chat>/<user>` the last entered sum. History is pruned to
8 days on every read and write; at startup a file over 10 MB or one that no
longer parses is moved aside, never truncated — writes are not atomic, and
json-db throws on every call for the rest of the process once a load fails.

Everything read back from the file is validated exactly like a provider
response (`toQuotes` / `toFees` / `toFailures` in `src/updateRates.ts`): a quote
outside its sanity range, an unknown rate id or a failure the code cannot
explain is dropped rather than passed to the formatters.

## Verification

- `npm test` — offline unit tests on recorded fixtures; must pass.
- `npm run build` — the production bundle must compile clean.
- `npm run probe` — hits the five live endpoints and prints what parsed; the
  only check that catches a source that changed shape or a MultiTransfer mint
  the antifraud has started refusing
  ([ADR 0001](adr/0001-multitransfer-antifraud-session.md)). It is bundled into
  the image too, so a deployed container answers the same question with
  `node probe.cjs`.
