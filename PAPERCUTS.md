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
