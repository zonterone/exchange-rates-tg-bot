import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { beforeEach } from "node:test";

process.env.BOT_TOKEN = "123:test";
// keeps a real .env out of the tests: dotenv never overrides what is already set
process.env.MT_FHP_SESSION_ID = "";
process.env.DB_PATH = path.join(
  os.tmpdir(),
  `exchange-rates-bot-test-${process.pid}`,
  "db"
);

const { parseSum } = await import("../src/bot");
const { ratesCard } = await import("../src/card");
const { db, guard } = await import("../src/db");
const { ratesPng } = await import("../src/image");
const { amountMessage, cold, ratesCaption, ratesMessage } = await import(
  "../src/messages"
);
const { parse: parseAvosend } = await import("../src/providers/avosend");
const { parse: parseCbr } = await import("../src/providers/cbr");
const { parse: parseKursi } = await import("../src/providers/kursi");
const { multitransfer, parse: parseMultitransfer } = await import(
  "../src/providers/multitransfer"
);
const { parse: parseUnired } = await import("../src/providers/unired");
const { isValidRate } = await import("../src/rates");
const { render } = await import("../src/table");
const { pruneHistory } = await import("../src/trend");
const { getStoredRates, updateRates } = await import("../src/updateRates");

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const now = Date.UTC(2026, 0, 8, 12);

const fixture = (name) =>
  fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

const json = (name) => JSON.parse(fixture(name));

const quotes = (values, updatedDate = now) =>
  Object.fromEntries(
    Object.entries(values).map(([id, value]) => [id, { value, updatedDate }])
  );

const snapshot = (overrides = {}) => ({
  updatedDate: now,
  quotes: quotes({
    "rubPerUsd.unired": 82.63,
    "rubPerUsd.multitransfer": 83.46,
    "rubPerUsd.avosend": 85.05,
    "rubPerUsd.cbr": 81.13,
    "gelPerUsd.kursi": 2.619,
    "gelPerUsd.bog": 2.595,
    "gelPerUsd.tbc": 2.595,
    "gelPerUsd.nbg": 2.6239,
    "rubPerGel.cbr": 30.91,
  }),
  fees: { avosend: { fix: 79, percent: 0 } },
  failures: {},
  history: [],
  ...overrides,
});

const block = (message) => message.split("<pre>")[1].split("</pre>")[0];

// sums outside the grid are grouped with non-breaking spaces
const plain = (message) => message.replaceAll(" ", " ");

const provider = (name, ids, payload) => ({
  name,
  ids,
  fetch: async () => payload,
});

const silentlySync = (run) => {
  const error = console.error;
  console.error = () => {};

  try {
    return run();
  } finally {
    console.error = error;
  }
};

const silently = async (run) => {
  const error = console.error;
  console.error = () => {};

  try {
    return await run();
  } finally {
    console.error = error;
  }
};

beforeEach(async () => {
  db.resetData({});
  await db.save(true);
});

test("parses every provider from a live response fixture", () => {
  assert.deepEqual(parseUnired(json("unired.json")), {
    "rubPerUsd.unired": 82.63,
  });
  assert.deepEqual(parseMultitransfer(json("multitransfer.json")), {
    "rubPerUsd.multitransfer": 83.46,
  });
  assert.deepEqual(parseAvosend(fixture("avosend.html")), {
    rates: { "rubPerUsd.avosend": 85.05 },
    fee: { fix: 79, percent: 0 },
  });
  assert.deepEqual(parseKursi(json("kursi.json")), {
    "gelPerUsd.kursi": 2.619,
    "gelPerUsd.bog": 2.595,
    "gelPerUsd.tbc": 2.595,
    "gelPerUsd.nbg": 2.6239,
  });
  assert.deepEqual(parseCbr(json("cbr.json")), {
    "rubPerUsd.cbr": 81.1291,
    "rubPerGel.cbr": 30.9075,
  });
});

