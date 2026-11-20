import {
  Bot,
  HttpError,
  InlineKeyboard,
  InlineQueryResultBuilder,
  InputFile,
  Keyboard,
  type Context,
} from "grammy";
import { HttpsProxyAgent } from "https-proxy-agent";
import { randomUUID } from "node:crypto";
import { ResultAsync, err, ok, safeTry } from "neverthrow";
import type { Result } from "neverthrow";
import { match } from "ts-pattern";

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
import type { Snapshot } from "./rates";
import { read, write } from "./result";
import { getStoredRates } from "./updateRates";

// the sanctioned throws: this runs at import, the process cannot start
// without a token, and there is no caller to hand a Result to
if (!env.token) {
  throw new Error("BOT_TOKEN is required, put it in .env");
}

// a proxy that cannot be read must not quietly become a direct connection:
// where Telegram is blocked that is a bot that starts and never answers
const proxy = env.proxy ? URL.parse(env.proxy) : undefined;
if (proxy === null) {
  throw new Error("TELEGRAM_PROXY_URL is not a URL, e.g. http://host:3128");
}

// the agent belongs to this client alone, so the providers and the browser
// keep connecting directly; like grammy's own agent it keeps sockets alive
export const bot = new Bot(env.token, {
  client: proxy
    ? {
        baseFetchConfig: {
          agent: new HttpsProxyAgent(proxy, { keepAlive: true }),
        },
      }
    : {},
});

const route = proxy ? `through the proxy ${proxy.host}` : "directly";

// node-fetch quotes the whole url in its message, and the token is in the url
const reason = (cause: unknown) => {
  const error = cause instanceof HttpError ? cause.error : cause;
  const text = error instanceof Error ? error.message : String(error);

  return text.replaceAll(bot.token, "<token>");
};

// grammy waits out a failed poll in silence — its own log sits behind DEBUG —
// so an outage is said here, once when it starts and once when it ends
let reachable = true;

bot.api.config.use((prev, method, payload, signal) => {
  const call = prev(method, payload, signal);

  // grammy gets its call back untouched; this only watches how it ends
  void ResultAsync.fromPromise(call, (cause) => {
    // a poll cancelled by `bot.stop()` rejects too, and is no outage
    if (reachable && !signal?.aborted) {
      console.error(`Telegram is unreachable ${route}:`, reason(cause));
      reachable = false;
    }
    return "unreachable" as const;
  }).andTee(() => {
    if (!reachable) console.info("Telegram is reachable again");
    reachable = true;
  });

  return call;
});

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

