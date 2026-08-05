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
