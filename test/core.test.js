import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { beforeEach } from "node:test";

process.env.BOT_TOKEN = "123:test";
process.env.DB_PATH = path.join(
  os.tmpdir(),
  `exchange-rates-bot-test-${process.pid}`,
  "db"
);

const { parseCBRRates, parseKoronaPayRate } = await import("../src/api");
const { calculateRatesFromRub, calculateRatesToRub } = await import(
  "../src/calculateRates"
);
const { db } = await import("../src/db");
const { getRates } = await import("../src/getRates");
const { formatRate, isPositiveRate } = await import("../src/helpers");
const {
  formatRateInsightsSuffix,
  formatRateWithInsights,
  pruneRateHistory,
} = await import("../src/trend");
const { getStoredRates, updateRates } = await import("../src/updateRates");

const hour = 60 * 60 * 1000;
const rates = {
  koronaRateGEL: 40,
  koronaRateUSD: 95,
  CBRRateUSD: 90,
  CBRRateGEL: 35,
  updatedDate: Date.now(),
};

const weeklyUsdHistory = (now) =>
  Array.from({ length: 24 }, (_, index) => ({
    key: "CBRRateUSD",
    value: 91.5,
    updatedDate: now - 7 * 24 * hour + index * 30 * 60 * 1000,
  }));

beforeEach(async () => {
  db.resetData({});
  await db.save(true);
});

test("returns a cold-db message instead of throwing", async () => {
  assert.equal(await getStoredRates(), null);
  assert.equal(await getRates(), "Rates are not loaded yet. Try again later.");
  assert.equal(
    await calculateRatesFromRub("GEL", 1000),
    "Rates are not loaded yet. Try again later."
  );
  assert.equal(
    await calculateRatesToRub("USD", 100),
    "Rates are not loaded yet. Try again later."
  );
});

test("parses KoronaPay rates and rejects malformed provider payloads", () => {
  assert.equal(parseKoronaPayRate([{ exchangeRate: "40.5" }]), 40.5);
  assert.equal(parseKoronaPayRate([]), -1);
  assert.equal(parseKoronaPayRate([{ exchangeRate: 0 }]), -1);
  assert.equal(parseKoronaPayRate([{ exchangeRate: -12 }]), -1);
  assert.equal(parseKoronaPayRate([{ exchangeRate: "nope" }]), -1);
  assert.equal(parseKoronaPayRate({ exchangeRate: 40 }), -1);
});

test("parses CBR rates per requested currency with missing-currency fallback", () => {
  const response = {
    Valute: {
      USD: { Value: "91.25" },
      GEL: { Value: 36.75 },
    },
  };

  assert.deepEqual(parseCBRRates(response, ["USD", "GEL"]), [91.25, 36.75]);
  assert.deepEqual(
    parseCBRRates({ Valute: { USD: { Value: 91 } } }, ["USD", "GEL"]),
    [91, -1]
  );
  assert.deepEqual(
    parseCBRRates({ Valute: { USD: { Value: 0 } } }, ["USD"]),
    [-1]
  );
  assert.deepEqual(parseCBRRates(null, ["USD", "GEL"]), [-1, -1]);
});

test("formats only positive finite rates as numbers", () => {
  assert.equal(formatRate(12), "12.00");
  assert.equal(formatRate(12.345), "12.35");
  assert.equal(formatRate(0), "❌");
  assert.equal(formatRate(-1), "❌");
  assert.equal(formatRate(Number.POSITIVE_INFINITY), "❌");
  assert.equal(formatRate(Number.NaN), "❌");
  assert.equal(isPositiveRate(0.01), true);
  assert.equal(isPositiveRate(0), false);
});