export const parseSum = (
  text: string
): Result<number, "invalid" | "min" | "max"> => {
  const trimmed = text.replace(/\s/g, "");
  // "1,5" is one and a half, "10,000" is ten thousand: a separator is decimal
  // only when it is the last one and one or two digits follow it
  const normalized = /[.,]\d{1,2}$/.test(trimmed)
    ? trimmed.replace(/[.,](?=.*[.,])/g, "").replace(",", ".")
    : trimmed.replace(/[.,]/g, "");

  // Number() would also accept "1e5", "0x10" and "-5"
  if (!/^\d+(\.\d+)?$/.test(normalized)) return err("invalid");

  // the range belongs to reading a sum: a number nothing can be calculated
  // from is as unusable as a word
  const sum = Number(normalized);
  if (sum < minSum) return err("min");
  if (sum > maxSum) return err("max");

  return ok(sum);
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

// a cold start and an unreadable database read the same to the user, but only
// one of the two is worth someone's attention
const coldText = (reason: "cold" | "unreadable") =>
  match(reason)
    .with("cold", () => cold)
    .with("unreadable", () => {
      console.error("stored rates could not be read");
      return cold;
    })
    .exhaustive();

const ratesText = () =>
  getStoredRates().match((snapshot) => ratesMessage(snapshot), coldText);

// telegram keeps the uploaded card, so one upload serves the whole half hour
let card: { updatedDate: number; fileId: string } | null = null;

const photoOf = (snapshot: Snapshot): Result<string | InputFile, "render"> =>
  card?.updatedDate === snapshot.updatedDate
    ? ok(card.fileId)
    : ratesPng(snapshot).map((png) => new InputFile(png, "rates.png"));

const sendRatesCard = async (ctx: Context) => {
  const stored = await getStoredRates();
  if (stored.isErr()) {
    await ctx.reply(coldText(stored.error));
    return;
  }

  const snapshot = stored.value;
  // a failed render already logged its cause, so only the send needs a word
  const sent = await photoOf(snapshot).asyncAndThen((photo) =>
    ResultAsync.fromPromise(
      ctx.replyWithPhoto(photo, { caption: ratesCaption(snapshot) }),
      (cause) => {
        console.error("rates card failed", cause);
        return "telegram" as const;
      }
    )
  );

  if (sent.isErr()) {
    // a file_id telegram refused must not be retried until the next update
    card = null;
    await ctx.reply(ratesMessage(snapshot), { parse_mode: "HTML" });
    return;
  }

  const fileId = sent.value.photo[sent.value.photo.length - 1]?.file_id;
  if (fileId) card = { updatedDate: snapshot.updatedDate, fileId };
};

const amountText = (mode: Mode, sum: number) =>
  getStoredRates().match(
    (snapshot) => amountMessage(mode, sum, snapshot),
    coldText
  );

const commandsList = {
  start: { command: "start", description: "Start bot" },
  rates: { command: "rates", description: "Get rates" },
};

export const setupBotCommands = () =>
  ResultAsync.fromPromise(
    bot.api.setMyCommands(Object.values(commandsList)),
    (error) => {
      // an outage is announced where every call is watched, and unlike a
      // refusal it is worth waiting out
      if (error instanceof HttpError) return "unreachable" as const;

      console.error("setting bot commands failed", error);
      return "telegram" as const;
    }
  );

type UserContext = {
  chat?: { id: number } | undefined;
  from?: { id: number } | undefined;
};

// an update carrying neither a chat nor a user id has nowhere to keep a sum
const getUserPath = (ctx: UserContext): Result<string, "unidentified"> => {
  const chat = ctx.chat?.id ?? ctx.from?.id;
  const user = ctx.from?.id ?? ctx.chat?.id;

  if (!chat || !user) return err("unidentified");

  return ok(`/users/${chat}/${user}`);
};

// no sum stored for this user is an absence, not a failure — only a database
// that cannot be read is one
const getLastSum = (ctx: UserContext) =>
  safeTry(async function* () {
    const path = `${yield* getUserPath(ctx)}/lastSumToCalculate`;
    const exists = yield* read("user", db.exists(path));
    if (!exists) return ok(null);

    const sum = Number(yield* read("user", db.getObject<unknown>(path)));
    return ok(Number.isFinite(sum) ? sum : null);
  });

bot.command(["start"], async (ctx) => {
  // remembering the chat is best effort — the greeting does not depend on it
  const stored = await getUserPath(ctx).asyncAndThen((path) =>
    write("user", db.push(path, {}, false))
  );
  if (stored.isErr()) console.error("user not registered", stored.error);

  await ctx.reply(
    `Hello! This bot watches ₽ → $ transfer rates (MultiTransfer, KoronaPay) and $ → ₾ exchange rates (Kursi, BoG, TBC) in the Georgia direction, with CBR and NBG for reference. Click the "${getRatesButtonText}" or send me a sum.`,
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

  const parsed = parseSum(ctx.message?.text ?? "");
  if (parsed.isErr()) {
    await ctx.reply(
      match(parsed.error)
        .with("invalid", () => hint)
        .with("min", () => `Min amount is ${formatSum(minSum)}`)
        .with("max", () => `Max amount is ${formatSum(maxSum)}`)
        .exhaustive()
    );
    return;
  }

  const sum = parsed.value;
  // every push rewrites the whole database file, so skip the unchanged ones
  if ((await getLastSum(ctx)).unwrapOr(null) !== sum) {
    // remembering the sum is best effort, exactly as in /start
    const stored = await getUserPath(ctx).asyncAndThen((path) =>
      write("user", db.push(path, { lastSumToCalculate: sum }, false))
    );
    if (stored.isErr()) console.error("sum not remembered", stored.error);
  }

  await ctx.reply(await amountText("sendRub", sum), {
    parse_mode: "HTML",
    reply_markup: modeKeyboard(sum, "sendRub"),
  });
});

modes.forEach(({ mode }) => {
  bot.callbackQuery(mode, async (ctx) => {
    // an unreadable database is no sum either: the user is asked for one
    const sum = (await getLastSum(ctx)).unwrapOr(null);
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