test("returns nothing usable from malformed provider payloads", () => {
  assert.deepEqual(parseUnired([{ currency_name: "UZ_TO_RU", sell: 144 }]), {});
  assert.deepEqual(parseUnired("nope"), {});
  assert.deepEqual(parseMultitransfer({ fees: [] }), {});
  assert.deepEqual(
    parseMultitransfer({
      fees: [{ deliveryType: "to_cash", commissions: [] }],
    }),
    {}
  );
  assert.deepEqual(parseAvosend("<script>no json here</script>"), { rates: {} });
  assert.deepEqual(parseAvosend('{"fromScale":2,"convertRate":"broken"}'), {
    rates: {},
  });
  assert.deepEqual(parseKursi([{ baseCurrencyCode: "GEL" }]), {});
  assert.deepEqual(parseCbr({ Valute: {} }), {});
});

test("takes the to_card delivery type, not the first commission", () => {
  const raw = json("multitransfer.json");
  const cash = raw.fees.find((fee) => fee.deliveryType === "to_cash");

  assert.equal(cash.commissions[0].money.rate, "83.560000");
  assert.deepEqual(parseMultitransfer(raw), {
    "rubPerUsd.multitransfer": 83.46,
  });
});

test("reports a session failure instead of calling multitransfer unauthorised", async () => {
  assert.deepEqual(await multitransfer.fetch(), {
    rates: {},
    failure: "session",
  });
});

test("keeps parsing when a neighbour in the list is broken", () => {
  const withJunk = [{ baseCurrencyCode: null }, "nonsense", ...json("kursi.json")];

  assert.deepEqual(parseKursi(withJunk), {
    "gelPerUsd.kursi": 2.619,
    "gelPerUsd.bog": 2.595,
    "gelPerUsd.tbc": 2.595,
    "gelPerUsd.nbg": 2.6239,
  });

  const fees = json("multitransfer.json").fees;
  assert.deepEqual(parseMultitransfer({ fees: ["broken", ...fees] }), {
    "rubPerUsd.multitransfer": 83.46,
  });
});

test("reports no fee rather than a zero one when the shape drifts", () => {
  const zero =
    '{"fromScale":2,"convertRate":"0.0118","tariffs":[{"fix":"0","percent":"0"}]}';

  assert.deepEqual(parseAvosend(zero), { rates: { "rubPerUsd.avosend": 84.7458 } });
  assert.deepEqual(parseAvosend('{"fromScale":2,"convertRate":"0.0118"}'), {
    rates: { "rubPerUsd.avosend": 84.7458 },
  });
});

test("an unusable fee keeps the last known one", async () => {
  await updateRates([
    provider("avosend", ["rubPerUsd.avosend"], {
      rates: { "rubPerUsd.avosend": 85.05 },
      fee: { fix: 79, percent: 0 },
    }),
  ]);

  const result = await updateRates([
    provider("avosend", ["rubPerUsd.avosend"], {
      rates: { "rubPerUsd.avosend": 85.1 },
      fee: { fix: 0, percent: 0 },
    }),
  ]);

  assert.deepEqual(result.fees.avosend, { fix: 79, percent: 0 });
});

test("rejects rates outside their sanity range", () => {
  assert.equal(isValidRate("rubPerUsd.unired", 82.63), true);
  // 1/convertRate forgotten — the rate would read as 0.0117₽ per dollar
  assert.equal(isValidRate("rubPerUsd.avosend", 0.0117), false);
  assert.equal(isValidRate("gelPerUsd.kursi", 2.619), true);
  assert.equal(isValidRate("gelPerUsd.kursi", 261.9), false);
  assert.equal(isValidRate("rubPerGel.cbr", 30.91), true);
  assert.equal(isValidRate("rubPerUsd.cbr", Number.NaN), false);
  assert.equal(isValidRate("rubPerUsd.cbr", "81"), false);
});

test("drops out-of-range values instead of storing them", async () => {
  const result = await silently(() =>
    updateRates([
      provider("avosend", ["rubPerUsd.avosend"], {
        rates: { "rubPerUsd.avosend": 0.0117 },
        fee: { fix: 79, percent: 0 },
      }),
    ])
  );

  assert.equal(result.quotes["rubPerUsd.avosend"], undefined);
  assert.equal(result.failures.avosend, "unavailable");
  assert.deepEqual(result.history, []);
});

