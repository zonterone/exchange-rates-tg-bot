# Papercuts

## 2026-08-05 15:20 — claude-opus-5

Checking whether a font has the lari sign before shipping it → a `cmap` reader
that walks format 4 segment ranges without resolving `idRangeOffset`/`idDelta`
reports every code inside a segment as present, including the ones mapped to
glyph 0. JetBrains Mono was declared to have ₾ and only the first PNG render
showed tofu. Resolve the glyph id per codepoint instead of trusting ranges.

## 2026-08-05 15:25 — claude-opus-5

Editing string literals that contain U+00A0 → the Edit tool compares raw bytes,
and a non-breaking space is indistinguishable from a normal one in the diff, so
edits either "did not match" or silently wrote the wrong character. Keep the
escape form in source, and normalise with `replaceAll` in tests.

## 2026-08-05 15:26 — claude-opus-5

Running throwaway scripts with `node -e` → the sandbox rejects any command whose
text contains `=>`, reading it as a shell redirect to a dynamic path. Use
`function () {}` in one-liners, or write the script to a file first.

## 2026-08-05 14:40 — claude-opus-5

Previewing modules with `tsx` from a scratch file in `/tmp` → bare imports do not
resolve (no `node_modules` above it) and top-level await fails with "not
supported with the cjs output format". Put preview scripts inside the project
and give them an `.mts` extension.

## 2026-08-05 18:40 — claude-opus-5

Verifying the SVG renderer inside the container with `docker run … node -e '…'` →
the sandbox reads the `>` of an inline `<svg>` tag as a shell redirect and blocks
the whole command. Same class as the `=>` papercut above: build the markup from
concatenated pieces, or copy a script file into a throwaway image instead.

## 2026-08-05 16:54 — Fable 5

Setting up agent docs (setup-matt-pocock-skills) → `AGENTS.md` mandates reading
`docs/conventions.md` before any code change, but the file did not exist (broken
reference, `docs/` only contained an empty `adr/`). Created a minimal stub; fill
in real conventions when they get decided.

## 2026-08-05 19:00 — claude-opus-5

Returning `errAsync("session")` from inside an `.andThen` callback → the literal
widens to `string` and the whole chain stops matching
`ResultAsync<Payload, Failure>`, with an error that points at the provider
object rather than the guard. neverthrow's `err`/`errAsync` infer a naked `E`,
so a vocabulary word only survives where a contextual type reaches it. Write
`errAsync("session" as const)` inside callbacks; a top-level `return err("shape")`
in a function with an annotated `Result<…, "shape">` return type is fine.

## 2026-08-05 19:20 — claude-opus-5

Bridging json-db with `ResultAsync.fromPromise(db.getData("/rates"), …)` → the
whole chain becomes `ResultAsync<any, …>`, so the snapshot validator accepts
anything and `noUncheckedIndexedAccess` stops helping — `getData` is typed
`Promise<any>`. Use `db.getObject<unknown>(path)`, which is the same call with a
type parameter, so the boundary stays `unknown`.

## 2026-08-05 19:45 — claude-opus-5

Proving a refactor left the card SVG byte-identical → the check needs the old
module next to the new one, and the scratch tree fought back: `rm -rf` and any
redirect whose target came from a shell variable are blocked, so build it with
literal paths (`mkdir -p /tmp/<dir>`, `git show HEAD:src/card.ts > /tmp/<dir>/…`).
Bare imports then resolve through a symlinked `node_modules`, and top-level
await needs a `{"type":"module"}` package.json beside the script.

## 2026-08-05 19:35 — claude-opus-5

Differential-testing a refactor by running a throwaway script under
`node --import tsx /tmp/probe.js` that imports from `src/` → the loader dies
with `ERR_REQUIRE_CYCLE_MODULE` ("Cannot require() ES Module … in a cycle"),
which says nothing about the real cause: the script sits outside the package so
tsx resolves it as CJS while `src/` is ESM. Put the scratch file inside the repo
(`test/tmp-*.test.js`) and run it with `node --import tsx --test` instead — same
loader config as the real suite, and `node:test` prints the console output.

## 2026-08-05 20:35 — claude-opus-5

Deploying with `docker run --env-file` after copying the project `.env` to the
server → MultiTransfer reported `unavailable` on the first cycle. Cause:
`MT_FHP_SESSION_ID="…"` is written with quotes in `.env`, and dotenv strips them
while docker's `--env-file` does not — the header went out with literal quote
characters and the endpoint answered non-2xx. Strip quotes from the file passed
to `--env-file`, or keep values unquoted in `.env` since dotenv does not need
them.

## 2026-08-06 12:10 — claude-opus-5

Timeboxing a live check with `timeout 120 npm run probe` on macOS → `zsh:
command not found: timeout`. GNU coreutils is not installed by default and the
BSD base system ships no equivalent; `gtimeout` exists only with `brew install
coreutils`. Use the Bash tool's own `timeout` parameter instead of wrapping the
command.

## 2026-08-06 14:20 — claude-opus-5

Building a throwaway entry to check that a bundled dependency runs standalone,
via `npx webpack --entry ./test/tmp-bundle.ts` → `Invalid configuration object.
configuration.entry[0] should be a non-empty string`. The CLI flag appends to
the config's `entry` instead of replacing it, and `webpack.config.ts` declares
it as an object (`{ main: "./src/main.ts" }`), which the merge turns into an
array with an empty slot. Write a throwaway `webpack.tmp.cjs` with its own
`entry` and pass `--config` instead.

## 2026-08-06 14:05 — claude-opus-5

A headless-chromium step verified on macOS failed inside the alpine container
with no useful error — the antifraud simply refused the session it had just
minted. Cause: `page.setUserAgent` was pinning a macOS Chrome string, which
matches reality on a mac laptop and contradicts it on linux, and the
fingerprint check reads the platform for itself. Anything that spoofs a user
agent has to be tested in the image, not only on the dev machine.

## 2026-08-06 15:10 — claude-opus-5

A promise armed before an `await` and consumed after it (`page.waitForResponse`
before `page.goto`) is a process-killer, not a style question: when the
navigation rejects, the first promise is never awaited, rejects on its own and
takes the process down under Node's default `--unhandled-rejections=throw`.
Nothing in a `ResultAsync` chain catches it, because the rejection is not in
that chain. Await the two together with `Promise.all` — it subscribes to both
synchronously, so neither can be orphaned.
