# TypeScript Type Definitions - Exchange Rates Bot

This document provides comprehensive TypeScript type definitions for all public APIs, interfaces, and types used in the Exchange Rates Bot project.

## Table of Contents

1. [Core Types](#core-types)
2. [API Types](#api-types)
3. [Database Types](#database-types)
4. [Bot Types](#bot-types)
5. [Helper Types](#helper-types)
6. [External Library Types](#external-library-types)
7. [Type Guards](#type-guards)
8. [Utility Types](#utility-types)

---

## Core Types

### Currency Types

```typescript
/**
 * Supported currency codes
 */
export type SupportedCurrency = "GEL" | "USD";

/**
 * Currency code with RUB included
 */
export type CurrencyCode = "RUB" | "GEL" | "USD";

/**
 * Currency enum for KoronaPay API
 */
export enum CurrenciesEnum {
  "GEL" = "981",
  "USD" = "840",
}

/**
 * Currency conversion direction
 */
export type ConversionDirection = "TO_GEL" | "TO_USD" | "FROM_GEL" | "FROM_USD";
```

### Rate Types

```typescript
/**
 * Main rates interface stored in database
 */
export interface Rates {
  /** KoronaPay rate for GEL */
  koronaRateGEL: number;
  /** KoronaPay rate for USD */
  koronaRateUSD: number;
  /** Central Bank of Russia rate for USD */
  CBRRateUSD: number;
  /** Central Bank of Russia rate for GEL */
  CBRRateGEL: number;
  /** ByBit rate for buying RUB with USDT */
  ByBitBuyRUBToUsdt: number;
  /** ByBit rate for selling USDT to GEL */
  ByBitSellUsdtToGEL: number;
  /** ByBit rate for selling USDT to USD */
  ByBitSellUsdtToUSD: number;
  /** Timestamp of last update */
  updatedDate: number;
}

/**
 * Rate calculation result
 */
export interface RateCalculation {
  /** Source currency */
  from: CurrencyCode;
  /** Target currency */
  to: CurrencyCode;
  /** Input amount */
  amount: number;
  /** Calculated result */
  result: number;
  /** Exchange rate used */
  rate: number;
  /** Platform providing the rate */
  platform: RatePlatform;
}

/**
 * Rate platform types
 */
export type RatePlatform = "ByBit" | "KoronaPay" | "CBR";
```

---

## API Types

### KoronaPay API Types

```typescript
/**
 * KoronaPay API request parameters
 */
export interface KoronaPayRequest {
  sendingCountryId: "RUS";
  sendingCurrencyId: "810"; // RUB
  receivingCountryId: "GEO";
  receivingCurrencyId: "981" | "840"; // GEL | USD
  paymentMethod: "debitCard";
  receivingAmount: string;
  receivingMethod: "cash";
  paidNotificationEnabled: "false";
}

/**
 * KoronaPay API response structure
 */
export interface KoronaPayResponse {
  exchangeRate: number;
  fee: number;
  total: number;
  // ... other fields
}

/**
 * KoronaPay rates function signature
 */
export declare function getKoronaPayRates(
  receivingCurrency: keyof typeof CurrenciesEnum
): Promise<number | string>;
```

### CBR API Types

```typescript
/**
 * CBR API response structure
 */
export interface CBRResponse {
  Date: string;
  PreviousDate: string;
  PreviousURL: string;
  Timestamp: string;
  Valute: {
    [currencyCode: string]: {
      ID: string;
      NumCode: string;
      CharCode: string;
      Nominal: number;
      Name: string;
      Value: number;
      Previous: number;
    };
  };
}

/**
 * CBR rates function signature
 */
export declare function getCBRRates(
  currencies: ("USD" | "GEL")[]
): Promise<(number | string)[]>;
```

### ByBit API Types

```typescript
/**
 * ByBit payment method enum
 */
export enum PaymentTypeEnum {
  "SBP Fast Bank Transfer" = 14,
  "Bank of Georgia" = 11,
}

/**
 * ByBit transaction side enum
 */
export enum SideEnum {
  "sell" = 0,
  "buy" = 1,
}

/**
 * ByBit rates argument type
 */
export type ByBitRatesArgType = { type: "sell" | "buy" } & (
  | {
      currency: "RUB";
      paymentMethod: "SBP Fast Bank Transfer";
    }
  | {
      currency: "GEL";
      paymentMethod: "Bank of Georgia";
    }
  | {
      currency: "USD";
      paymentMethod: "Bank of Georgia";
    }
);

/**
 * ByBit API request body
 */
export interface ByBitRequest {
  tokenId: "USDT";
  currencyId: "RUB" | "GEL" | "USD";
  payment: string[];
  side: string;
  size: string;
  page: string;
  amount: string;
  authMaker: boolean;
  canTrade: boolean;
}

/**
 * ByBit API response structure
 */
export interface ByBitResponse {
  result: {
    items: Array<{
      price: string;
      quantity: string;
      // ... other fields
    }>;
  };
}

/**
 * ByBit rates function signature
 */
export declare function getByBitRates(
  args: ByBitRatesArgType
): Promise<number>;
```

---

## Database Types

### Database Configuration

```typescript
/**
 * Database configuration options
 */
export interface DatabaseConfig {
  /** Database file path */
  path: string;
  /** Save on push */
  saveOnPush: boolean;
  /** Human readable format */
  humanReadable: boolean;
  /** Path separator */
  separator: string;
}

/**
 * Database instance type
 */
export interface DatabaseInstance {
  push(path: string, data: any, override?: boolean): Promise<void>;
  getData(path: string): Promise<any>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
```

### User Data Types

```typescript
/**
 * User data stored in database
 */
export interface UserData {
  /** Last sum used for calculations */
  lastSumToCalculate?: number;
  /** User preferences */
  preferences?: UserPreferences;
  /** Last interaction timestamp */
  lastInteraction?: number;
}

/**
 * User preferences
 */
export interface UserPreferences {
  /** Default currency */
  defaultCurrency?: SupportedCurrency;
  /** Notification settings */
  notifications?: boolean;
  /** Language preference */
  language?: "en" | "ru";
}

/**
 * Database structure
 */
export interface DatabaseStructure {
  rates: Rates;
  users: {
    [chatId: string]: UserData;
  };
}
```

---

## Bot Types

### Grammy Bot Types

```typescript
/**
 * Bot context type
 */
export interface BotContext {
  message?: {
    text?: string;
    chat: {
      id: number;
    };
  };
  from?: {
    id: number;
    username?: string;
  };
  chat?: {
    id: number;
  };
  hasCommand(command: string): boolean;
  reply(text: string, extra?: any): Promise<void>;
  editMessageText(text: string, extra?: any): Promise<void>;
  answerCallbackQuery(text?: string): Promise<void>;
}

/**
 * Bot command configuration
 */
export interface BotCommand {
  command: string;
  description: string;
}

/**
 * Bot commands list
 */
export interface BotCommands {
  start: BotCommand;
  rates: BotCommand;
}
```

### Keyboard Types

```typescript
/**
 * Inline keyboard button configuration
 */
export interface InlineKeyboardButton {
  text: string;
  command: ConversionDirection;
}

/**
 * Keyboard configuration
 */
export interface KeyboardConfig {
  buttons: InlineKeyboardButton[];
  activeButton?: ConversionDirection;
}
```

---

## Helper Types

### Utility Types

```typescript
/**
 * Rate comparison item
 */
export interface RateComparisonItem {
  label: RatePlatform;
  value: number;
}

/**
 * Best rate finder utility
 */
export interface BestRateFinder {
  findMin(values: RateComparisonItem[]): RatePlatform;
  findMax(values: RateComparisonItem[]): RatePlatform;
}

/**
 * Time difference calculation
 */
export declare function getTimeDiffInMinutes(date: number): number;
```

### Calculation Types

```typescript
/**
 * Rate calculation function signature
 */
export declare function calculateRatesFromRub(
  currency: SupportedCurrency,
  sum: number
): Promise<string>;

/**
 * Reverse rate calculation function signature
 */
export declare function calculateRatesToRub(
  currency: SupportedCurrency,
  sum: number
): Promise<string>;

/**
 * Rate display function signature
 */
export declare function getRates(): Promise<string>;
```

---

## External Library Types

### Grammy Framework Types

```typescript
/**
 * Grammy Bot instance
 */
export interface GrammyBot {
  start(): void;
  stop(): void;
  command(commands: string[], handler: (ctx: BotContext) => Promise<void>): void;
  on(filter: string, handler: (ctx: BotContext) => Promise<void>): void;
  callbackQuery(data: string, handler: (ctx: BotContext) => Promise<void>): void;
  catch(handler: (error: any) => void): void;
  api: {
    setMyCommands(commands: BotCommand[]): Promise<void>;
  };
}

/**
 * Grammy keyboard types
 */
export interface GrammyKeyboard {
  text(text: string): GrammyKeyboard;
  row(): GrammyKeyboard;
  resized(): GrammyKeyboard;
  persistent(): GrammyKeyboard;
  placeholder(text: string): GrammyKeyboard;
}

/**
 * Grammy inline keyboard
 */
export interface GrammyInlineKeyboard {
  text(text: string, callbackData: string): GrammyInlineKeyboard;
  row(): GrammyInlineKeyboard;
}
```

### Cron Job Types

```typescript
/**
 * Cron job configuration
 */
export interface CronJobConfig {
  pattern: string;
  handler: () => Promise<void>;
  timezone?: string;
  start?: boolean;
}

/**
 * Cron job instance
 */
export interface CronJobInstance {
  start(): void;
  stop(): void;
  destroy(): void;
  running: boolean;
}
```

### HTTP Client Types

```typescript
/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  retry?: {
    limit: number;
    backoffLimit: number;
  };
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * HTTP client instance
 */
export interface HttpClientInstance {
  get(url: string, options?: any): Promise<any>;
  post(url: string, options?: any): Promise<any>;
  json(): Promise<any>;
}
```

---

## Type Guards

### Currency Type Guards

```typescript
/**
 * Type guard for supported currency
 */
export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return currency === "GEL" || currency === "USD";
}

/**
 * Type guard for currency code
 */
export function isCurrencyCode(code: string): code is CurrencyCode {
  return code === "RUB" || code === "GEL" || code === "USD";
}

/**
 * Type guard for conversion direction
 */
export function isConversionDirection(direction: string): direction is ConversionDirection {
  return ["TO_GEL", "TO_USD", "FROM_GEL", "FROM_USD"].includes(direction);
}
```

### Rate Type Guards

```typescript
/**
 * Type guard for valid rate
 */
export function isValidRate(rate: any): rate is number {
  return typeof rate === "number" && rate > 0 && !isNaN(rate);
}

/**
 * Type guard for rates object
 */
export function isRatesObject(obj: any): obj is Rates {
  return obj &&
    typeof obj.koronaRateGEL === "number" &&
    typeof obj.koronaRateUSD === "number" &&
    typeof obj.CBRRateUSD === "number" &&
    typeof obj.CBRRateGEL === "number" &&
    typeof obj.ByBitBuyRUBToUsdt === "number" &&
    typeof obj.ByBitSellUsdtToGEL === "number" &&
    typeof obj.ByBitSellUsdtToUSD === "number" &&
    typeof obj.updatedDate === "number";
}

/**
 * Type guard for rate platform
 */
export function isRatePlatform(platform: string): platform is RatePlatform {
  return ["ByBit", "KoronaPay", "CBR"].includes(platform);
}
```

---

## Utility Types

### Generic Utility Types

```typescript
/**
 * Make all properties optional
 */
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

/**
 * Make all properties required
 */
export type Required<T> = {
  [P in keyof T]-?: T[P];
};

/**
 * Pick specific properties
 */
export type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

/**
 * Omit specific properties
 */
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
```

### API Response Utilities

```typescript
/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  timestamp: number;
}

/**
 * API error response
 */
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

/**
 * Rate update result
 */
export interface RateUpdateResult {
  success: boolean;
  updatedAt: number;
  errors?: string[];
  rates?: Partial<Rates>;
}
```

### Function Signatures

```typescript
/**
 * Rate fetcher function type
 */
export type RateFetcher<T> = () => Promise<T>;

/**
 * Rate calculator function type
 */
export type RateCalculator = (
  currency: SupportedCurrency,
  amount: number
) => Promise<string>;

/**
 * Error handler function type
 */
export type ErrorHandler = (error: Error, context?: any) => void;

/**
 * Message handler function type
 */
export type MessageHandler = (ctx: BotContext) => Promise<void>;
```

---

## Advanced Types

### Conditional Types

```typescript
/**
 * Currency-specific rate type
 */
export type CurrencyRate<T extends SupportedCurrency> = T extends "GEL"
  ? {
      koronaRateGEL: number;
      CBRRateGEL: number;
      ByBitSellUsdtToGEL: number;
    }
  : T extends "USD"
  ? {
      koronaRateUSD: number;
      CBRRateUSD: number;
      ByBitSellUsdtToUSD: number;
    }
  : never;

/**
 * Platform-specific configuration
 */
export type PlatformConfig<T extends RatePlatform> = T extends "ByBit"
  ? ByBitRatesArgType
  : T extends "KoronaPay"
  ? { currency: SupportedCurrency }
  : T extends "CBR"
  ? { currencies: SupportedCurrency[] }
  : never;
```

### Mapped Types

```typescript
/**
 * Rate update status for each platform
 */
export type PlatformStatus = {
  [K in RatePlatform]: {
    lastUpdate: number;
    isHealthy: boolean;
    error?: string;
  };
};

/**
 * Currency conversion rates
 */
export type ConversionRates = {
  [K in SupportedCurrency]: {
    [P in RatePlatform]: number;
  };
};
```

---

## Module Declarations

### External Module Types

```typescript
/**
 * Grammy module declarations
 */
declare module "grammy" {
  export class Bot {
    constructor(token: string);
    start(): void;
    stop(): void;
    command(commands: string[], handler: any): void;
    on(filter: string, handler: any): void;
    callbackQuery(data: string, handler: any): void;
    catch(handler: any): void;
    api: any;
  }
  
  export class Keyboard {
    text(text: string): Keyboard;
    row(): Keyboard;
    resized(): Keyboard;
    persistent(): Keyboard;
    placeholder(text: string): Keyboard;
  }
  
  export class InlineKeyboard {
    text(text: string, callbackData: string): InlineKeyboard;
    row(): InlineKeyboard;
  }
  
  export class InlineQueryResultBuilder {
    static article(id: string, title: string): any;
  }
}

/**
 * Node JSON DB module declarations
 */
declare module "node-json-db" {
  export class JsonDB {
    constructor(config: any);
    push(path: string, data: any, override?: boolean): Promise<void>;
    getData(path: string): Promise<any>;
    delete(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
  }
  
  export class Config {
    constructor(filename: string, saveOnPush: boolean, humanReadable: boolean, separator: string);
  }
}

/**
 * Cron module declarations
 */
declare module "cron" {
  export class CronJob {
    constructor(pattern: string, handler: () => void);
    start(): void;
    stop(): void;
    destroy(): void;
    running: boolean;
  }
}
```

---

## Usage Examples

### Type-Safe API Usage

```typescript
// Type-safe currency conversion
const convertCurrency = async (
  from: CurrencyCode,
  to: SupportedCurrency,
  amount: number
): Promise<RateCalculation> => {
  // Implementation with full type safety
};

// Type-safe rate fetching
const fetchRates = async (): Promise<Rates> => {
  // Implementation with type guards
};

// Type-safe bot handler
const handleMessage: MessageHandler = async (ctx) => {
  // Full type safety for bot context
};
```

### Type Guards in Practice

```typescript
// Safe rate processing
const processRates = (data: unknown): Rates | null => {
  if (isRatesObject(data)) {
    return data; // TypeScript knows this is Rates
  }
  return null;
};

// Safe currency validation
const validateCurrency = (input: string): SupportedCurrency | null => {
  if (isSupportedCurrency(input)) {
    return input; // TypeScript knows this is SupportedCurrency
  }
  return null;
};
```

---

This comprehensive type definitions document ensures full TypeScript support and type safety throughout the Exchange Rates Bot project. All public APIs, interfaces, and types are properly defined with JSDoc comments for enhanced developer experience.