test("keeps one grid across all tables of a message", () => {
  const lines = render([
    {
      title: "first",
      headers: ["now", "24h"],
      rows: [{ label: "Unrd", cells: ["82.63", "-0.40"] }],
    },
    {
      title: "second",
      headers: ["Kursi"],
      rows: [{ label: "Avsnd*", cells: ["2.6190"] }],
    },
  ]).split("\n");

  // right aligned cells of the first column end on the same offset everywhere
  const ends = (line, cell) => line.indexOf(cell) + cell.length;

  assert.equal(ends(lines[1], "now"), 14);
  assert.equal(ends(lines[2], "82.63"), 14);
  assert.equal(ends(lines[5], "Kursi"), 14);
  assert.equal(ends(lines[6], "2.6190"), 14);
});

test("renders rates with legs, chain matrix and the best chain", () => {
  const message = ratesMessage(snapshot(), now + 5 * 60 * 1000);

  assert.equal(
    block(message),
    [
      "₽ → $  ₽/1$ · lower better",
      "           now    24h     7d",
      "Unrd     82.63      —      —",
      "MltTr    83.46      —      —",
      "Avsnd*   85.05      —      —",
      "CBR      81.13      —      —",
      "",
      "$ → ₾  ₾/1$ · higher better",
      "           now    24h     7d",
      "Kursi   2.6190      —      —",
      "BoG     2.5950      —      —",
      "TBC     2.5950      —      —",
      "NBG     2.6239      —      —",
      "",
      "₽ → ₾  ₽/1₾ · via $ · lower better",
      "         Kursi    BoG    TBC",
      "Unrd     31.55  31.84  31.84",
      "MltTr    31.87  32.16  32.16",
      "Avsnd*   32.47  32.77  32.77",
    ].join("\n")
  );
  assert.match(message, /\* Avsnd fee 79₽/);
  assert.match(message, /CBR direct — 30\.91₽ per 1₾/);
  assert.match(message, /Best: Unrd → Kursi — 31\.55₽ per 1₾/);
  assert.match(
    message,
    /Updated 5 min ago\nRates are usually updated every 30 minutes/
  );
  assert.doesNotMatch(message, /KoronaPay/);
});

test("shows a 24h delta and a 7d average once history allows it", () => {
  const history = [
    ...Array.from({ length: 28 }, (_, index) => ({
      key: "rubPerUsd.unired",
      value: 83.1,
      updatedDate: now - 7 * day + index * 6 * hour,
    })),
    { key: "rubPerUsd.unired", value: 83.03, updatedDate: now - day },
    { key: "rubPerUsd.unired", value: 82.63, updatedDate: now },
  ];

  const message = ratesMessage(snapshot({ history }), now);
  const line = block(message)
    .split("\n")
    .find((row) => row.startsWith("Unrd"));

  assert.match(line, /82\.63\s+-0\.44\s+83\.08/);
});

test("marks carried over quotes and explains why", () => {
  const stale = snapshot({
    quotes: {
      ...snapshot().quotes,
      "rubPerUsd.multitransfer": {
        value: 83.46,
        updatedDate: now - 3 * hour,
      },
    },
    failures: { multitransfer: "session" },
  });
  const message = ratesMessage(stale, now);

  assert.match(block(message), /MltTr\s+83\.46\s+old/);
  assert.match(message, /MltTr — session expired\?, rate from 3h ago/);
});

test("shows n/a and skips the best line when nothing is fresh", () => {
  const empty = snapshot({ quotes: {}, failures: { kursi: "unavailable" } });
  const message = ratesMessage(empty, now);

  assert.match(block(message), /Unrd\s+n\/a/);
  assert.match(block(message), /Unrd\s+n\/a\s+n\/a/);
  // one line per source and reason, not one per rate it feeds
  assert.match(message, /Kursi, BoG, TBC, NBG — no data \(provider unavailable\)/);
  assert.doesNotMatch(message, /Best:/);
});

