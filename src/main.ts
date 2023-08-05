import { CronJob } from 'cron'
import { bot } from './bot'
import { updateRates } from './updateRates'

const updateRatesCron = new CronJob('*/30 * * * *', async () => {
  await updateRates()
})

// initial update
updateRates()

bot.start()
console.info('Bot started')

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
