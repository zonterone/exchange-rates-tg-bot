import { CronJob } from "cron";
import { GrammyError, HttpError } from "grammy/web";
import { bot, setupBotCommands } from "./bot";
import { updateRates } from "./updateRates";

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

const updateRatesCron = new CronJob("*/30 * * * *", async () => {
  await updateRates();
});

const stop = () => {
  void bot.stop();
  updateRatesCron.stop();
};

const main = async () => {
  await updateRates();
  await setupBotCommands();

  updateRatesCron.start();
  console.info("Update rates cron started");

  bot
    .start({
      onStart: () => {
        console.info("Bot started");
      },
    })
    .catch((error) => {
      console.error("Bot startup failed:", error);
      updateRatesCron.stop();
      process.exitCode = 1;
    });
};

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

main().catch((error) => {
  console.error("Startup failed:", error);
  updateRatesCron.stop();
  process.exitCode = 1;
});
