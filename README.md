
# Simple telegram exchange rates Bot
Bot update rates every 30 minutes by polling binance, koronaPay and CBR rates, and saves it to db.json file.

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
-e BOT_TOKEN=<your telegram api token> \
--restart unless-stopped \
zonter/exchange-rates-tg-bot:latest
```

1. Start conversation with your bot. Bot triggers to /start command.

## ENV variables

| Variable                  | Required     | Description                                                         |
| :------------------------ | :----------- | :------------------------------------------------------------------ |
| `BOT_TOKEN`               | **Required** | Your Telegram API bot token                                         |