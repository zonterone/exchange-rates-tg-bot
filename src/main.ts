import { CronJob } from 'cron'
import { GrammyError, HttpError } from 'grammy'
import { bot } from './bot'
import { updateRates } from './updateRates'

bot.start()
bot.catch((err) => {
  const ctx = err.ctx
  console.error(`Error while handling update ${ctx.update.update_id}:`)
  const e = err.error
  if (e instanceof GrammyError) {
    console.error('Error in request:', e.description)
  } else if (e instanceof HttpError) {
    console.error('Could not contact Telegram:', e)
  } else {
    console.error('Unknown error:', e)
  }
})
console.info('Bot started')

const updateRatesCron = new CronJob('*/30 * * * *', async () => {
  await updateRates()
})

// initial update
updateRates()
updateRatesCron.start()
console.info('Update rates cron started')

process.once('SIGINT', () => {
  bot.stop()
  updateRatesCron.stop()
})
process.once('SIGTERM', () => {
  bot.stop()
  updateRatesCron.stop()
})
