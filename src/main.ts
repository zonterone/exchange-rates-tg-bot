import { CronJob } from "cron";
import { GrammyError, HttpError } from "grammy";
import { ResultAsync } from "neverthrow";
import { match, P } from "ts-pattern";
import { bot, setupBotCommands } from "./bot";
import { updateRates } from "./updateRates";

// grammy's own edge: whatever lands here escaped a handler, so it is an
// unknown rather than a word from our vocabulary
bot.catch(({ ctx, error }) => {
  console.error(`Error while handling update ${ctx.update.update_id}:`);

  match(error)
    .with(P.instanceOf(GrammyError), (e) =>
      console.error("Error in request:", e.description)
    )
    .with(P.instanceOf(HttpError), (e) =>
      console.error("Could not contact Telegram:", e)
    )
    .otherwise((e) => console.error("Unknown error:", e));
});

// the cycle logs its own failure where the cause still exists, and the next
// half hour tries again — so the tick only has to run it
const updateRatesCron = new CronJob("*/30 * * * *", async () => {
  await updateRates();
});

const stop = () => {
  void bot.stop();
  updateRatesCron.stop();
};

const main = async () => {
  const commands = await setupBotCommands();
  if (commands.isErr()) {
    // the cause is logged where it was caught; this only says what it costs
    console.error("Bot setup failed, not starting");
    process.exitCode = 1;
    return;
  }

  updateRatesCron.start();
  console.info("Update rates cron started");

  void ResultAsync.fromPromise(
    bot.start({
      onStart: () => {
        console.info("Bot started");
      },
    }),
    (cause) => {
      console.error("Bot startup failed:", cause);
      return "start" as const;
    }
  ).orTee(() => {
    updateRatesCron.stop();
    process.exitCode = 1;
  });

  // a slow source must not keep the bot silent on every restart: handlers
  // answer with the stored snapshot, or `cold` until the first one lands
  await updateRates();
};

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

// the outermost edge: everything inside main is a value, and this is only
// here so an unforeseen rejection still stops the cron and marks the exit
main().catch((error) => {
  console.error("Startup failed:", error);
  updateRatesCron.stop();
  process.exitCode = 1;
});
