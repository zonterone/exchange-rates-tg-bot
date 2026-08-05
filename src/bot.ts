import {
  Bot,
  InlineKeyboard,
  InlineQueryResultBuilder,
  InputFile,
  Keyboard,
  type Context,
} from "grammy";
import { randomUUID } from "node:crypto";

import { db } from "./db";
import { env } from "./env";
import { formatSum } from "./format";
import { ratesPng } from "./image";
import {
  amountMessage,
  cold,
  ratesCaption,
  ratesMessage,
  type Mode,
} from "./messages";
import { getStoredRates } from "./updateRates";

if (!env.token) {
  throw new Error("BOT_TOKEN is required, put it in .env");
}

export const bot = new Bot(env.token);

const getRatesButtonText = "Get rates 💸";
const keyboard = new Keyboard()
  .text(getRatesButtonText)
  .resized()
  .persistent()
  .placeholder("Send me sum");

const minSum = 1;
const maxSum = 1_000_000;

const hint = "Send me a number, e.g. 10000";

const modes: { mode: Mode; text: (sum: string) => string }[] = [
  { mode: "sendRub", text: (sum) => `${sum}₽ → $ ₾` },
  { mode: "needRubForGel", text: (sum) => `?₽ → ${sum}₾` },
  { mode: "needRubForUsd", text: (sum) => `?₽ → ${sum}$` },
  { mode: "usdGel", text: (sum) => `${sum}$ ⇄ ₾` },
];

export const parseSum = (text: string) => {
  const trimmed = text.replace(/\s/g, "");
  // "1,5" is one and a half, "10,000" is ten thousand: a separator is decimal
  // only when it is the last one and one or two digits follow it
  const normalized = /[.,]\d{1,2}$/.test(trimmed)
    ? trimmed.replace(/[.,](?=.*[.,])/g, "").replace(",", ".")
    : trimmed.replace(/[.,]/g, "");

  // Number() would also accept "1e5", "0x10" and "-5"
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  return Number(normalized);
};

const modeKeyboard = (sum: number, active: Mode) => {
  const inlineKeyboard = new InlineKeyboard();

  modes
    .filter((item) => item.mode !== active)
    .forEach((item) => {
      inlineKeyboard.text(item.text(formatSum(sum)), item.mode).row();
    });

  return inlineKeyboard;
};

const ratesText = async () => {
  const snapshot = await getStoredRates();
  if (!snapshot) return cold;

  return ratesMessage(snapshot);
};

// telegram keeps the uploaded card, so one upload serves the whole half hour
let card: { updatedDate: number; fileId: string } | null = null;

const sendRatesCard = async (ctx: Context) => {
  const snapshot = await getStoredRates();
  if (!snapshot) {
    await ctx.reply(cold);
    return;
  }

  try {
    const uploaded =
      card?.updatedDate === snapshot.updatedDate
        ? card.fileId
        : new InputFile(ratesPng(snapshot), "rates.png");
    const sent = await ctx.replyWithPhoto(uploaded, {
      caption: ratesCaption(snapshot),
    });

    const fileId = sent.photo[sent.photo.length - 1]?.file_id;
    if (fileId) card = { updatedDate: snapshot.updatedDate, fileId };
  } catch (error) {
    console.error("rates card failed", error);
    // a file_id telegram refused must not be retried until the next update
    card = null;
    await ctx.reply(ratesMessage(snapshot), { parse_mode: "HTML" });
  }
};

const amountText = async (mode: Mode, sum: number) => {
  const snapshot = await getStoredRates();
  if (!snapshot) return cold;

  return amountMessage(mode, sum, snapshot);
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
    `Hello! This bot watches ₽ → $ transfer rates (Unired, MultiTransfer, Avosend) and $ → ₾ exchange rates (Kursi, BoG, TBC) in the Georgia direction, with CBR and NBG for reference. Click the "${getRatesButtonText}" or send me a sum.`,
    { reply_markup: keyboard }
  );
});

bot.on(["msg:text", "::bot_command"], async (ctx) => {
  if (
    getRatesButtonText === ctx.message?.text ||
    ctx.hasCommand(commandsList.rates.command)
  ) {
    await sendRatesCard(ctx);
    return;
  }

  const sum = parseSum(ctx.message?.text ?? "");
  if (sum === null) {
    await ctx.reply(hint);
    return;
  }
  if (sum < minSum) {
    await ctx.reply(`Min amount is ${formatSum(minSum)}`);
    return;
  }
  if (sum > maxSum) {
    await ctx.reply(`Max amount is ${formatSum(maxSum)}`);
    return;
  }

  // every push rewrites the whole database file, so skip the unchanged ones
  if ((await getLastSum(ctx)) !== sum) {
    await db.push(getUserPath(ctx), { lastSumToCalculate: sum }, false);
  }
  await ctx.reply(await amountText("sendRub", sum), {
    parse_mode: "HTML",
    reply_markup: modeKeyboard(sum, "sendRub"),
  });
});

modes.forEach(({ mode }) => {
  bot.callbackQuery(mode, async (ctx) => {
    const sum = await getLastSum(ctx);
    if (sum === null) {
      await ctx.answerCallbackQuery({ text: "Send sum first" });
      return;
    }

    await ctx.editMessageText(await amountText(mode, sum), {
      parse_mode: "HTML",
      reply_markup: modeKeyboard(sum, mode),
    });
    await ctx.answerCallbackQuery();
  });
});

bot.on("inline_query", async (ctx) => {
  const result = InlineQueryResultBuilder.article(
    randomUUID(),
    "Send rates to chat"
  ).text(await ratesText(), { parse_mode: "HTML" });

  await ctx.answerInlineQuery([result]);
});
