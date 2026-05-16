import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.BOT_TOKEN = "123:test";
process.env.DB_PATH = path.join(
  os.tmpdir(),
  `exchange-rates-bot-test-${process.pid}`,
  "db"
);

const { calculateRatesFromRub } = await import("../src/calculateRates");
const { db } = await import("../src/db");
const { getRates } = await import("../src/getRates");
const { getStoredRates, updateRates } = await import("../src/updateRates");

const rates = {
  koronaRateGEL: 40,
  koronaRateUSD: 95,
  CBRRateUSD: 90,
  CBRRateGEL: 35,
  updatedDate: Date.now(),
};

test("returns a cold-db message instead of throwing", async () => {
  assert.equal(await getStoredRates(), null);
  assert.equal(await getRates(), "Rates are not loaded yet. Try again later.");
  assert.equal(
    await calculateRatesFromRub("GEL", 1000),
    "Rates are not loaded yet. Try again later."
  );
});

test("rate messages contain only CBR and KoronaPay rates", async () => {
  await db.push("/rates", rates, true);

  const message = await getRates();
  assert.match(message, /CBR\nRUB->GEL: 1GEL=35\.00RUB/);
  assert.match(message, /KoronaPay\nRUB->GEL: 1GEL=40\.00RUB/);
  assert.doesNotMatch(message, /👍/);

  const calculated = await calculateRatesFromRub("GEL", 1000);
  assert.match(calculated, /KoronaPay\nRUB->GEL: 1000RUB=25\.00GEL/);
  assert.doesNotMatch(calculated, /👍/);
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

test("docker config persists the same db path used by runtime", () => {
  assert.match(fs.readFileSync("Dockerfile", "utf8"), /VOLUME \/app\/db/);
  assert.match(fs.readFileSync(".dockerignore", "utf8"), /^dist$/m);
});
