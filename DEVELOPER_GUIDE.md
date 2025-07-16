# Developer Guide - Exchange Rates Bot

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Development Setup](#development-setup)
3. [Code Organization](#code-organization)
4. [API Integration Details](#api-integration-details)
5. [Data Flow](#data-flow)
6. [Testing Guidelines](#testing-guidelines)
7. [Deployment](#deployment)
8. [Monitoring and Logging](#monitoring-and-logging)
9. [Troubleshooting](#troubleshooting)
10. [Contributing Guidelines](#contributing-guidelines)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Telegram Bot                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │   bot.ts    │  │getRates.ts  │  │calculateRates│  │helpers.ts│ │
│  │   (Grammy)  │  │             │  │    .ts      │  │         │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │updateRates  │  │   api.ts    │  │   db.ts     │              │
│  │   .ts       │  │ (External)  │  │ (JsonDB)    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐                                                │
│  │   main.ts   │  ← Application Entry Point                      │
│  │   (Cron)    │                                                │
│  └─────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External APIs                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ KoronaPay   │  │    CBR      │  │   ByBit     │              │
│  │   API       │  │    API      │  │   API       │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

1. **Telegram Bot Layer**: Handles user interactions via Grammy framework
2. **Business Logic Layer**: Processes rate calculations and formatting
3. **Data Access Layer**: Manages database operations
4. **External API Layer**: Integrates with third-party rate providers
5. **Scheduler Layer**: Manages periodic rate updates

---

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/zonterone/exchange-rates-tg-bot.git
   cd exchange-rates-tg-bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment configuration:**
   ```bash
   cp .env.example .env
   # Edit .env with your bot token
   BOT_TOKEN=your_telegram_bot_token_here
   ```

4. **Development commands:**
   ```bash
   # Development mode with watch
   npm run start:dev
   
   # Production build
   npm run build
   
   # Start production
   npm start
   ```

### Docker Development

1. **Build Docker image:**
   ```bash
   docker build -t exchange-rates-bot .
   ```

2. **Run container:**
   ```bash
   docker run -d --name exchange-rates-bot \
     -e BOT_TOKEN=your_bot_token_here \
     -v $(pwd)/db:/app/db \
     exchange-rates-bot
   ```

---

## Code Organization

### Project Structure

```
├── src/
│   ├── api.ts              # External API integrations
│   ├── bot.ts              # Telegram bot handlers
│   ├── calculateRates.ts   # Rate calculation logic
│   ├── db.ts              # Database configuration
│   ├── getRates.ts        # Rate display formatting
│   ├── helpers.ts         # Utility functions
│   ├── main.ts            # Application entry point
│   └── updateRates.ts     # Rate update orchestration
├── dist/                  # Compiled JavaScript (build output)
├── db/                    # Database files
├── Dockerfile            # Docker configuration
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── webpack.config.ts     # Webpack build configuration
```

### Module Responsibilities

| Module | Responsibility | Dependencies |
|--------|---------------|--------------|
| `main.ts` | Application bootstrap, error handling, process management | `bot.ts`, `updateRates.ts`, `cron` |
| `bot.ts` | Telegram bot setup, command handlers, user interactions | `grammy`, `calculateRates.ts`, `getRates.ts`, `db.ts` |
| `api.ts` | External API integrations, HTTP requests | `ky` |
| `updateRates.ts` | Rate update orchestration, data normalization | `api.ts`, `db.ts` |
| `calculateRates.ts` | Currency conversion calculations | `db.ts`, `helpers.ts` |
| `getRates.ts` | Rate display formatting | `db.ts`, `helpers.ts` |
| `helpers.ts` | Utility functions, shared logic | None |
| `db.ts` | Database configuration | `node-json-db` |

---

## API Integration Details

### KoronaPay API

**Endpoint:** `https://koronapay.com/transfers/online/api/transfers/tariffs`

**Request Parameters:**
```typescript
{
  sendingCountryId: "RUS",
  sendingCurrencyId: "810", // RUB
  receivingCountryId: "GEO",
  receivingCurrencyId: "981" | "840", // GEL | USD
  paymentMethod: "debitCard",
  receivingAmount: "100",
  receivingMethod: "cash",
  paidNotificationEnabled: "false"
}
```

**Response Structure:**
```typescript
Array<{
  exchangeRate: number;
  // ... other fields
}>
```

### CBR API

**Endpoint:** `https://www.cbr-xml-daily.ru/daily_json.js`

**Response Structure:**
```typescript
{
  Valute: {
    USD: { Value: number };
    GEL: { Value: number };
    // ... other currencies
  }
}
```

### ByBit API

**Endpoint:** `https://api2.bybit.com/fiat/otc/item/online`

**Request Body:**
```typescript
{
  tokenId: "USDT",
  currencyId: "RUB" | "GEL" | "USD",
  payment: ["14" | "11"], // Payment method IDs
  side: "0" | "1", // buy | sell
  size: "1",
  page: "1",
  amount: "",
  authMaker: false,
  canTrade: false
}
```

**Response Structure:**
```typescript
{
  result: {
    items: Array<{
      price: string;
      // ... other fields
    }>;
  }
}
```

---

## Data Flow

### Rate Update Process

```mermaid
graph TD
    A[Cron Job Triggers] --> B[updateRates()]
    B --> C[Fetch KoronaPay GEL]
    B --> D[Fetch KoronaPay USD]
    B --> E[Fetch CBR Rates]
    B --> F[Fetch ByBit RUB->USDT]
    B --> G[Fetch ByBit USDT->GEL]
    B --> H[Fetch ByBit USDT->USD]
    
    C --> I[Normalize Data]
    D --> I
    E --> I
    F --> I
    G --> I
    H --> I
    
    I --> J[Store in Database]
    J --> K[Update Complete]
```

### User Interaction Flow

```mermaid
graph TD
    A[User Sends Message] --> B{Message Type}
    B -->|/start| C[Send Welcome Message]
    B -->|/rates| D[Call getRates()]
    B -->|Number| E[Call calculateRatesFromRub()]
    B -->|Button Click| F[Update Calculation]
    
    D --> G[Format Rate Display]
    E --> H[Calculate Conversions]
    F --> I[Update Inline Keyboard]
    
    G --> J[Send Response]
    H --> J
    I --> J
```

---

## Testing Guidelines

### Unit Testing Setup

```typescript
// Example test structure
import { describe, it, expect, beforeEach } from 'vitest';
import { calculateRatesFromRub } from '../src/calculateRates';

describe('calculateRatesFromRub', () => {
  beforeEach(() => {
    // Setup test database
  });

  it('should calculate GEL conversion correctly', async () => {
    const result = await calculateRatesFromRub('GEL', 1000);
    expect(result).toContain('1000RUB=');
  });
});
```

### Integration Testing

```typescript
// API integration tests
describe('API Integration', () => {
  it('should fetch KoronaPay rates', async () => {
    const rate = await getKoronaPayRates('GEL');
    expect(typeof rate).toBe('number');
    expect(rate).toBeGreaterThan(0);
  });
});
```

### Manual Testing Checklist

- [ ] Bot responds to `/start` command
- [ ] Bot responds to `/rates` command
- [ ] Numeric input triggers calculations
- [ ] Inline buttons work correctly
- [ ] Error handling works for API failures
- [ ] Database updates properly
- [ ] Cron job runs on schedule

---

## Deployment

### Production Build

```bash
# Build for production
npm run build

# Verify build
ls -la dist/

# Test production build
node dist/main.js
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY db/ ./db/

CMD ["node", "dist/main.js"]
```

### Environment Variables

```env
# Required
BOT_TOKEN=your_telegram_bot_token

# Optional
NODE_ENV=production
LOG_LEVEL=info
DB_PATH=./db/db.json
```

### Health Check

```bash
# Check if bot is running
curl -s https://api.telegram.org/bot${BOT_TOKEN}/getMe

# Check database
ls -la db/db.json
```

---

## Monitoring and Logging

### Application Logs

```typescript
// Add to main.ts
import { createLogger } from 'winston';

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Metrics to Monitor

1. **Bot Metrics:**
   - Message processing time
   - Error rates
   - Active users
   - Command usage frequency

2. **API Metrics:**
   - API response times
   - API failure rates
   - Rate update frequency
   - Database query performance

3. **System Metrics:**
   - Memory usage
   - CPU utilization
   - Disk space
   - Network connectivity

### Health Check Endpoint

```typescript
// Add to main.ts
import express from 'express';

const app = express();
app.get('/health', async (req, res) => {
  try {
    const rates = await db.getData('/rates');
    const lastUpdate = new Date(rates.updatedDate);
    const now = new Date();
    const timeDiff = now.getTime() - lastUpdate.getTime();
    const isHealthy = timeDiff < 45 * 60 * 1000; // 45 minutes
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      lastUpdate: lastUpdate.toISOString(),
      timeSinceUpdate: Math.floor(timeDiff / 1000 / 60) + ' minutes'
    });
  } catch (error) {
    res.status(503).json({ status: 'error', message: error.message });
  }
});

app.listen(3000);
```

---

## Troubleshooting

### Common Issues

#### 1. Bot Not Responding

**Symptoms:** Bot doesn't respond to commands
**Causes:**
- Invalid bot token
- Network connectivity issues
- Telegram API downtime

**Solutions:**
```bash
# Check bot token
curl -s https://api.telegram.org/bot${BOT_TOKEN}/getMe

# Check network connectivity
ping api.telegram.org

# Check logs
tail -f combined.log
```

#### 2. Rate Updates Failing

**Symptoms:** Rates not updating, old timestamps
**Causes:**
- External API failures
- Network timeouts
- Database write errors

**Solutions:**
```bash
# Check API endpoints
curl -s "https://www.cbr-xml-daily.ru/daily_json.js"

# Check database permissions
ls -la db/

# Manual rate update
node -e "require('./dist/updateRates').updateRates()"
```

#### 3. Memory Issues

**Symptoms:** High memory usage, crashes
**Causes:**
- Memory leaks
- Large database files
- Unclosed connections

**Solutions:**
```bash
# Monitor memory usage
top -p $(pgrep node)

# Check database size
du -sh db/

# Restart application
pm2 restart exchange-rates-bot
```

### Debug Mode

```bash
# Enable debug logging
NODE_ENV=development npm run start:dev

# Check specific module
DEBUG=api npm start
```

---

## Contributing Guidelines

### Code Style

```typescript
// Use TypeScript strict mode
// Follow existing naming conventions
// Add JSDoc comments for public functions

/**
 * Calculates exchange rates from RUB to target currency
 * @param currency - Target currency code
 * @param sum - Amount in RUB
 * @returns Formatted calculation string
 */
export const calculateRatesFromRub = async (
  currency: "GEL" | "USD",
  sum: number
): Promise<string> => {
  // Implementation
};
```

### Pull Request Process

1. **Fork the repository**
2. **Create feature branch:**
   ```bash
   git checkout -b feature/new-currency-support
   ```
3. **Make changes with tests**
4. **Update documentation**
5. **Submit pull request**

### Code Review Checklist

- [ ] Code follows TypeScript best practices
- [ ] All functions have proper type definitions
- [ ] Error handling is implemented
- [ ] Tests are included for new features
- [ ] Documentation is updated
- [ ] Performance implications considered

### Adding New Currency Support

1. **Update API functions:**
   ```typescript
   // Add currency to enums
   enum currenciesEnum {
     "GEL" = "981",
     "USD" = "840",
     "EUR" = "978", // New currency
   }
   ```

2. **Update rate calculation:**
   ```typescript
   // Extend type definitions
   type SupportedCurrency = "GEL" | "USD" | "EUR";
   ```

3. **Update database schema:**
   ```typescript
   interface Rates {
     // ... existing rates
     CBRRateEUR: number;
     koronaRateEUR: number;
   }
   ```

4. **Update bot handlers:**
   ```typescript
   // Add new callback queries
   bot.callbackQuery("TO_EUR", async (ctx) => {
     // Implementation
   });
   ```

---

## Performance Optimization

### Database Optimization

```typescript
// Implement connection pooling
const dbPool = new Map<string, JsonDB>();

// Use database transactions
await db.push('/rates', rates, false);
```

### API Optimization

```typescript
// Implement request caching
const cache = new Map<string, { data: any; timestamp: number }>();

// Add request deduplication
const pendingRequests = new Map<string, Promise<any>>();
```

### Memory Management

```typescript
// Clean up intervals
process.on('SIGTERM', () => {
  clearInterval(updateInterval);
  bot.stop();
});
```

---

## Security Considerations

### Environment Variables

```bash
# Use secure storage for production
BOT_TOKEN=your_bot_token_here
API_KEYS=encrypted_api_keys
```

### Input Validation

```typescript
// Validate user input
const isValidAmount = (input: string): boolean => {
  const num = parseFloat(input);
  return !isNaN(num) && num > 0 && num <= 1000000;
};
```

### Rate Limiting

```typescript
// Implement user rate limiting
const userLimits = new Map<number, number>();

bot.use((ctx, next) => {
  const userId = ctx.from?.id;
  if (userId && userLimits.get(userId) > 10) {
    return ctx.reply('Too many requests. Please wait.');
  }
  return next();
});
```

---

This developer guide provides comprehensive technical information for maintaining and extending the exchange rates bot. For API usage examples and user-facing documentation, refer to the main [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) file.