test("calculates what a sum buys through every provider pair", () => {
  const message = amountMessage("sendRub", 10000, snapshot(), now);

  assert.match(plain(message), /^Send 10 000₽/u);
  assert.match(block(message), /Unrd\s+121\.02/);
  assert.match(block(message), /Avsnd\*\s+117\.58/);
  assert.match(block(message), /Unrd\s+316\.96 314\.05/);
  assert.match(message, /Best: Unrd → Kursi — 316\.96₾/);
  assert.match(message, /\* Avsnd fee 79₽ \(not included\)/);
});

test("calculates roubles needed for a target sum", () => {
  const gelMessage = amountMessage("needRubForGel", 10000, snapshot(), now);
  const usdMessage = amountMessage("needRubForUsd", 1000, snapshot(), now);

  assert.match(block(gelMessage), /Unrd\s+315502\.10 318420\.04/);
  assert.match(plain(gelMessage), /Best: Unrd → Kursi — 315 502\.10₽/u);
  assert.match(block(usdMessage), /Unrd\s+82630\.00/);
  assert.match(plain(usdMessage), /Best: Unrd — 82 630\.00₽/u);
});

test("shows both directions of the dollar to lari exchange", () => {
  const message = amountMessage("usdGel", 10000, snapshot(), now);

  assert.match(block(message), /Kursi\s+26190\.00\s+3818\.25/);
  assert.match(block(message), /BoG\s+25950\.00\s+3853\.56/);
  assert.match(plain(message), /get ₾ — from 10 000\$/u);
  assert.match(plain(message), /need \$ — for 10 000₾/u);
  assert.match(plain(message), /Best: Kursi — 26 190\.00₾/u);
  assert.doesNotMatch(message, /fee/);
});

test("normalises user input and rejects what is not a plain number", () => {
  assert.equal(parseSum("10000"), 10000);
  assert.equal(parseSum("10 000"), 10000);
  assert.equal(parseSum("10 000"), 10000);
  assert.equal(parseSum("1,5"), 1.5);
  assert.equal(parseSum("1.5"), 1.5);
  // a separator followed by three digits groups thousands, it is not decimal
  assert.equal(parseSum("10,000"), 10000);
  assert.equal(parseSum("10.000"), 10000);
  assert.equal(parseSum("1,000,000"), 1000000);
  assert.equal(parseSum("1 234.56"), 1234.56);
  assert.equal(parseSum("1,234.56"), 1234.56);
  assert.equal(parseSum(""), null);
  assert.equal(parseSum("-5"), null);
  assert.equal(parseSum("1e5"), null);
  assert.equal(parseSum("0x10"), null);
  assert.equal(parseSum("abc"), null);
  assert.equal(parseSum("100$"), null);
});

test("returns the cold message until the first update lands", async () => {
  assert.equal(await getStoredRates(), null);

  await db.push("/rates", { koronaRateGEL: 29.06, updatedDate: now }, true);
  assert.equal(await getStoredRates(), null, "old korona snapshot is ignored");
});

test("keeps previous quotes when a provider fails", async () => {
  const stored = await updateRates([
    provider("unired", ["rubPerUsd.unired"], {
      rates: { "rubPerUsd.unired": 82.63 },
    }),
    provider("kursi", ["gelPerUsd.kursi"], {
      rates: { "gelPerUsd.kursi": 2.619 },
    }),
  ]);

  const result = await silently(() =>
    updateRates([
      {
        name: "unired",
        ids: ["rubPerUsd.unired"],
        fetch: async () => {
          throw new Error("unired down");
        },
      },
      provider("kursi", ["gelPerUsd.kursi"], {
        rates: { "gelPerUsd.kursi": 2.62 },
      }),
    ])
  );

  assert.equal(result.quotes["rubPerUsd.unired"].value, 82.63);
  assert.equal(
    result.quotes["rubPerUsd.unired"].updatedDate,
    stored.quotes["rubPerUsd.unired"].updatedDate
  );
  assert.equal(result.failures.unired, "unavailable");
  assert.equal(result.quotes["gelPerUsd.kursi"].value, 2.62);
  assert.equal(result.quotes["gelPerUsd.kursi"].updatedDate, result.updatedDate);
  assert.equal(
    result.history.filter((point) => point.key === "rubPerUsd.unired").length,
    1
  );
});

