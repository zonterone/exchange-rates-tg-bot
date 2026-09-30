---
name: ts-pattern
description: >-
  Project convention and reference for pattern matching with the ts-pattern library
  (match / .with / P / .exhaustive). Consult whenever writing, refactoring, or reviewing
  .ts/.tsx branching logic — switch statements, if/else chains over a discriminated union
  or a fixed set of literals, status/state handling, reducers, or conditional JSX that
  picks a component/element by variant. Use it to convert a switch to match, to add an
  exhaustiveness guarantee, or to look up the right P combinator (P.select, P.union,
  P.when, P.string, P.number, P.instanceOf, P.optional, isMatching). This project
  standardises on ts-pattern, so prefer match over hand-rolled switch/if-else here.
---

# ts-pattern in this project

`ts-pattern` (`^5.9.0`) is the standard way to branch in this codebase. It is already a
dependency — import from it directly:

```ts
import { match, P } from "ts-pattern";
```

## Why we bother

The payoff is `.exhaustive()`. When you match over a known union and close with it, TypeScript
makes "you forgot a case" a **compile error**. Add a new variant to the union and the build
breaks at every `match` that doesn't handle it — you get a to-do list from the compiler instead
of a runtime surprise in production. A `switch` gives you no such guarantee (a missing `case`
just falls through or hits `default`), and an `if/else` chain gives you even less.

The secondary payoff is inference: `P.select()` extracts a value and hands your callback the
correctly narrowed type, so you branch and destructure in one place without casts.

## When to use it — and when not to

Reach for `match` when there are **three or more branches**, when an **exhaustiveness guarantee
matters** (anything keyed off a discriminated union / status / action type), or when you're
**destructuring or guarding on shape**. Conditional JSX that renders a different element per
variant is a prime case.

Leave it alone when `match` would only add ceremony:

- a single boolean `if`, or an early-return guard clause (`if (!user) return null;`)
- a one-off ternary for two trivial outcomes
- plain iteration / data transforms — `match` is for branching, not looping

Forcing `match` into those spots makes code longer, not clearer. The goal is fewer unguarded
`switch`/`if-else` chains, not zero `if`s.

## Core shape

```ts
const label = match(status)
  .with("loading", () => "Загрузка…")
  .with("success", () => "Готово")
  .with("error", () => "Ошибка")
  .exhaustive();
```

- `.with(pattern, handler)` — one branch. First matching branch wins, top to bottom.
- `.exhaustive()` — run it, and fail the **compile** if any case of the input union is unhandled.
  Optionally pass a handler for the "impossible" runtime value: `.exhaustive((v) => fallback)`.
- `.otherwise(handler)` — catch-all fallback. It **silences** the exhaustiveness check, so use it
  only for genuinely open inputs (`unknown`, unbounded `string`/`number`), never as a lazy
  substitute for `.exhaustive()` on a closed union.

Rule of thumb: closed union → `.exhaustive()`. Open input → `.otherwise()`.

## Conditional JSX

Return the element per variant instead of nesting ternaries:

```tsx
type Status = "idle" | "loading" | "done";

return (
  <>
    {match(status)
      .with("idle", () => <Placeholder />)
      .with("loading", () => <Spinner />)
      .with("done", () => <Result />)
      .exhaustive()}
  </>
);
```

Matching on a **tuple** `[a, b]` is how you branch on a combination of two discriminants at once
— e.g. render by `[isDisabled, variant]`:

```tsx
{match([isDisabled, variant])
  .with([true, P.any], () => null)
  .with([false, "primary"], () => <PrimaryContent />)
  .with([false, "secondary"], () => <SecondaryContent />)
  .exhaustive()}
```

## Capturing values with P.select

`P.select()` pulls a value out of the pattern and passes it — already narrowed — to the handler:

```ts
const html = match(content)
  .with({ type: "text", data: P.select() }, (data /* : string */) => renderText(data))
  .with({ type: "video", data: { format: P.select() } }, (format /* : "mp4" | "webm" */) => renderVideo(format))
  // name multiple captures:
  .with({ type: "link", href: P.select("href"), label: P.select("label") }, ({ href, label }) => renderLink(href, label))
  .exhaustive();
```

## Guards — conditions inside a branch

Don't drop back to `switch` the moment a case needs a runtime condition. Two ways:

```ts
match(input)
  // predicate as the middle argument of .with:
  .with({ kind: "num", value: P.select() }, (v) => v > 100, () => "big")
  // or P.when for a standalone predicate branch:
  .with(P.when((x): x is Even => x % 2 === 0), () => "even")
  .otherwise(() => "other");
```

