# MultiTransfer sessions are minted in a browser we start ourselves

MultiTransfer's commissions endpoint is guarded by Group-IB's antifraud: a
request without an `fhpsessionid` header gets `400`, and one carrying an id the
antifraud has never seen gets `423 Locked`.

The id is not issued to anyone. The page mints a uuid for itself, hands it to
the antifraud SDK loaded from `/gib/<uuid>.js`, and the SDK — configured with
`forceFirstAlive` — immediately posts a telemetry packet to
`api.multitransfer.ru/flsafety` that registers it. Only the id present at
`init` is registered: calling the SDK's `setSessionID` afterwards leaves the new
id as unknown to the server as a uuid we generated ourselves. **One page load
yields exactly one working id**, with nothing typed, clicked or logged in.

So the bot mints its own. `src/session.ts` starts headless chromium, loads the
homepage, waits for the `/flsafety` packet and reads `window.gibSessionId` back
out. Only an id that actually bought a rate is cached, so a refused one can
never be handed to the next cycle; a `423` on a cached id drops it and buys one
mint and one retry, and a `423` on an id minted seconds ago is a real refusal
that travels on as the `session` failure. The browser therefore starts about
once a day rather than every half hour — and an in-flight mint is shared, since
the startup update and a cron tick can overlap.

Three details are load-bearing. The antifraud refuses every id minted under
`navigator.webdriver`, so the launch drops `--enable-automation` and disables
the `AutomationControlled` blink feature — with the flag left on, every mint
comes back `423`. The page is left with the browser's own user agent, because
the antifraud reads the platform itself and refuses a mac string coming from a
linux chromium — this one only shows up in the container, since on a mac laptop
the spoofed agent happens to tell the truth. And `puppeteer-core` bundles into
`dist/main.cjs` like every other dependency, so the image needs the chromium
binary but no `node_modules`.

## Considered options

- **A hand-pasted `MT_FHP_SESSION_ID`** — what this ADR said before. It rested
  on the id lasting months; measured, it lasts less than a day, which is a
  manual step before breakfast and a dead provider by dinner.
- **Replay the `/flsafety` packet from Node** so no browser is needed — the
  packet is obfuscated and partly RSA-encrypted, and rebuilding it means
  re-deriving the SDK's fingerprint on every change to their frontend.
- **Drop MultiTransfer** — it is one of only three transfer providers, and
  currently sits between the other two on price.

## Consequences

The image carries chromium, which takes it to about 1.3 GB, and a mint needs a
few hundred megabytes of RAM the node heap limit does not cover. In exchange the
host needs nothing but docker: `CHROMIUM_PATH` points at the binary inside the
image. Outside it, development without the variable simply loses this one
provider.

A browser is a process, not a library call, so the module has to behave like
one: the navigation and the packet are awaited together (alone, the packet's
promise is left dangling by a failed `goto` and rejects unhandled, which takes
the process down), `close` is raced against a timeout and followed by a kill,
puppeteer's own signal handlers are off so shutdown stays with `src/main.ts`,
and the browser is handed an empty environment rather than one holding
`BOT_TOKEN`. The image needs an init process — `tini` — because node as pid 1
does not reap chromium's orphans.

The mint is the one part of the bot no offline test can cover: it depends on a
live page and on how the antifraud scores the browser that loads it. When their
frontend renames `window.gibSessionId`, or the scoring starts refusing us for a
new reason, nothing fails loudly — the card just shows the row's rate with an
`exp` chip and the note `no antifraud session`. `npm run probe` is what tells
the difference, and it is bundled into the image so a server can run it too.
