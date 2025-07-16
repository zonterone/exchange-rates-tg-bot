# Exchange Rates Bot API Documentation

## Overview

This is a comprehensive API documentation for the Exchange Rates Telegram Bot. The bot fetches exchange rates from multiple sources (KoronaPay, Central Bank of Russia, ByBit) and provides users with real-time currency conversion capabilities.

## Project Structure

```
src/
├── api.ts              # External API integrations
├── bot.ts              # Telegram bot setup and handlers
├── calculateRates.ts   # Rate calculation functions
├── getRates.ts         # Rate formatting and display
├── updateRates.ts      # Rate update orchestration
├── helpers.ts          # Utility functions
├── db.ts              # Database configuration
└── main.ts            # Application entry point
```

## Core Components

### 1. API Module (`api.ts`)

This module handles all external API integrations for fetching exchange rates.

#### `getKoronaPayRates(receivingCurrency: "GEL" | "USD"): Promise<number | string>`

Fetches exchange rates from KoronaPay API for transfers from Russia to Georgia.

**Parameters:**
- `receivingCurrency`: Target currency code ("GEL" or "USD")

**Returns:** Promise resolving to exchange rate or -1 if failed

**Example:**
```typescript
import { getKoronaPayRates } from './api';

// Get GEL exchange rate
const gelRate = await getKoronaPayRates("GEL");
console.log(`1 RUB = ${gelRate} GEL`);

// Get USD exchange rate
const usdRate = await getKoronaPayRates("USD");
console.log(`1 RUB = ${usdRate} USD`);
```

#### `getCBRRates(currencies: ("USD" | "GEL")[]): Promise<(number | string)[]>`

Fetches official exchange rates from Central Bank of Russia.

**Parameters:**
- `currencies`: Array of currency codes to fetch rates for

**Returns:** Promise resolving to array of exchange rates

**Example:**
```typescript
import { getCBRRates } from './api';

// Get both USD and GEL rates
const rates = await getCBRRates(["USD", "GEL"]);
const [usdRate, gelRate] = rates;
console.log(`CBR rates - USD: ${usdRate}, GEL: ${gelRate}`);
```

#### `getByBitRates(args: ByBitRatesArgType): Promise<number>`

Fetches P2P exchange rates from ByBit platform.

**Parameters:**
- `args`: Configuration object with currency, payment method, and transaction type

**Types:**
```typescript
type ByBitRatesArgType = { type: "sell" | "buy" } & (
  | { currency: "RUB"; paymentMethod: "SBP Fast Bank Transfer"; }
  | { currency: "GEL"; paymentMethod: "Bank of Georgia"; }
  | { currency: "USD"; paymentMethod: "Bank of Georgia"; }
);
```

**Example:**
```typescript
import { getByBitRates } from './api';

// Get RUB to USDT buy rate
const rubToUsdtRate = await getByBitRates({
  currency: "RUB",
  paymentMethod: "SBP Fast Bank Transfer",
  type: "buy"
});

// Get USDT to GEL sell rate
const usdtToGelRate = await getByBitRates({
  currency: "GEL",
  paymentMethod: "Bank of Georgia",
  type: "sell"
});
```

---

### 2. Bot Module (`bot.ts`)

This module contains the Telegram bot configuration and message handlers.

#### `bot: Bot`

Main bot instance configured with handlers for commands and messages.

**Features:**
- Command handling (`/start`, `/rates`)
- Text message processing for currency calculations
- Inline keyboards for rate conversion
- Inline query support

**Commands:**
- `/start` - Initialize bot and display welcome message
- `/rates` - Get current exchange rates

**Example Usage:**
```typescript
import { bot } from './bot';

// Start the bot
bot.start();

// Handle graceful shutdown
process.once('SIGINT', () => bot.stop());
```

#### Bot Handlers

**Text Message Handler:**
- Processes "Get rates 💸" button clicks
- Handles numeric input for currency calculations
- Responds with formatted rate information

**Callback Query Handlers:**
- `TO_GEL`: Convert RUB to GEL
- `TO_USD`: Convert RUB to USD  
- `FROM_GEL`: Convert GEL to RUB
- `FROM_USD`: Convert USD to RUB

**Inline Query Handler:**
- Allows sharing current rates in any chat

---

### 3. Calculate Rates Module (`calculateRates.ts`)

This module provides functions for currency conversion calculations.

#### `calculateRatesFromRub(currency: "GEL" | "USD", sum: number): Promise<string>`

Calculates how much foreign currency you get for a given RUB amount.

**Parameters:**
- `currency`: Target currency ("GEL" or "USD")
- `sum`: Amount in RUB to convert

**Returns:** Promise resolving to formatted calculation string

