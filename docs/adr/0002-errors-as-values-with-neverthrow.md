# Failure is a `Result`, branching is a `match`

The bot has always treated errors as values, but the values could not be told
apart: `parse` returned `{}` for a response that changed shape, `getStoredRates`
returned `null` for both "nothing stored yet" and "the file is nonsense",
`Payload.failure` carried a reason next to rates that were empty anyway, and
`updateRates` wrapped the whole cycle in a `try/catch` because a provider could
still reject. Nothing in a signature said which functions could fail, and no
compiler check noticed when a caller forgot the failing case.

Failure now travels as `Result` / `ResultAsync` from `neverthrow`, and every
error channel is a closed union of string literals — the same words the glossary
uses, matched with `ts-pattern` and closed with `.exhaustive()`. The value cannot
be read without deciding what happens when it is missing, and adding a failure
variant breaks the build at every place that explains one.

## The contracts

| Function | Before | After |
| --- | --- | --- |
| `parse` (per provider) | `Payload["rates"]`, `{}` on mismatch | `Result<Payload["rates"], "shape">` (avosend, the only source that also quotes a fee: `Result<Payload, "shape">`) |
| `Provider.fetch` | `Promise<Payload>`, `failure` field, may reject | `ResultAsync<Payload, Failure>` |
| `getStoredRates` | `Promise<Snapshot \| null>` | `ResultAsync<Snapshot, "cold" \| "unreadable">` |
| `updateRates` | `Promise<Snapshot \| null>`, `try/catch` | `ResultAsync<Snapshot, "store">` |
| `guard` (db) | backup path \| `null`, `try/catch` | `Result<string \| null, "unmovable">` |
| `toPng` / `ratesPng` | `Buffer`, throws | `Result<Buffer, "render">` |
| `parseSum` | `number \| null` | `Result<number, "invalid" \| "min" \| "max">` |

`Payload` loses its `failure` field: a reason and a rate are mutually exclusive,
so the reason belongs in the error channel.

`Failure` gains a third variant. `session` and `unavailable` stay as they are;
`shape` is new and says the source answered but nothing could be read from the
answer — previously indistinguishable from a dead endpoint.

## What stays as it was

Absence is not failure. `valueOf` still returns `undefined` when there is no
quote, `dayDelta` and `weekAverage` still return `null` when the history is too
short, `bestOf` still returns `null` for an empty list of candidates: each has a
plain answer at the call site (`n/a`, `—`, no line) and a `Result` would only add
a `.match()` to every one of them.

`src/bot.ts` still throws at import when `BOT_TOKEN` is missing — the process
cannot start without it and there is no caller to hand a `Result` to.

## Considered options

- **Keep `null` / `{}` and document the meanings** — free, but the compiler stays
  blind and the third failure reason has nowhere to live.
- **`Result<T, Error>`** — a type that says "something went wrong" and nothing
  else; every caller would go back to parsing messages.
- **Throw and catch at the edges** — one uncaught rejection in the cron tick
  takes the process down, and the note under the table loses the reason.

## Consequences

The one user-visible change is a new note: a source that answers with a shape we
cannot read now says so, instead of claiming the provider was unavailable.
Stored snapshots keep working — `shape` is simply a value `isFailure` did not
accept before.

Tests read a `Result` rather than a bare value, and `_unsafeUnwrap()` is
sanctioned there and nowhere else.

One hazard survives the type: a `fetch` typed `ResultAsync` can still throw
**before** it returns one, because ky builds its request eagerly and a header
value it cannot send — the hand-pasted MultiTransfer session id, say — throws on
the spot. `updateRates` therefore guards each provider call rather than trusting
the signature; without that guard a single bad character in `.env` silently
kills the cron job and the bot serves `cold` for ever.
