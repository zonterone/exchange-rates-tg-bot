# Exchange Bot – API Reference

This document describes all **public APIs, functions, and components** exposed by the code-base located in the `src/` directory.  Each section lists the signature, a detailed description, parameters, return value, and runnable examples.

> All code‐samples are written in TypeScript and can be executed from any module within the repository unless stated otherwise.

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Database helper](#database-helper)
3. [Low-level REST wrappers (`api.ts`)](#low-level-rest-wrappers-apits)
   * `getKoronaPayRates()`
   * `getCBRRates()`
   * `getByBitRates()`
4. [Rates aggregation utilities](#rates-aggregation-utilities)
   * `updateRates()`
   * `getRates()`
   * `calculateRatesFromRub()`
   * `calculateRatesToRub()`
5. [Generic helpers](#generic-helpers)
   * `getTimeDiffInMinutes()`
   * `findBestRateLabel`
6. [Telegram bot (`bot.ts`)](#telegram-bot-botts)
7. [Application entry-point (`main.ts`)](#application-entry-point-maints)

---

## Prerequisites

1. **Install dependencies**
   ```bash
   npm ci        # or: pnpm i, yarn install
   ```
2. **Environment variables**
   The Telegram bot requires a **Bot Token** issued by @BotFather.  Create a `.env` file at the repository root:
   ```env
   BOT_TOKEN=<your-telegram-token>
   ```
3. **Build / run**
   ```bash
   # Development – automatically re-runs with ts-node
   npm run dev

   # Production (after bundling with webpack)
   npm start
   ```

---

## Database helper

### `db`  
*Module *: `src/db.ts`

A pre-configured instance of [`node-json-db`](https://www.npmjs.com/package/node-json-db) pointing to the local file system.

```ts
import { db } from "./db";

await db.push("/path", { any: "json" }, true);
const data = await db.getData("/path");
```

The database is stored inside `dist/db/db.json` (generated at run-time).  **Never** commit this file.

---

## Low-level REST wrappers (`api.ts`)

All functions below are thin wrappers around external REST endpoints; they normalise responses and apply sensible network time-outs and retries.

### `getKoronaPayRates()`
```ts
getKoronaPayRates(receivingCurrency: "GEL" | "USD"): Promise<number | string>
```
Fetches the *buy* rate offered by **KoronaPay** for converting **RUB ➜ GEL/USD**.

| Parameter          | Type                         | Description                                                  |
|--------------------|------------------------------|--------------------------------------------------------------|
| `receivingCurrency`| `'GEL' \| 'USD'`             | Target currency the recipient receives.                     |

Returns **`number`** – the exchange rate.  In case of failure the function returns `-1` (as a sentinel) or a string message if the remote API responds with an error string.

**Example**
```ts
const gelRate = await getKoronaPayRates("GEL");
console.log(`1 GEL ≈ ${gelRate} RUB via KoronaPay`);
```

---

### `getCBRRates()`
```ts
getCBRRates(currencies: ("USD" | "GEL")[]): Promise<(number | string)[]>
```
Downloads daily reference rates from the **Central Bank of Russia**.

| Parameter    | Type                            | Description                          |
|--------------|---------------------------------|--------------------------------------|
| `currencies` | Array of `'USD'` and/or `'GEL'` | Which currency quotes to retrieve.   |

Returns an **array** whose order mirrors the `currencies` argument.  Non-numeric elements indicate that the API returned an unexpected value.

**Example**
```ts
const [usd, gel] = await getCBRRates(["USD", "GEL"]);
console.log(`CBR: 1 USD = ${usd} RUB, 1 GEL = ${gel} RUB`);
```

---

### `getByBitRates()`
```ts
getByBitRates(args: {
  type: "sell" | "buy";
} & (
  | { currency: "RUB"; paymentMethod: "SBP Fast Bank Transfer" }
  | { currency: "GEL"; paymentMethod: "Bank of Georgia" }
  | { currency: "USD"; paymentMethod: "Bank of Georgia" })
): Promise<number | string>
```
Queries **ByBit P2P** marketplace to estimate the *best* available quote for a specific trade side.

**Example – Buy USDT for RUB**
```ts
const price = await getByBitRates({
  currency: "RUB",
  paymentMethod: "SBP Fast Bank Transfer",
  type: "buy",
});
console.log(`Best price: 1 USDT ≈ ${price} RUB (buy)`);
```

---

## Rates aggregation utilities

### `updateRates()`
```ts
updateRates(): Promise<void>
```
Collects **all** individual sources listed above, normalises the data, and stores the combined object under `/rates` in the local JSON-DB.

> The function is invoked automatically every 30 minutes by the cron-job in `main.ts`, but can be executed on demand:

```ts
await updateRates();
```

The persisted structure conforms to the `Rates` interface:

```ts
interface Rates {
  koronaRateGEL: number;
  koronaRateUSD: number;
  CBRRateUSD: number;
  CBRRateGEL: number;
  ByBitBuyRUBToUsdt: number;
  ByBitSellUsdtToGEL: number;
  ByBitSellUsdtToUSD: number;
  updatedDate: number; // epoch-ms
}
```

---

### `getRates()`
```ts
getRates(): Promise<string>
```
Reads the latest snapshot from the DB and returns a **human-readable multi-line string** suitable for sending to a Telegram chat.

```ts
const message = await getRates();
console.log(message);
```

---

### `calculateRatesFromRub()`
```ts
calculateRatesFromRub(currency: "GEL" | "USD", sum: number): Promise<string>
```
Convenience helper that determines the *cheapest* way to purchase the target currency with a given amount of **RUB**, comparing **ByBit** and **KoronaPay**.

```ts
const text = await calculateRatesFromRub("USD", 10_000);
// -> human-readable explanation, ready for Telegram
```

### `calculateRatesToRub()`
```ts
calculateRatesToRub(currency: "GEL" | "USD", sum: number): Promise<string>
```
Performs the reverse calculation – what amount of **RUB** would be obtained when selling the specified foreign currency.

```ts
const text = await calculateRatesToRub("GEL", 150);
```

---

## Generic helpers

### `getTimeDiffInMinutes()`
```ts
getTimeDiffInMinutes(epochMs: number): number
```
Returns the difference between `epochMs` and *now* in whole minutes.

### `findBestRateLabel`
Utility object with two comparator functions that pick the optimum label from a list of `{ label, value }` pairs.

```ts
findBestRateLabel.findMin(items) // ➜ label with smallest value
findBestRateLabel.findMax(items) // ➜ label with largest value
```

---

## Telegram bot (`bot.ts`)

`bot` – an already initialised instance of `grammy.Bot` wired with the following features:

* **Commands**: `/start`, `/rates`
* **Reply-keyboard**: one-touch button *“Get rates 💸”*
* **Inline-query support**: type `@<bot-name>` in any chat to insert the current rates table.
* **Interactive calculations**: send a number (sum) and use the inline keyboard to switch between different conversion directions.

> The bot starts automatically when `main.ts` runs (`bot.start()`).  For testing you may import and start it in isolation:
>
> ```ts
> import { bot } from "./bot";
> bot.start();
> ```

---

## Application entry-point (`main.ts`)

`main.ts` wires everything together:

1. Starts the Telegram bot.
2. Schedules `updateRates()` to run every 30 minutes using `cron`.
3. Handles graceful shutdown on `SIGINT` / `SIGTERM`.

If you build your own service you may choose to keep `main.ts` as-is and instead consume the individual utilities documented above.

---

## Example scenario – custom CLI

Below is a minimal script demonstrating how to embed the library without the Telegram layer:

```ts
#!/usr/bin/env ts-node
import { updateRates } from "./src/updateRates";
import { calculateRatesFromRub } from "./src/calculateRates";

await updateRates();
const txt = await calculateRatesFromRub("GEL", 50_000);
console.log(txt);
```

Save the file as `cli.ts`, then run:

```bash
chmod +x cli.ts
./cli.ts
```

---

## License

This project is licensed under the MIT license.  See the root `LICENSE` file (if present) for details.