# MultiTransfer is polled with a browser antifraud session id

MultiTransfer's commissions endpoint is guarded by FraudHunterPro: a request
without an `fhpsessionid` header gets `400` with an empty body, and one with a
freshly generated UUID gets `423 Locked`. Only a session id issued to a real
browser works, and nothing on the public site exposes how it is minted — the
homepage HTML contains no reference to the antifraud script at all.

The id is a credential of someone's browser session, so it lives in `.env` as
`MT_FHP_SESSION_ID` and never in the source. A missing one skips the request
outright, a rejected one comes back as `423`; both become the same `session`
failure, so the bot prints `MltTr — session expired?` and the fix is the same in
both cases — paste a fresh id from devtools into `.env`.

## Considered options

- **Reverse engineer the antifraud SDK** to mint session ids ourselves — breaks
  on any change to their frontend, and costs far more than a copy-paste every
  few months.
- **Drop MultiTransfer** — it is one of only three transfer providers, and
  currently sits between the other two on price.

## Consequences

The bot has an expiry date on one provider that no test can catch: `npm run probe`
and the in-message note are the only ways to notice. `fhprequestid` and
`x-request-id`, by contrast, can be random UUIDs per request — only the session
id is checked.
