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
(Unired, MultiTransfer, Avosend, KwikPay). Quotes the `₽ → $` leg — once per
**payout method** it offers.
_Avoid_: bank, exchanger, service

**Payout method**:
How a transfer provider hands the dollars over at the Georgian end: onto a card,
or as cash across a counter. A provider that offers both quotes both, at rates
that need not agree, so each is its own rate id and its own row — `MTCard` and
`MTCash` are two things to choose between, not one rate with a footnote. Which
one a reader can use is theirs to decide, so neither is hidden behind the other.
_Avoid_: delivery type, receive method, withdrawal

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
word `old` in the `24h` column of a text table and a red `exp` chip beside the
name on the card — both name this one concept, and the chip marks the row's own
quote, not the other leg of a chained cell.
_Avoid_: cached rate, old rate, expired rate

**Sanity range**:
The plausible interval for a unit (`rubPerUsd` 30–300, `gelPerUsd` 1–10,
`rubPerGel` 5–100). A value outside it means the source changed shape, and is
treated as missing rather than displayed.
_Avoid_: validation, bounds

**Fee**:
A charge a transfer provider takes besides the rate it quotes. Where it is
reported depends on its **fee mode**, and every provider declares one:

- `onTop` — a fixed charge (Avosend takes 79 ₽). It cannot be expressed as a
  rate, because what it costs depends on the sum, so it stays next to the rate
  and never enters it. Every number the bot shows for that provider is
  therefore optimistic, and says so.
- `inRate` — a proportional charge (KwikPay takes 1.2%). It is a rate by
  another name, so it is folded into the quote once, at the provider: the
  number shown is what a dollar actually costs, at any sum. The consequence is
  deliberate — our KwikPay rate is higher than the one on kwikpay.ru, which
  quotes the rate before its own commission.
- `none` — the quote is the whole cost.

The mode is what keeps a folded fee from being charged twice downstream.
_Avoid_: commission, markup

**Fee mark**:
How a row says a fee exists: the chip beside the name on the card (`fee 79₽`
for one charged on top, `incl 1.2%` for one already inside the rate) and the
`*` beside the short name in a text table, spelled out in a line under it.
Both name one concept, and which of the two words appears is decided by the fee
mode alone.
_Avoid_: asterisk, footnote, badge

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

**Profit order**:
The order rows are read in, and the same one everywhere a list of sources
appears: sorted by profit, so the best rate a reader can act on leads. A stale
quote sorts below every fresh one — it cannot win, so it never leads. A
reference rate competes for nothing and stands apart from the order rather than
inside it. One order also decides the winner, which is why the highlight is
always on the leading row.
_Avoid_: ranking, sorting, best first

**Trend columns**:
The two cells beside every rate: `24h` — the rate against what it was a day ago,
and `vs 7d` — the rate against its own average over the week. Both are
differences, not levels, read at the precision their rate is quoted at and
coloured by the reading direction of the leg they belong to; a reference rate
moves without it being news, so its cells stay grey. The week is averaged a day
at a time, from the moment its quote is from, so a source that answered for a
few hours cannot outweigh the days it was down. Too little history is absence,
not failure: the cell reads `—`.
_Avoid_: change, diff, weekly average

**Rates card**:
The rendered image of the current rates — two leg tables and the chain matrix,
in **profit order**, with the reference rate pinned to the top row of its
section and the best chain on the top left cell. The card carries no timestamp,
which is what lets one render serve a whole update cycle.
_Avoid_: picture, screenshot, snapshot

### Reading direction

Lower is better on `₽ → $` and `₽ → ₾` (roubles paid), higher is better on
`$ → ₾` (lari received). The unit prefix of a rate id determines which, and every
table states it in its header.
