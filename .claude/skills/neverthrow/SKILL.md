---
name: neverthrow
description: >-
  Project convention and reference for typed error handling with the neverthrow library
  (Result / ResultAsync / ok / err / safeTry). Consult whenever writing, refactoring or
  reviewing .ts code that can fail — network requests, JSON or zod parsing, filesystem
  and database calls, rendering, or any function currently returning null / {} / undefined
  to signal failure, or wrapping work in try/catch. Use it to convert a throwing or
  null-returning function into a Result, to chain fallible steps with andThen / map /
  mapErr / orElse, to collect many results with combine / combineWithAllErrors, to bridge
  a Promise with fromPromise / fromThrowable, or to decide whether a case is a failure
  (Result) or a plain absence (null). This project standardises on neverthrow, so prefer
  a returned Result over a thrown exception here.
---

# neverthrow in this project

`neverthrow` (`^8.2.0`) is how failure is expressed in this codebase. It is a dependency —
import from it directly:

```ts
import { ResultAsync, err, ok, okAsync, errAsync, safeTry } from "neverthrow";
import type { Result } from "neverthrow";
```

Pairs with [`ts-pattern`](../ts-pattern/SKILL.md): neverthrow decides *that* something failed,
`match` decides *what to do* about each failure variant. See "Matching a Result" below.

## Why we bother

`AGENTS.md` already said errors are values; before neverthrow that meant `null`, `{}` and
`failure` fields, and the compiler could not tell the three apart. A `Result<T, E>` puts the
failure in the type: you cannot read the value without deciding what happens when there is
none, `E` is a real union you can `match` over exhaustively, and the reason a rate is missing
survives from the provider all the way to the note under the table.

`throw` loses that. Nothing in the signature says a function throws, nothing says what it
throws, and one uncaught rejection in the cron job takes the process down.

## The error channel is a domain vocabulary, not `Error`

`E` is a small union of string literals — the same words the glossary uses:

```ts
// good: a closed union the caller can match exhaustively
ResultAsync<Payload, Failure>          // "session" | "unavailable" | "shape"
Result<Snapshot, "cold" | "unreadable">

// bad: nothing to branch on, and every caller re-parses a message
ResultAsync<Payload, Error>
```

Keep the raw cause (an exception, a ky error) out of the type: log it where it is caught, and
map it to a word from the vocabulary. A new variant is added to the union, and every `match`
that closed with `.exhaustive()` breaks until it is handled — that is the whole point.

## Result vs. absence — the line that matters

Not everything that returns "nothing" has failed. Reach for `Result` when an **operation could
not do its job** — a request, a parse, a read, a write, a render. Keep `null` / `undefined`
when a value is **legitimately absent** and the caller has a plain answer for it.

| Situation | Shape |
| --- | --- |
| provider request, JSON/zod parse, db read/write, PNG render | `Result` / `ResultAsync` |
| `valueOf(snapshot, id)` — no quote for this rate | `undefined`, a cell renders `n/a` |
| `dayDelta` / `weekAverage` — not enough history yet | `null`, the cell renders `—` |
| `bestOf([])` — no candidates to compare | `null` |

Wrapping absence in a `Result` buys nothing and costs a `.match()` at every call site. This is
the most common way a neverthrow migration turns into noise — do not do it.

## Constructing

```ts
ok(value);                    // Result<T, never>
err("shape");                 // Result<never, "shape">
okAsync(value);               // ResultAsync<T, never>
errAsync("session");          // ResultAsync<never, "session">
```

From code that throws or rejects:

```ts
// a Promise: map the rejection to a word from the vocabulary
ResultAsync.fromPromise(api.get(url).json<unknown>(), () => "unavailable" as const);

// a sync function that throws (JSON.parse, fs, resvg):
const parseJson = Result.fromThrowable(JSON.parse, () => "shape" as const);

// an async function that can throw *before* it returns its promise:
const load = fromAsyncThrowable(readSnapshot, () => "unreadable" as const);

// a promise that genuinely cannot reject
ResultAsync.fromSafePromise(collect());
```

`fromPromise` needs the error mapper; `fromSafePromise` does not handle rejection at all, so
only use it when the promise is built from already-safe pieces.

## Chaining

```ts
fetchRates()                          // ResultAsync<Payload, "unavailable">
  .andThen(parse)                     // + "shape" — the error unions add up
  .map((rates) => ({ rates }))        // transform the value
  .mapErr((e) => log(e) ?? e)         // transform the error
  .orElse(() => okAsync(fallback))    // recover: the error channel narrows
  .andTee((payload) => console.info(payload))  // side effect, value untouched
```

- `map` / `mapErr` — transform one channel, stay in `Result`.
- `andThen` — the next step returns a `Result` too (this is flatMap; using `map` here nests).
- `orElse` — handle the failure and possibly continue with a value.
- `andTee` / `orTee` — logging and other side effects without changing either channel.
- `asyncAndThen` — from a sync `Result` into an async step.

## Reading the value out

At the edge — a handler, `main`, a cron tick — collapse the `Result` into whatever the outside
world wants:

```ts
const text = await getStoredRates().match(
  (snapshot) => ratesMessage(snapshot),
  () => cold
);

const rates = (await getStoredRates()).unwrapOr(empty);
```