test("passes a rejected antifraud session through as a session failure", async () => {
  const result = await silently(() =>
    updateRates([
      provider("multitransfer", ["rubPerUsd.multitransfer"], {
        rates: {},
        failure: "session",
      }),
    ])
  );

  assert.equal(result.failures.multitransfer, "session");
  assert.equal(result.quotes["rubPerUsd.multitransfer"], undefined);
});

test("drops stored quotes, fees and failures that make no sense", async () => {
  await db.push(
    "/rates",
    {
      updatedDate: now,
      quotes: {
        "rubPerUsd.unired": { value: 82.63, updatedDate: now },
        "rubPerUsd.avosend": { value: "85.05", updatedDate: now },
        "rubPerUsd.cbr": { value: 3, updatedDate: now },
        "gelPerUsd.kursi": { value: 2.619 },
        koronaRateGEL: { value: 29.06, updatedDate: now },
      },
      fees: { avosend: { fix: -1, percent: 0 }, korona: { fix: 5, percent: 0 } },
      failures: { unired: "banned", kursi: "unavailable" },
      history: [],
    },
    true
  );

  const stored = await getStoredRates();

  assert.deepEqual(stored.quotes, {
    "rubPerUsd.unired": { value: 82.63, updatedDate: now },
  });
  assert.deepEqual(stored.fees, {});
  assert.deepEqual(stored.failures, { kursi: "unavailable" });
});

test("moves a corrupt database aside instead of dying on every call", () => {
  const file = path.join(os.tmpdir(), `exchange-rates-guard-${process.pid}.json`);
  fs.writeFileSync(file, '{"rates": {"upd');

  const backup = silentlySync(() => guard(file));

  assert.match(backup, /\.corrupt-\d+$/);
  assert.equal(fs.existsSync(file), false, "the broken file is out of the way");
  assert.equal(fs.readFileSync(backup, "utf8"), '{"rates": {"upd');

  fs.writeFileSync(file, '{"rates": {}}');
  assert.equal(guard(file), null, "a readable database is left alone");
  fs.rmSync(file);
  fs.rmSync(backup);
});

test("keeps history bounded to known and recent points", () => {
  const history = [
    { key: "koronaRateGEL", value: 29.06, updatedDate: now },
    { key: "rubPerUsd.unired", value: 82.63, updatedDate: now - 9 * day },
    { key: "rubPerUsd.unired", value: 0.01, updatedDate: now },
    { key: "rubPerUsd.unired", value: 82.63, updatedDate: now + hour },
    { key: "rubPerUsd.unired", value: 82.63, updatedDate: now },
  ];

  assert.deepEqual(pruneHistory(history, now), [
    { key: "rubPerUsd.unired", value: 82.63, updatedDate: now },
  ]);
  assert.deepEqual(pruneHistory(undefined, now), []);
});

test("returns null when the database write fails", async () => {
  const push = db.push.bind(db);
  db.push = async () => {
    throw new Error("db write failed");
  };

  try {
    const result = await silently(() =>
      updateRates([
        provider("unired", ["rubPerUsd.unired"], {
          rates: { "rubPerUsd.unired": 82.63 },
        }),
      ])
    );

    assert.equal(result, null);
  } finally {
    db.push = push;
  }
});

test("answers with the cold message before any rates are stored", async () => {
  assert.equal(cold, "Rates are not loaded yet. Try again later.");
  assert.equal(await getStoredRates(), null);
});

