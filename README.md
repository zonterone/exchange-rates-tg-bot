# Simple telegram exchange rates Bot

Bot updates rates every 30 minutes and saves them to a db.json file. It watches
the Georgia direction in two legs and the chain between them:

- **₽ → $** money transfer rates: Unired, MultiTransfer, Avosend (CBR for reference)
- **$ → ₾** exchange rates: kursi.ge, Bank of Georgia, TBC (NBG for reference)
- **₽ → ₾** every transfer/exchange combination, so the cheapest route is
  visible, with the CBR direct rate beside it

`/rates` answers with a rendered card (PNG). Reference rates are pinned on top
of their section, providers below them are sorted by profit — so the best rate
you can act on leads every table and the best chain is the top left cell of the
matrix. A quote carried over from an earlier update sorts below the fresh ones
and never wins. Send the bot a sum instead to get the same breakdown in
amounts, as text, with
inline buttons that recalculate the same sum in the other directions
(`?₽ → ₾`, `?₽ → $`, `$ ⇄ ₾`). The bot also answers inline queries, so
`@your_bot` posts the current rates into any chat.

The card is drawn as SVG and rasterised by [@resvg/resvg-js](https://github.com/yisibl/resvg-js)
with Noto Sans Mono from `assets/` — a native addon, so it is excluded from the
webpack bundle and copied into the image separately. The card contains no
timestamp: it is rendered once per rate update and re-sent by Telegram `file_id`
until the next one, while freshness lives in the message caption.

## Prerequisites

1. Get a Telegram bot Token at [BotFather](https://telegram.me/BotFather)

## Installation

1. Clone the repo

```sh
    git clone https://github.com/zonterone/exchange-rates-tg-bot.git
```

2. Go to project directory 

```sh
    cd exchange-rates-tg-bot
```

3. Build Docker image 
```sh
    docker build . -t zonter/exchange-rates-tg-bot
```

4. Run Docker container

```sh
docker run -d --name=exchange-rates-tg-bot \
--env-file .env \
--restart unless-stopped \
--volume ~/.zt_exchange_bot/db:/app/db \
zonter/exchange-rates-tg-bot:latest
```

The container runs as the unprivileged `node` user (uid 1000), so the mounted
database directory has to be writable by it — on an existing installation
where the volume was created by root, chown it once:

```sh
sudo chown -R 1000:1000 ~/.zt_exchange_bot/db
```

5. Start conversation with your bot. Bot triggers to /start command.

## ENV variables

Secrets live in `.env` only — it is gitignored and never baked into the image.
Copy [`.env.example`](.env.example) to `.env` and fill it in; in production pass
the same file with `docker run --env-file .env`. Every variable is read in one
place, `src/env.ts`.

| Variable             | Required               | Description                            |
| :------------------- | :--------------------- | :------------------------------------- |
| `BOT_TOKEN`          | **Required**           | Your Telegram API bot token            |
| `MT_FHP_SESSION_ID`  | MultiTransfer only     | Antifraud session id, see below        |
| `DB_PATH`            | Optional               | Database location, default `db/db.json`|
| `ASSETS_PATH`        | Optional               | Font directory, default `assets/`      |

### MultiTransfer session

MultiTransfer answers only to a `fhpsessionid` issued to a real browser session:
an unknown id gets `423 Locked`, a missing one `400`. Without the variable the
bot skips the request and reports `MltTr — session expired?` instead of a rate;
the other four providers are unaffected. To get an id, open
[multitransfer.ru](https://multitransfer.ru/), copy the `fhpsessionid` request
header from any `/commissions` call in devtools and put it in `.env` as
`MT_FHP_SESSION_ID`. It expires every few months — `npm run probe` is the way to
notice. See [docs/adr/0001-multitransfer-antifraud-session.md](docs/adr/0001-multitransfer-antifraud-session.md).

## Development

Requires Node.js 24 (same as the Docker image). A `.env` file in the project
root is picked up automatically:

```sh
npm install
cp .env.example .env
npm run start:dev
```

| Command                 | What it does                                        |
| :---------------------- | :-------------------------------------------------- |
| `npm run start:dev`     | webpack watch, restarts the bot on every change     |
| `npm start`             | production build, then run it                       |
| `npm test`              | unit tests on recorded provider responses (offline) |
| `npm run test:coverage` | same tests with a coverage report                   |
| `npm run probe`         | hits all five live endpoints and prints what parsed |
| `npm run build`         | production bundle to `dist/main.cjs`                |

## Docs

- [`CONTEXT.md`](CONTEXT.md) — domain glossary: legs, chains, quotes, sanity ranges
- [`docs/conventions.md`](docs/conventions.md) — structure, style, how to add a provider
- [`docs/adr/`](docs/adr) — architectural decision records