## The P combinator catalogue

`P` (the `Pattern` namespace) is where the expressiveness lives. The ones you'll actually reach for:

| Pattern | Matches |
| --- | --- |
| `P._` / `P.any` | anything (wildcard) |
| `P.string`, `P.number`, `P.boolean`, `P.bigint` | any value of that primitive type |
| `P.nullish` | `null` or `undefined` |
| `P.string.startsWith("/")`, `.includes(...)`, `.regex(...)` | refined strings |
| `P.number.between(0, 50)`, `.gt(...)`, `.int()`, `.positive()` | refined numbers |
| `P.union(a, b, ...)` | any of several patterns |
| `P.not(pattern)` | anything except `pattern` |
| `P.optional(pattern)` | the key may be absent (object patterns) |
| `P.array(pattern)` | an array whose every item matches |
| `P.instanceOf(SomeClass)` | instances (great for `Error` subclasses) |
| `P.select()` / `P.select("name")` | capture and narrow (see above) |
| `P.when(predicate)` | a custom type-guard branch |

This is the working subset — the full, versioned list (`P.map`, `P.set`, `P.intersection`,
string/number predicate methods, etc.) is in the official docs:
https://github.com/gvergnaud/ts-pattern — verify there before using a combinator you're unsure of,
rather than guessing.

## Error handling with P.instanceOf

```ts
const message = match(error)
  .with(P.instanceOf(NetworkError), (e) => `Сеть: ${e.status}`)
  .with(P.instanceOf(ValidationError), (e) => e.reason)
  .otherwise(() => "Неизвестная ошибка");
```

## With neverthrow Results

Failure in this project is a `Result` from `neverthrow` whose error channel is a closed union
of string literals (see [`neverthrow`](../neverthrow/SKILL.md)). The two libraries split the
work: neverthrow says *that* it failed, `match` says what each failure means.

- **Two branches — ok vs. err:** use neverthrow's own `result.match(onOk, onErr)`. It narrows
  both channels with no import and no wildcard.
- **Branching on the failure variants:** that is a closed union, so it is `match` +
  `.exhaustive()` — a new variant then breaks the build at every place that explains it.

```ts
const note = (failure: Failure) =>
  match(failure)
    .with("session", () => "no data (no antifraud session)")
    .with("unavailable", () => "no data (provider unavailable)")
    .with("shape", () => "no data (source changed shape)")
    .exhaustive();

const text = result.match((snapshot) => ratesMessage(snapshot), note);
```

`Ok` and `Err` are exported classes, so `.with(P.instanceOf(Err), ...)` type-checks — reach for
it only when the `Result` is one arm of a larger pattern (a tuple, say). Plain two-way
branching reads better through `.match()`.

## Async handlers

`match` is synchronous, but handlers may return promises — then `await` the whole expression:

```ts
const result = await match(job)
  .with({ type: "upload" }, async (j) => uploadFile(j))
  .with({ type: "delete" }, async (j) => deleteFile(j))
  .exhaustive();
```

## Type guards without a full match — isMatching

When you just need a boolean/type-guard (e.g. to `.filter()` an array), use `isMatching`:

```ts
import { isMatching, P } from "ts-pattern";

const isPublished = isMatching({ published: true, title: P.string, id: P.number });
const live = posts.filter(isPublished); // narrowed type
```

## Migrating switch → match

**Before:**

```ts
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "increment":
      return { ...state, count: state.count + 1 };
    case "set":
      return { ...state, count: action.value };
    case "reset":
      return { ...state, count: 0 };
    // forget a case here and nothing complains
  }
}
```

**After:**

```ts
function reducer(state: State, action: Action): State {
  return match(action)
    .with({ type: "increment" }, () => ({ ...state, count: state.count + 1 }))
    .with({ type: "set", value: P.select() }, (value) => ({ ...state, count: value }))
    .with({ type: "reset" }, () => ({ ...state, count: 0 }))
    .exhaustive(); // add an Action variant → this line becomes a type error until handled
}
```

## Common mistakes to avoid

- **`.otherwise()` on a closed union.** It compiles today and hides the missing branch tomorrow.
  Use `.exhaustive()` so new variants surface as errors.
- **Falling back to `switch` for a guarded case.** Use the predicate arg of `.with` or `P.when`.
- **Over-applying it.** A lone `if`/guard clause / ternary should stay plain (see "When not to").
- **Re-`import`ing per branch or aliasing `P`.** One `import { match, P } from "ts-pattern";` per file.