test("card ranks providers by profit with references pinned on top", () => {
  const svg = ratesCard(snapshot());
  const at = (label) => svg.indexOf(`>${label}<`);

  assert.ok(at("CBR") < at("Unired"), "reference first");
  assert.ok(at("Unired") < at("MultiTransfer"), "cheapest dollars first");
  assert.ok(at("MultiTransfer") < at("Avosend"));
  assert.ok(at("NBG") < at("Kursi"), "reference first");
  assert.ok(at("Kursi") < at("Bank of Georgia"), "most lari first");
  assert.ok(at("Bank of Georgia") < at("TBC"), "ties break by name");
});

test("card highlights the best cell of every table", () => {
  const svg = ratesCard(snapshot());
  const cell = (value) =>
    svg.split("\n").find((line) => line.includes(`>${value}</text>`));

  assert.match(cell("82.63"), /#4ade80/);
  assert.match(cell("2.6190"), /#4ade80/);
  // the chain is sorted so its best combination lands on the top left cell
  assert.match(cell("31.55"), /#4ade80/);
  assert.doesNotMatch(cell("31.84"), /#4ade80/);
  assert.equal(svg.split("rgba(74,222,128,0.16)").length - 1, 3);
});

test("card carries no timestamp so it can be cached until the next update", () => {
  const svg = ratesCard(snapshot());

  assert.doesNotMatch(svg, /updated|ago/i);
});

test("every message ends with the same freshness footer", () => {
  const later = now + 12 * 60 * 1000;
  const tail = "Updated 12 min ago\nRates are usually updated every 30 minutes";

  assert.ok(ratesCaption(snapshot(), later).includes(tail), "card caption");
  assert.ok(ratesMessage(snapshot(), later).includes(tail), "text rates");
  assert.ok(
    amountMessage("sendRub", 10000, snapshot(), later).endsWith(tail),
    "amount message"
  );
  assert.ok(
    amountMessage("usdGel", 1000, snapshot(), later).endsWith(tail),
    "usd to gel message"
  );
});

test("card keeps square with equal padding on every side", () => {
  const svg = ratesCard(snapshot());
  const size = Number(svg.match(/width="([\d.]+)"/)[1]);
  const texts = [
    ...svg.matchAll(
      /<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*text-anchor="(\w+)"/g
    ),
  ];

  const top = Math.min(
    ...texts.map((match) => Number(match[2]) - Number(match[3]) * 0.7)
  );
  const bottom = size - Math.max(...texts.map((match) => Number(match[2])));
  const left = Math.min(
    ...texts
      .filter((match) => match[4] === "start")
      .map((match) => Number(match[1]))
  );
  const right =
    size -
    Math.max(
      ...texts
        .filter((match) => match[4] === "end")
        .map((match) => Number(match[1]))
    );

  assert.match(svg, new RegExp(`viewBox="0 0 ${size} ${size}"`));
  [top, bottom, left, right].forEach((padding) => {
    assert.ok(Math.abs(padding - 16) < 1, `padding ${padding} is not 16`);
  });
});

test("a stale quote neither leads the table nor wins", () => {
  // cheapest of all, but carried over from three hours ago
  const stale = snapshot({
    quotes: {
      ...snapshot().quotes,
      "rubPerUsd.multitransfer": { value: 80, updatedDate: now - 3 * hour },
    },
    failures: { multitransfer: "session" },
  });
  const svg = ratesCard(stale);
  const at = (label) => svg.indexOf(`>${label}<`);
  const cell = (value) =>
    svg.split("\n").find((line) => line.includes(`>${value}</text>`));

  assert.ok(at("Unired") < at("MultiTransfer"), "fresh rates rank first");
  assert.doesNotMatch(cell("80.00"), /#4ade80/);
  assert.match(cell("82.63"), /#4ade80/);
  // the chain highlight follows the same winner, not the cheaper stale row
  assert.match(cell("31.55"), /#4ade80/);
});

test("card puts the direct rate above the matrix, on the trend columns", () => {
  const svg = ratesCard(snapshot());
  const texts = [
    ...svg.matchAll(
      /<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)</g
    ),
  ].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
    size: Number(match[3]),
    value: match[4],
  }));
  // labels and column headings differ by type size, and "CBR" appears in both
  // the first section and this one
  const last = (value, size) =>
    texts.filter((text) => text.value === value && text.size === size).at(-1);

  assert.match(svg, />direct</);

  const rate = last("30.91", 19);
  const heading = last("Kursi", 11);
  const chained = last("31.55", 19);

  // it passes no exchange point, so it stays above their headings
  assert.ok(rate.y < heading.y, "direct is above the matrix header");
  assert.ok(heading.y < chained.y, "headings still lead the matrix");
  // and it lands on the same column the sections above put their rate in
  assert.equal(rate.y, last("CBR", 17).y);
  assert.equal(rate.x, chained.x);
});

test("card leaves the same air above and below every divider", () => {
  const svg = ratesCard(snapshot());
  const lines = [...svg.matchAll(/<line [^>]*y1="([\d.]+)"/g)].map((match) =>
    Number(match[1])
  );
  const texts = [...svg.matchAll(/<text [^>]*y="([\d.]+)"[^>]*font-size="([\d.]+)"/g)].map(
    (match) => ({ y: Number(match[1]), size: Number(match[2]) })
  );

  assert.equal(lines.length, 2);
  lines.forEach((line) => {
    // a row ends on its baseline, a heading starts a cap height above one
    const above = texts.filter((text) => text.y < line);
    const below = texts.filter((text) => text.y > line);
    const last = Math.max(...above.map((text) => text.y));
    const next = below.reduce((first, text) =>
      text.y < first.y ? text : first
    );

    assert.ok(
      Math.abs(line - last - (next.y - next.size * 0.7 - line)) <= 1,
      `divider at ${line} is not centred between the sections`
    );
  });
});

test("card keeps its columns from colliding at the current type sizes", () => {
  const svg = ratesCard(
    snapshot({
      history: [
        { key: "rubPerUsd.unired", value: 95.11, updatedDate: now - day },
        { key: "gelPerUsd.kursi", value: 2.111, updatedDate: now - day },
      ],
    })
  );
  const texts = [
    ...svg.matchAll(
      /<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*text-anchor="(\w+)">([^<]*)</g
    ),
  ].map((match) => ({
    y: Number(match[2]),
    size: Number(match[3]),
    anchor: match[4],
    value: match[5],
    // Noto Sans Mono advances 0.6em, the same arithmetic the layout uses
    left:
      match[4] === "end"
        ? Number(match[1]) - match[5].length * Number(match[3]) * 0.6
        : Number(match[1]),
    right:
      match[4] === "end"
        ? Number(match[1])
        : Number(match[1]) + match[5].length * Number(match[3]) * 0.6,
  }));

  const rows = new Map();
  texts.forEach((text) => rows.set(text.y, [...(rows.get(text.y) ?? []), text]));

  rows.forEach((row) => {
    [...row]
      .sort((left, right) => left.left - right.left)
      .forEach((text, index, sorted) => {
        const previous = sorted[index - 1];
        if (!previous) return;

        assert.ok(
          text.left >= previous.right,
          `"${previous.value}" and "${text.value}" overlap on row ${text.y}`
        );
      });
  });
});

test("card shows unavailable rates without picking a winner", () => {
  const svg = ratesCard(
    snapshot({ quotes: {}, failures: { kursi: "unavailable" } })
  );

  assert.match(svg, />n\/a</);
  assert.equal(svg.includes("rgba(74,222,128,0.16)"), false);
});

test("renders the card to a png with the bundled fonts", () => {
  const png = ratesPng(snapshot());

  assert.equal(png.subarray(0, 4).toString("hex"), "89504e47", "png magic");
  assert.equal(ratesPng(snapshot()), png, "second call is served from cache");
});

test("docker config persists the same db path used by runtime", () => {
  assert.match(fs.readFileSync("Dockerfile", "utf8"), /VOLUME \/app\/db/);
  assert.match(fs.readFileSync(".dockerignore", "utf8"), /^dist$/m);
  assert.match(fs.readFileSync(".gitignore", "utf8"), /^db\/$/m);
});
