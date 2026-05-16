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
const { getStoredRates, updateRates } = await import("../src/updateRates");

const rates = {
  koronaRateGEL: 40,
  koronaRateUSD: 95,
  CBRRateUSD: 90,
  CBRRateGEL: 35,
  updatedDate: Date.now(),
};

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

test("rate messages contain only CBR and KoronaPay rates", async () => {
  await db.push("/rates", rates, true);

  const message = await getRates();
  assert.match(message, /CBR\nRUB->GEL: 1GEL=35\.00RUB/);
  assert.match(message, /KoronaPay\nRUB->GEL: 1GEL=40\.00RUB/);
  assert.doesNotMatch(message, /ByBit|USDT|👍/);

  const fromRub = await calculateRatesFromRub("GEL", 1000);
  assert.match(fromRub, /KoronaPay\nRUB->GEL: 1000RUB=25\.00GEL/);
  assert.doesNotMatch(fromRub, /ByBit|USDT|👍/);

  const toRub = await calculateRatesToRub("USD", 10);
  assert.match(toRub, /CBR\nRUB->USD: 900\.00RUB=10USD/);
  assert.match(toRub, /KoronaPay\nRUB->USD: 950\.00RUB=10USD/);
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

  assert.match(await getRates(), /RUB->GEL: 1GEL=❌RUB/);
  assert.match(await calculateRatesFromRub("GEL", 1000), /1000RUB=❌GEL/);
  assert.match(await calculateRatesToRub("GEL", 1000), /❌RUB=1000GEL/);
});

test("updateRates keeps previous provider values when one provider fails", async () => {
  await db.push("/rates", rates, true);
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