test("formats ₽ trend from sliding windows and 7d average", () => {
  const now = Date.UTC(2026, 0, 8, 12);
  const history = [
    ...weeklyUsdHistory(now),
    {
      key: "CBRRateUSD",
      value: 90,
      updatedDate: now - 24 * hour - 30 * 60 * 1000,
    },
    {
      key: "CBRRateUSD",
      value: 91,
      updatedDate: now - 24 * hour + 30 * 60 * 1000,
    },
    { key: "CBRRateUSD", value: 92, updatedDate: now - 30 * 60 * 1000 },
    { key: "CBRRateUSD", value: 93, updatedDate: now },
  ];

  assert.equal(
    formatRateWithInsights(93, history, "CBRRateUSD", now),
    "93.00₽ ↑ +2.50₽ over 24h, above 7d avg by 1.50₽"
  );
  assert.equal(
    formatRateInsightsSuffix(history, "CBRRateUSD", 93, now),
    " (rate ↑ +2.50₽ over 24h, above 7d avg by 1.50₽)"
  );
});

test("does not show insights for stale fallback rates", () => {
  const now = Date.UTC(2026, 0, 8, 12);
  const history = [
    { key: "CBRRateUSD", value: 90, updatedDate: now - 24 * hour },
    { key: "CBRRateUSD", value: 92, updatedDate: now - hour },
  ];

  assert.equal(
    formatRateWithInsights(93, history, "CBRRateUSD", now),
    "93.00₽"
  );
});

test("formats flat trend over available history when 24h window is missing", () => {
  const now = Date.UTC(2026, 0, 8, 12);
  const history = [
    { key: "CBRRateGEL", value: 35, updatedDate: now - 6 * hour },
    { key: "CBRRateGEL", value: 35.02, updatedDate: now },
  ];

  assert.equal(
    formatRateWithInsights(35.02, history, "CBRRateGEL", now),
    "35.02₽ ≈ flat over 6h"
  );
});

test("keeps only recent valid rate history points", () => {
  const now = Date.UTC(2026, 0, 8, 12);
  const history = [
    { key: "CBRRateUSD", value: 90, updatedDate: now - 9 * 24 * hour },
    { key: "CBRRateUSD", value: 0, updatedDate: now },
    { key: "CBRRateUSD", value: 91, updatedDate: now + hour },
    { key: "CBRRateUSD", value: 92, updatedDate: now },
  ];

  assert.deepEqual(pruneRateHistory(history, now), [
    { key: "CBRRateUSD", value: 92, updatedDate: now },
  ]);
});

test("rate messages contain only CBR and KoronaPay rates", async () => {
  await db.push("/rates", rates, true);

  const message = await getRates();
  assert.match(message, /CBR\n1₾=35\.00₽/);
  assert.match(message, /KoronaPay\n1₾=40\.00₽/);
  assert.doesNotMatch(message, /ByBit|USDT|👍/);

  const fromRub = await calculateRatesFromRub("GEL", 1000);
  assert.match(fromRub, /KoronaPay\n1000₽=25\.00₾/);
  assert.doesNotMatch(fromRub, /ByBit|USDT|👍/);

  const toRub = await calculateRatesToRub("USD", 10);
  assert.match(toRub, /CBR\n900\.00₽=10\$/);
  assert.match(toRub, /KoronaPay\n950\.00₽=10\$/);
});

test("rate calculations render invalid provider values as unavailable", async () => {
  await db.push(
    "/rates",
    {
      ...rates,
      koronaRateGEL: -1,
      CBRRateGEL: 0,
    },
    true
  );

  assert.match(await getRates(), /1₾=❌/);
  assert.match(await calculateRatesFromRub("GEL", 1000), /1000₽=❌₾/);
  assert.match(await calculateRatesToRub("GEL", 1000), /❌₽=1000₾/);
});

test("rate messages include English ₽ trend insights", async () => {
  const now = Date.now();
  await db.push(
    "/rates",
    {
      ...rates,
      CBRRateUSD: 93,
      updatedDate: now,
      history: [
        ...weeklyUsdHistory(now),
        {
          key: "CBRRateUSD",
          value: 90,
          updatedDate: now - 24 * hour - 30 * 60 * 1000,
        },
        {
          key: "CBRRateUSD",
          value: 91,
          updatedDate: now - 24 * hour + 30 * 60 * 1000,
        },
        { key: "CBRRateUSD", value: 92, updatedDate: now - 30 * 60 * 1000 },
        { key: "CBRRateUSD", value: 93, updatedDate: now },
      ],
    },
    true
  );

  assert.match(
    await getRates(),
    /1\$=93\.00₽ ↑ \+2\.50₽ over 24h, above 7d avg by 1\.50₽/
  );
  assert.match(
    await calculateRatesFromRub("USD", 930),
    /930₽=10\.00\$ \(rate ↑ \+2\.50₽ over 24h, above 7d avg by 1\.50₽\)/
  );
});