**Example:**
```typescript
import { calculateRatesFromRub } from './calculateRates';

// Calculate 1000 RUB to GEL
const result = await calculateRatesFromRub("GEL", 1000);
console.log(result);
// Output: 
// CBR
// RUB->GEL: 1000RUB=25.64GEL
// -------------------------
// ByBit
// RUB->USDT->GEL: 1000RUB=26.15GEL 👍
// -------------------------
// KoronaPay
// RUB->GEL: 1000RUB=25.89GEL
// -------------------------
// Last update: 5 minutes ago
```

#### `calculateRatesToRub(currency: "GEL" | "USD", sum: number): Promise<string>`

Calculates how much RUB you need for a given foreign currency amount.

**Parameters:**
- `currency`: Source currency ("GEL" or "USD")
- `sum`: Amount in foreign currency

**Returns:** Promise resolving to formatted calculation string

**Example:**
```typescript
import { calculateRatesToRub } from './calculateRates';

// Calculate how much RUB needed for 100 USD
const result = await calculateRatesToRub("USD", 100);
console.log(result);
// Output:
// CBR
// RUB->USD: 9650.00RUB=100USD
// -------------------------
// ByBit
// RUB->USDT->USD: 9580.50RUB=100USD 👍
// -------------------------
// KoronaPay
// RUB->USD: 9625.00RUB=100USD
// -------------------------
// Last update: 5 minutes ago
```

---

### 4. Get Rates Module (`getRates.ts`)

This module formats and displays current exchange rates.

#### `getRates(): Promise<string>`

Retrieves and formats current exchange rates from all sources.

**Returns:** Promise resolving to formatted rates string

**Example:**
```typescript
import { getRates } from './getRates';

const rates = await getRates();
console.log(rates);
// Output:
// CBR
// RUB->GEL: 1GEL=39.45RUB
// RUB->USD: 1USD=96.50RUB
// -------------------------
// KoronaPay
// RUB->GEL: 1GEL=38.95RUB 👍
// RUB->USD: 1USD=96.25RUB 👍
// -------------------------
// ByBit
// Buy: 1USDT=96.80RUB
// Sell: 1USDT=2.48GEL
// Sell: 1USDT=1.00USD
// RUB->USDT->GEL: 1GEL=39.03RUB
// RUB->USDT->USD: 1USD=96.80RUB
// -------------------------
// Last update: 5 minutes ago
```

---

### 5. Update Rates Module (`updateRates.ts`)

This module orchestrates rate updates from all external sources.

#### `updateRates(): Promise<void>`

Fetches rates from all sources and updates the database.

**Process:**
1. Fetches rates from KoronaPay (GEL, USD)
2. Fetches rates from CBR (USD, GEL)
3. Fetches rates from ByBit (RUB->USDT, USDT->GEL, USDT->USD)
4. Normalizes and stores data in database

**Example:**
```typescript
import { updateRates } from './updateRates';

// Update rates manually
await updateRates();

// Or set up automatic updates
import { CronJob } from 'cron';
const updateRatesCron = new CronJob("*/30 * * * *", async () => {
  await updateRates();
});
updateRatesCron.start();
```

#### `Rates` Interface

```typescript
interface Rates {
  koronaRateGEL: number;
  koronaRateUSD: number;
  CBRRateUSD: number;
  CBRRateGEL: number;
  ByBitBuyRUBToUsdt: number;
  ByBitSellUsdtToGEL: number;
  ByBitSellUsdtToUSD: number;
  updatedDate: number;
}
```

---

### 6. Helpers Module (`helpers.ts`)

This module contains utility functions.

#### `getTimeDiffInMinutes(date: number): number`

Calculates time difference in minutes from a timestamp.

**Parameters:**
- `date`: Timestamp in milliseconds

**Returns:** Time difference in minutes

**Example:**
```typescript
import { getTimeDiffInMinutes } from './helpers';

const timestamp = new Date().getTime() - 300000; // 5 minutes ago
const diff = getTimeDiffInMinutes(timestamp);
console.log(`${diff} minutes ago`); // Output: 5 minutes ago
```

#### `findBestRateLabel`

Utility object for finding best rates between platforms.

**Methods:**
- `findMin(values: Item[]): string` - Finds platform with minimum rate
- `findMax(values: Item[]): string` - Finds platform with maximum rate

**Example:**
```typescript
import { findBestRateLabel } from './helpers';

const rates = [
  { label: "ByBit", value: 38.95 },
  { label: "KoronaPay", value: 39.45 }
];

const bestPlatform = findBestRateLabel.findMin(rates);
console.log(`Best platform: ${bestPlatform}`); // Output: Best platform: ByBit
```

---

### 7. Database Module (`db.ts`)

This module configures the JSON database.

#### `db: JsonDB`

Database instance for storing rates and user data.

**Configuration:**
- File path: `db/db.json`
- Human readable: `true`
- Save on push: `true`
- Separator: `/`

