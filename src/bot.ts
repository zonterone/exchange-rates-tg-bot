import {
  Bot,
  InlineKeyboard,
  InlineQueryResultBuilder,
  Keyboard,
} from "grammy/web";
import { v4 as uuidv4 } from "uuid";

import "dotenv/config";
import { calculateRatesFromRub, calculateRatesToRub } from "./calculateRates";
import { db } from "./db";
import { getRates } from "./getRates";
import { currencySymbols } from "./helpers";

const token = process.env["BOT_TOKEN"];

if (!token) {
  throw new Error("BOT_TOKEN is required");
}

export const bot = new Bot(token);

const getRatesButtonText = "Get rates 💸";
const keyboard = new Keyboard()
  .text(getRatesButtonText)
  .resized()
  .persistent()
  .placeholder("Send me sum");

enum currency {
  TO_GEL = "TO_GEL",
  TO_USD = "TO_USD",
  FROM_GEL = "FROM_GEL",
  FROM_USD = "FROM_USD",
}

const getInlineKeyboard = (
  sum: number,
  activeBtnCommand: keyof typeof currency
) => {
  const keyboardBtns = [
    {
      text: `${sum}${currencySymbols.RUB} to ?${currencySymbols.GEL}`,
      command: currency.TO_GEL,
    },
    {
      text: `${sum}${currencySymbols.RUB} to ?${currencySymbols.USD}`,
      command: currency.TO_USD,
    },
    {
      text: `?${currencySymbols.RUB} to ${sum}${currencySymbols.USD}`,
      command: currency.FROM_USD,
    },
    {
      text: `?${currencySymbols.RUB} to ${sum}${currencySymbols.GEL}`,
      command: currency.FROM_GEL,
    },
  ];
  const inlineKeyboard = new InlineKeyboard();
  keyboardBtns.forEach((keyboardBtn) => {
    if (keyboardBtn.command !== activeBtnCommand) {
      inlineKeyboard.text(keyboardBtn.text, keyboardBtn.command).row();
    }
  });
  return inlineKeyboard;
};

const commandsList = {
  start: { command: "start", description: "Start bot" },
  rates: { command: "rates", description: "Get rates" },
};

export const setupBotCommands = () =>
  bot.api.setMyCommands(Object.values(commandsList));

type UserContext = {
  chat?: { id: number } | undefined;
  from?: { id: number } | undefined;
};

const getUserPath = (ctx: UserContext) => {
  const chat = ctx.chat?.id ?? ctx.from?.id;
  const user = ctx.from?.id ?? ctx.chat?.id;

  if (!chat || !user) throw new Error("chat or user id is missing");

  return `/users/${chat}/${user}`;
};

const getLastSum = async (ctx: UserContext) => {
  const path = `${getUserPath(ctx)}/lastSumToCalculate`;
  if (!(await db.exists(path))) return null;

  const sum = Number(await db.getData(path));
  return Number.isFinite(sum) ? sum : null;
};

bot.command(["start"], async (ctx) => {
  await db.push(getUserPath(ctx), {}, false);
  await ctx.reply(
    `Hello! This bot watches current CBR and KoronaPay exchange rates in Georgia direction. To get the rates click the "${getRatesButtonText}".`,
    { reply_markup: keyboard }
  );
});

bot.on(["msg:text", "::bot_command"], async (ctx) => {
  if (
    getRatesButtonText === ctx.message?.text ||
    ctx.hasCommand(commandsList.rates.command)
  ) {
    const ratesMessage = await getRates();
    await ctx.reply(ratesMessage);
    return;
  }

  if (!isNaN(Number(ctx.message?.text))) {
    const sum = Number(ctx.message?.text);
    await db.push(getUserPath(ctx), { lastSumToCalculate: sum }, false);
    const calculateMessage = await calculateRatesFromRub("GEL", sum);
    await ctx.reply(calculateMessage, {
      reply_markup: getInlineKeyboard(sum, currency.TO_GEL),
    });
  }
});

bot.callbackQuery(currency.TO_GEL, async (ctx) => {
  const sum = await getLastSum(ctx);
  if (sum === null) {
    await ctx.answerCallbackQuery({ text: "Send sum first" });
    return;
  }

  const calculateMessage = await calculateRatesFromRub("GEL", sum);
  await ctx.editMessageText(calculateMessage, {
    reply_markup: getInlineKeyboard(sum, currency.TO_GEL),
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(currency.TO_USD, async (ctx) => {
  const sum = await getLastSum(ctx);
  if (sum === null) {
    await ctx.answerCallbackQuery({ text: "Send sum first" });
    return;
  }

  const calculateMessage = await calculateRatesFromRub("USD", sum);
  await ctx.editMessageText(calculateMessage, {
    reply_markup: getInlineKeyboard(sum, currency.TO_USD),
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(currency.FROM_GEL, async (ctx) => {
  const sum = await getLastSum(ctx);
  if (sum === null) {
    await ctx.answerCallbackQuery({ text: "Send sum first" });
    return;
  }

  const calculateMessage = await calculateRatesToRub("GEL", sum);
  await ctx.editMessageText(calculateMessage, {
    reply_markup: getInlineKeyboard(sum, currency.FROM_GEL),
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(currency.FROM_USD, async (ctx) => {
  const sum = await getLastSum(ctx);
  if (sum === null) {
    await ctx.answerCallbackQuery({ text: "Send sum first" });
    return;
  }

  const calculateMessage = await calculateRatesToRub("USD", sum);
  await ctx.editMessageText(calculateMessage, {
    reply_markup: getInlineKeyboard(sum, currency.FROM_USD),
  });
  await ctx.answerCallbackQuery();
});

bot.on("inline_query", async (ctx) => {
  const ratesMessage = await getRates();
  const result = InlineQueryResultBuilder.article(
    uuidv4(),
    "Send rates to chat"
  ).text(ratesMessage);

  await ctx.answerInlineQuery([result]);
});