- `.match(onOk, onErr)` — both branches, one expression. On a `ResultAsync` it returns a
  `Promise`, so `await` it.
- `.unwrapOr(fallback)` — when the failure needs no explanation.
- `.isOk()` / `.isErr()` — type guards, fine in a guard clause.
- `._unsafeUnwrap()` / `._unsafeUnwrapErr()` — **tests only**. The underscore is a warning; in
  `src/` it is a `throw` in disguise.

## await and ResultAsync

`ResultAsync<T, E>` is `PromiseLike<Result<T, E>>`: awaiting it gives a `Result`, never a
rejection (as long as it was built with `fromPromise` / `fromThrowable`). That is what makes
`Promise.all` over a list of `ResultAsync` safe — no `allSettled`, no `rejected` branch:

```ts
// Result<Payload, Failure>[] — one entry per provider, none of them fatal
const results = await Promise.all(providers.map((provider) => provider.fetch()));
```

One trap comes with it: a function *typed* `() => ResultAsync<T, E>` can still throw
**synchronously**, before it ever returns the `ResultAsync` — ky builds its `Request` eagerly, so
one bad header value throws inside `provider.fetch()` itself and sails straight past every
`.andThen` downstream. When the callee is not yours to trust (an injected provider, a plugin),
guard the call, not the promise:

```ts
Promise.resolve()
  .then(() => provider.fetch())    // a sync throw here becomes a rejection
  .catch((cause) => { console.error(provider.name, cause); return err("unavailable" as const); });
```

Use `Promise.all` when every failure has to be recorded rather than propagated. Use `combine`
when the first failure should abort, and `combineWithAllErrors` when you want every error
collected:

```ts
ResultAsync.combine(list);             // ResultAsync<T[], E>      — short-circuits
ResultAsync.combineWithAllErrors(list); // ResultAsync<T[], E[]>   — collects
```

## safeTry — a straight line instead of a ladder

When several fallible steps depend on each other, `andThen` nesting gets hard to read.
`safeTry` gives Rust's `?`: `yield*` a `Result` (or a `ResultAsync` inside an async generator)
and the first failure returns from the whole block.

```ts
// src/bot.ts: the path, the existence check and the read each fail differently
const getLastSum = (ctx: UserContext) =>
  safeTry(async function* () {
    const path = `${yield* getUserPath(ctx)}/lastSumToCalculate`;   // returns early
    const exists = yield* read("user", db.exists(path));
    if (!exists) return ok(null);

    const sum = Number(yield* read("user", db.getObject<unknown>(path)));
    return ok(Number.isFinite(sum) ? sum : null);   // the body ends with a Result
  });
```

Inside an async generator `yield*` takes a `ResultAsync` directly — no `await` in front of it.
The block must return a `Result` (`ok(...)` / `err(...)`), not a bare value.

## Matching a Result

Two branches — use neverthrow's own `.match`. Branching on the **failure variants** — use
`ts-pattern`, closed with `.exhaustive()` so a new variant of the union breaks the build:

```ts
import { match } from "ts-pattern";

const note = (failure: Failure) =>
  match(failure)
    .with("session", () => "no data (no antifraud session)")
    .with("unavailable", () => "no data (provider unavailable)")
    .with("shape", () => "no data (source changed shape)")
    .exhaustive();

const text = result.match((rates) => render(rates), note);
```

`Ok` and `Err` are exported classes, so `P.instanceOf(Err)` works — but prefer `.match()`,
which narrows both channels without the import.

## Boundaries: zod, ky, fs, resvg

Every boundary produces a `Result`, and `src/result.ts` holds the shared adapters (`fromZod`
and friends). A zod `safeParse` is already a two-channel value — convert it, do not re-invent
it:

```ts
const parsed = schema.safeParse(raw);
if (!parsed.success) return err("shape");
return ok(parsed.data);
// or, with the shared helper: return fromZod(schema.safeParse(raw));
```

Partial success is not failure: a provider that reads three of its four rates returns
`ok({ ...three })`. `err("shape")` means **nothing** usable came back.

## try/catch, throw — where they may still appear

- Never in domain, provider, presentation or persistence code. Wrap the throwing call in
  `fromThrowable` / `fromPromise` at the point of contact instead.
- `src/bot.ts` throws once at import when `BOT_TOKEN` is missing: the process cannot start
  without it, and there is no caller to hand a `Result` to. That is the only sanctioned throw.
- `grammy`'s `bot.catch` stays — it is the framework's own edge, not our error handling.

## Common mistakes to avoid

- **`Result<T, Error>`.** Nothing to branch on; use the string-literal vocabulary.
- **Wrapping absence.** `Result<number, "no-history">` where `null` said it better.
- **`map` where `andThen` belongs.** A `Result<Result<T, E>, E>` means you used the wrong one.
- **`_unsafeUnwrap()` in `src/`.** It throws; that is what we are removing.
- **`await` on a `ResultAsync` you then treat as the value.** It gives you a `Result` — match it.
- **Swallowing the cause.** Map to a vocabulary word, but log the original in `mapErr`/`orTee`
  where the information still exists.