**Example:**
```typescript
import { db } from './db';

// Store rates
await db.push('/rates', ratesData, false);

// Retrieve rates
const rates = await db.getData('/rates');

// Store user data
await db.push(`/users/${chatId}`, { lastSumToCalculate: 1000 }, false);
```

---

### 8. Main Module (`main.ts`)

This is the application entry point that orchestrates the entire system.

#### Application Lifecycle

**Initialization:**
1. Starts the Telegram bot
2. Sets up error handling
3. Performs initial rate update
4. Starts cron job for periodic updates (every 30 minutes)
5. Sets up graceful shutdown handlers

**Error Handling:**
- Catches Grammy errors (Telegram API errors)
- Catches HTTP errors (network issues)
- Logs unknown errors

**Example:**
```typescript
import { bot } from './bot';
import { updateRates } from './updateRates';
import { CronJob } from 'cron';

// Start bot
bot.start();

// Initial update
await updateRates();

// Schedule updates
const updateRatesCron = new CronJob("*/30 * * * *", async () => {
  await updateRates();
});
updateRatesCron.start();

// Graceful shutdown
process.once('SIGINT', () => {
  bot.stop();
  updateRatesCron.stop();
});
```

---

## Usage Examples

### Basic Bot Usage

1. **Start the bot:**
   ```bash
   npm start
   ```

2. **Get current rates:**
   - Send `/rates` command
   - Click "Get rates 💸" button
   - Use inline query `@botusername` in any chat

3. **Calculate conversions:**
   - Send any number (e.g., `1000`)
   - Bot will show RUB to GEL conversion
   - Use inline buttons to switch between currencies

### Integration Examples

#### Using API Functions Directly

```typescript
import { getKoronaPayRates, getCBRRates, getByBitRates } from './api';

// Get rates from all sources
const koronaGEL = await getKoronaPayRates("GEL");
const cbrRates = await getCBRRates(["USD", "GEL"]);
const bybitRUB = await getByBitRates({
  currency: "RUB",
  paymentMethod: "SBP Fast Bank Transfer",
  type: "buy"
});

console.log({
  koronaGEL,
  cbrUSD: cbrRates[0],
  cbrGEL: cbrRates[1],
  bybitRUB
});
```

#### Custom Rate Calculations

```typescript
import { calculateRatesFromRub } from './calculateRates';

// Calculate multiple amounts
const amounts = [100, 500, 1000, 5000];
const currency = "GEL";

for (const amount of amounts) {
  const result = await calculateRatesFromRub(currency, amount);
  console.log(`${amount} RUB calculation:`);
  console.log(result);
  console.log("---");
}
```

---

## Environment Variables

The bot requires the following environment variables:

```env
BOT_TOKEN=your_telegram_bot_token_here
```

---

## Dependencies

### Production Dependencies
- `grammy` - Telegram bot framework
- `cron` - Job scheduling
- `dotenv` - Environment variable management
- `ky` - HTTP client
- `node-json-db` - JSON database
- `uuid` - UUID generation

### Development Dependencies
- `typescript` - TypeScript compiler
- `webpack` - Module bundler
- `ts-loader` - TypeScript loader for webpack
- Various type definitions

---

## Error Handling

The bot includes comprehensive error handling:

1. **API Errors:** Returns -1 for failed API calls
2. **Network Errors:** Includes retry logic with exponential backoff
3. **Database Errors:** Gracefully handles database read/write failures
4. **Bot Errors:** Catches and logs Grammy and HTTP errors

---

## Performance Considerations

- **Caching:** Rates are cached in database and updated every 30 minutes
- **Parallel Requests:** Uses `Promise.all()` for concurrent API calls
- **Retry Logic:** Automatic retry with backoff for failed requests
- **Timeout:** 60-second timeout for API requests

---

## Rate Sources

1. **KoronaPay:** Real-time transfer rates from Russia to Georgia
2. **CBR:** Official Central Bank of Russia exchange rates
3. **ByBit:** P2P cryptocurrency exchange rates

The bot automatically identifies the best rates and marks them with 👍 emoji.

---

## Data Storage

Rates are stored in JSON format with the following structure:

```json
{
  "rates": {
    "koronaRateGEL": 38.95,
    "koronaRateUSD": 96.25,
    "CBRRateUSD": 96.50,
    "CBRRateGEL": 39.45,
    "ByBitBuyRUBToUsdt": 96.80,
    "ByBitSellUsdtToGEL": 2.48,
    "ByBitSellUsdtToUSD": 1.00,
    "updatedDate": 1640995200000
  },
  "users": {
    "chatId": {
      "lastSumToCalculate": 1000
    }
  }
}
```

---

## Contributing

When extending the bot:

1. Follow the existing module structure
2. Add comprehensive type definitions
3. Include error handling for all API calls
4. Update this documentation for new features
5. Add examples for new public functions

---

## License

This project is licensed under the MIT License.