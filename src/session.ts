import { ResultAsync, err, errAsync, ok } from "neverthrow";
import { launch } from "puppeteer-core";
import type { Browser } from "puppeteer-core";
import { env } from "./env";

const home = "https://multitransfer.ru/";

// the antifraud sdk posts its telemetry packet here on init; the id only
// exists on the server once that packet has landed
const beacon = "/flsafety?u=";

const budget = 30000;

// the packet leaving is not the id being usable: asked the moment the response
// lands, the endpoint still answers 423, and it stops after a second or two.
// measured against the live endpoint, 3s was enough — this is double
const settle = 5000;

// a chromium that ignores `close` would otherwise hold the update cycle open
// for as long as it likes: every fetch runs inside one `Promise.all`
const shutdown = 5000;

const shut = async (browser: Browser) => {
  await Promise.race([
    browser.close().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, shutdown)),
  ]);

  browser.process()?.kill("SIGKILL");
};

// the id is not issued to us: the page mints a uuid for itself and the sdk
// registers it in the same breath, so a load of the homepage is the whole
// ceremony — nothing is typed, clicked or logged in
const visit = async (chromium: string): Promise<unknown> => {
  const browser = await launch({
    executablePath: chromium,
    headless: true,
    // the antifraud refuses every id minted under `navigator.webdriver`: with
    // the automation flag left on, the mint always comes back 423
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--disable-blink-features=AutomationControlled",
      // the container runs unprivileged and its /dev/shm is too small for
      // chromium's default
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
    // a browser loading a third-party page has no business holding the bot
    // token: puppeteer hands it the whole environment unless told otherwise
    env: {},
    // puppeteer's own signal handlers call `process.exit`, which would cut a
    // db write in half; `src/main.ts` owns shutdown
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    // without this every cdp call falls back to three minutes
    protocolTimeout: budget,
  });

  try {
    // the page keeps the browser's own user agent: the antifraud reads the
    // platform for itself and refuses a mac string from a linux chromium
    const page = await browser.newPage();

    // armed before the navigation, and awaited together with it: on its own
    // it would be left dangling by a failed `goto` and reject unhandled
    const registered = page.waitForResponse(
      (response) => response.url().includes(beacon),
      { timeout: budget }
    );

    await Promise.all([
      page.goto(home, { waitUntil: "domcontentloaded", timeout: budget }),
      registered,
    ]);
    await new Promise((resolve) => setTimeout(resolve, settle));

    return await page.evaluate(
      () => (window as unknown as Record<string, unknown>)["gibSessionId"]
    );
  } finally {
    await shut(browser);
  }
};

// the page is a boundary like any provider response: whatever `gibSessionId`
// holds today, only a non-empty string can travel on as a header
const toId = (value: unknown) => {
  if (typeof value === "string" && value.length > 0) return ok(value);

  console.error("multitransfer session: no id on the page");
  return err("session" as const);
};

// only an id that actually bought a rate is kept, so a refused one can never
// be reused; `remember` is the single writer
let current: string | undefined;

export const stored = () => current;

export const remember = (id: string) => {
  current = id;
};

export const forget = () => {
  current = undefined;
};

// two cycles can overlap — the startup update and a cron tick do — and a
// second browser is hundreds of megabytes spent on an id already on its way
let pending: ResultAsync<string, "session"> | null = null;

export const mint = (): ResultAsync<string, "session"> => {
  if (!env.chromium) {
    console.error("multitransfer session: no CHROMIUM_PATH to mint with");
    return errAsync("session");
  }
  if (pending) return pending;

  const done = () => {
    pending = null;
  };

  pending = ResultAsync.fromPromise(visit(env.chromium), (cause) => {
    console.error("multitransfer session", cause);
    return "session" as const;
  })
    .andThen(toId)
    .andTee(done)
    .orTee(done);

  return pending;
};
