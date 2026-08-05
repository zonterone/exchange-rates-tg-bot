# Project map

Telegram bot (grammY) watching ₽ → $ → ₾ rates in the Georgia direction. A cron
job fetches five providers every 30 minutes into a json-db snapshot
(`db/db.json`); handlers serve everything from that snapshot — `/rates` renders
an SVG → PNG card, a sum gets a text breakdown. Data flows one way:
`src/providers → snapshot (src/updateRates) → presentation (messages/card)`.

- Domain glossary: `CONTEXT.md` — use its terms verbatim, they are load-bearing.
- Decisions: `docs/adr/` (0001 — why MultiTransfer needs a browser session id;
  0002 — why failure travels as a `Result`).
- Verify: `npm test` (offline fixtures) · `npm run build` · `npm run probe`
  (live endpoints — the only check that catches an expired MultiTransfer
  session).

# Project conventions — read first

You MUST read `docs/conventions.md` BEFORE writing or modifying any code in this repo.
It is the source of truth for structure, naming, exports, theming, and verification —
it overrides any personal or global style guide.

# Pattern matching — use ts-pattern

Branch with `match` from `ts-pattern` instead of `switch`/`if-else` chains over a discriminated union or a fixed set of literals; close known unions with `.exhaustive()`. Full rules, when *not* to use it, `P` combinators and examples: `.claude/skills/ts-pattern/SKILL.md`.

# Error handling — use neverthrow

Nothing in `src/` throws and nothing returns a bare `null` to mean "it failed": anything fallible returns `Result` / `ResultAsync`, with a closed union of glossary words in the error channel (`Failure`, `"cold" | "unreadable"`, `"render"`). Absence — a missing quote, an empty history — stays `null`/`undefined`. Full rules, the Result-vs-absence line, boundary adapters and `safeTry`: `.claude/skills/neverthrow/SKILL.md`, decision in `docs/adr/0002-errors-as-values-with-neverthrow.md`.

# Log papercuts

When you encounter small friction while working—a failed tool call, confusing
setup, flaky command, stale cache, misleading error, missing helper, or
non-obvious gotcha—record it in `PAPERCUTS.md`.

Create the file if it does not exist. Append one entry in this format:

## YYYY-MM-DD HH:MM — <model>

<What you were doing> → <what got in the way>. Include a possible cause or fix
when useful.

Log papercuts proactively when they occur, but do not interrupt the main task.
Do not add duplicate entries. Papercuts are minor workflow friction, distinct
from completed-work logs and real bugs or tracked issues.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `zonterone/exchange-rates-tg-bot` (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary — five canonical labels, strings equal to role names. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
