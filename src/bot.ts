import { Telegraf } from 'telegraf'

import { db } from './db'

import 'dotenv/config'
import { Rates } from './updateRates'
import { getTimeDiffInMinutes } from './helpers'

export const bot = new Telegraf(process.env.BOT_TOKEN as string)

bot.command(['rates', 'start'], async (ctx) => {
	const rates = await db.getData(`/rates`) as Rates
	const rubToGelInBinance = (rates.binanceBuyRubToUsdt / rates.binanceSellUsdtToGel)

	ctx.reply(`CBR
RUB->GEL: 1GEL=${rates.CBRRateGEL.toFixed(2)}RUB
RUB->USD: 1USD=${rates.CBRRateUSD.toFixed(2)}RUB
	
-------------------------
	
Binance
Buy: 1USDT=${rates.binanceBuyRubToUsdt.toFixed(2)}RUB
Sell: 1USDT=${rates.binanceSellUsdtToGel.toFixed(2)}GEL
RUB->USDT->GEL: 1GEL=${rubToGelInBinance.toFixed(2)}RUB ${rubToGelInBinance < rates.koronaGelRate ? '👍' : ''}

-------------------------

KoronaPay
RUB->GEL: 1GEL=${rates.koronaGelRate.toFixed(2)}RUB ${rubToGelInBinance < rates.koronaGelRate ? '' : '👍'}
RUB->USD: 1USD=${rates.koronaUsdRate.toFixed(2)}RUB

-------------------------
Last update: ${getTimeDiffInMinutes(rates.updatedDate)} minutes ago
Rates are usually updated every 30 minutes`)
})