test("updateRates keeps previous provider values when one provider fails", async () => {
  const now = Date.now();
  await db.push(
    "/rates",
    {
      ...rates,
      history: [
        { key: "koronaRateUSD", value: 90, updatedDate: now - 24 * hour },
        { key: "koronaRateUSD", value: 95, updatedDate: now - hour },
      ],
    },
    true
  );
  const error = console.error;
  console.error = () => {};

  try {
    const result = await updateRates({
      koronaGelRate: async () => 34,
      koronaUsdRate: async () => {
        throw new Error("korona usd down");
      },
      CBRRates: async () => [91, 36],
    });

    assert.equal(result?.koronaRateGEL, 34);
    assert.equal(result?.koronaRateUSD, 95);
    assert.equal(result?.CBRRateUSD, 91);
    assert.equal(result?.CBRRateGEL, 36);
    assert.equal(
      result?.history?.some((point) => {
        return (
          point.key === "koronaRateUSD" &&
          point.updatedDate === result.updatedDate
        );
      }),
      false
    );
    assert.match(
      await getRates(),
      /KoronaPay\n1₾=34\.00₽\n1\$=95\.00₽\n/
    );
  } finally {
    console.error = error;
  }
});

test("updateRates keeps previous CBR values when CBR provider fails", async () => {
  await db.push("/rates", rates, true);
  const error = console.error;
  console.error = () => {};

  try {
    const result = await updateRates({
      koronaGelRate: async () => 41,
      koronaUsdRate: async () => 96,
      CBRRates: async () => {
        throw new Error("cbr down");
      },
    });

    assert.equal(result?.koronaRateGEL, 41);
    assert.equal(result?.koronaRateUSD, 96);
    assert.equal(result?.CBRRateUSD, 90);
    assert.equal(result?.CBRRateGEL, 35);
  } finally {
    console.error = error;
  }
});

test("updateRates replaces stored history instead of merging it", async () => {
  const providers = {
    koronaGelRate: async () => 40,
    koronaUsdRate: async () => 95,
    CBRRates: async () => [90, 35],
  };

  await updateRates(providers);
  await updateRates(providers);
  await updateRates(providers);
  await updateRates(providers);
  const result = await updateRates(providers);
  const stored = await getStoredRates();

  assert.equal(result?.history?.length, 20);
  assert.equal(stored?.history?.length, 20);
});

test("updateRates stores unavailable markers on empty db when providers return invalid data", async () => {
  const result = await updateRates({
    koronaGelRate: async () => 0,
    koronaUsdRate: async () => Number.NaN,
    CBRRates: async () => [91],
  });

  assert.equal(result?.koronaRateGEL, -1);
  assert.equal(result?.koronaRateUSD, -1);
  assert.equal(result?.CBRRateUSD, 91);
  assert.equal(result?.CBRRateGEL, -1);
  assert.equal(typeof result?.updatedDate, "number");
  assert.deepEqual(
    result?.history?.map(({ key, value }) => ({ key, value })),
    [{ key: "CBRRateUSD", value: 91 }]
  );
  assert.deepEqual(await getStoredRates(), result);
});

test("updateRates returns null when db write fails", async () => {
  const push = db.push.bind(db);
  const error = console.error;
  console.error = () => {};
  db.push = async () => {
    throw new Error("db write failed");
  };

  try {
    const result = await updateRates({
      koronaGelRate: async () => 40,
      koronaUsdRate: async () => 95,
      CBRRates: async () => [90, 35],
    });

    assert.equal(result, null);
  } finally {
    db.push = push;
    console.error = error;
  }
});

test("docker config persists the same db path used by runtime", () => {
  assert.match(fs.readFileSync("Dockerfile", "utf8"), /VOLUME \/app\/db/);
  assert.match(fs.readFileSync(".dockerignore", "utf8"), /^dist$/m);
  assert.match(fs.readFileSync(".gitignore", "utf8"), /^db\/$/m);
});
