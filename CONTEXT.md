# Exchange Rates Bot

A Telegram bot that watches how much a rouble is worth in Georgia — through
money transfer services, through Tbilisi exchange points, and through the two of
them chained together.

## Language

### Routes

**Leg**:
One conversion step with a single source: `₽ → $` (a transfer service) or
`$ → ₾` (an exchange point). Every rate the bot fetches belongs to exactly one leg.
_Avoid_: step, hop, direction

**Chain**:
The `₽ → ₾` route built from one transfer provider and one exchange point. No
source pays out lari for roubles, so every actionable lari figure is a chain.
_Avoid_: multiconversion, cross rate, route

**Direct rate**:
The `₽ → ₾` rate quoted in one step, which only CBR publishes. Nobody transacts
at it, so it is a reference: shown beside the chain, marked `direct`, and kept
out of the exchange point columns it does not belong to.
_Avoid_: cross rate, official rate

### Sources

**Transfer provider**:
A service that moves roubles out of Russia and pays out dollars in Georgia
(Unired, MultiTransfer, Avosend). Quotes the `₽ → $` leg.
_Avoid_: bank, exchanger, service

**Exchange point**:
A place in Georgia that buys dollars for lari (kursi.ge, Bank of Georgia, TBC).
Quotes the `$ → ₾` leg.
_Avoid_: bank, exchanger

**Reference rate**:
A rate nobody can transact at, shown only as a yardstick — CBR for `₽ → $` and
`₽ → ₾`, NBG for `$ → ₾`. Never competes for the best route.
_Avoid_: official rate, baseline

### Rates

**Rate id**:
The identifier of a single rate, naming its unit rather than its currency:
`rubPerUsd.unired`, `gelPerUsd.bog`, `rubPerGel.cbr`. The unit prefix says how to
read the number and which sanity range applies; the suffix says who quoted it.
_Avoid_: rate key, currency key

**Quote**:
A rate value together with the moment it was fetched. Its own timestamp is what
makes staleness visible — the snapshot timestamp alone cannot.
_Avoid_: value, price

**Stale quote**:
A quote carried over from an earlier update because its source failed this round.
Still shown, always marked, never allowed to win the best route. The mark is the
word `old` in the trend column of a text table and a red `exp` chip beside the
name on the card — both name this one concept, and the chip marks the row's own
quote, not the other leg of a chained cell.
_Avoid_: cached rate, old rate, expired rate

**Sanity range**:
The plausible interval for a unit (`rubPerUsd` 30–300, `gelPerUsd` 1–10,
`rubPerGel` 5–100). A value outside it means the source changed shape, and is
treated as missing rather than displayed.
_Avoid_: validation, bounds

**Fee**:
A charge on top of the transfer rate (Avosend takes a fixed 79 ₽). Reported next
to the rate, never folded into it — the comparison stays a comparison of rates.
_Avoid_: commission, markup

### Failures

**Failure**:
Why a source has no fresh quote this round, in three words the whole codebase
shares: `session`, `unavailable`, `shape`. It is stored per provider in the
snapshot and printed as the note under the missing or stale rate, so the reason
survives from the request to the message.
_Avoid_: error, exception, status

**Session failure**:
The bot had no antifraud session to ask MultiTransfer with: the mint could not
run, could not finish, or produced an id the antifraud then refused (see
[ADR 0001](docs/adr/0001-multitransfer-antifraud-session.md)). It says the mint
is broken, not that the source is down — that would be `unavailable`.
_Avoid_: auth error, forbidden, session expired

**Unavailable**:
The request never came back with an answer: a network error, a timeout, an HTTP
status the source should not have returned.
_Avoid_: down, offline, network error

**Shape change**:
The source answered, but nothing readable came out of the answer — the response
no longer matches what the parser expects, or every rate in it fell outside its
sanity range. Distinct from `unavailable`: the endpoint is alive and the fix is
in our parser, not in their service.
_Avoid_: parse error, invalid response, bad data

### Presentation

**Rates card**:
The rendered image of the current rates — two leg tables and the chain matrix.
Reference rates are pinned to the top row of their section; below them providers
are sorted by profit, so the best one a user can act on leads the block and the
best chain lands on the top left cell. A stale quote sorts below every fresh one
— it cannot win, so it never leads. The card carries no timestamp, which is what
lets one render serve a whole update cycle.
_Avoid_: picture, screenshot, snapshot

### Reading direction

Lower is better on `₽ → $` and `₽ → ₾` (roubles paid), higher is better on
`$ → ₾` (lari received). The unit prefix of a rate id determines which, and every
table states it in its header.
