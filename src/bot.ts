import { Bot, Keyboard } from 'grammy'

import { db } from './db'

import 'dotenv/config'
import { getTimeDiffInMinutes } from './helpers'
import { Rates } from './updateRates'

export const bot = new Bot(process.env.BOT_TOKEN as string)

const getRatesButtonText = 'Get rates 💸'
const keyboard = new Keyboard().text(getRatesButtonText).resized().persistent()

bot.api.setMyCommands([{ command: 'start', description: 'Start bot' }])

bot.command(['start'], async (ctx) => {
	ctx.reply(
		`Hello! This bot watch current exchange rates for Binance and KoronaPay in Georgia direction. To get the rates click the "${getRatesButtonText}".`,
		{ reply_markup: keyboard }
	)
})

bot.on('message', async (ctx) => {
	if (getRatesButtonText !== ctx.message?.text) return

	const rates = (await db.getData(`/rates`)) as Rates
	const rubToGelInBinance =
		rates.binanceBuyRubToUsdt / rates.binanceSellUsdtToGel

	ctx.reply(`CBR
RUB->GEL: 1GEL=${rates.CBRRateGEL.toFixed(2)}RUB
RUB->USD: 1USD=${rates.CBRRateUSD.toFixed(2)}RUB
	
-------------------------
	
Binance
Buy: 1USDT=${rates.binanceBuyRubToUsdt.toFixed(2)}RUB
Sell: 1USDT=${rates.binanceSellUsdtToGel.toFixed(2)}GEL
RUB->USDT->GEL: 1GEL=${rubToGelInBinance.toFixed(2)}RUB ${
		rubToGelInBinance < rates.koronaGelRate ? '👍' : ''
	}

-------------------------

KoronaPay
RUB->GEL: 1GEL=${rates.koronaGelRate.toFixed(2)}RUB ${
		rubToGelInBinance < rates.koronaGelRate ? '' : '👍'
	}
RUB->USD: 1USD=${rates.koronaUsdRate.toFixed(2)}RUB

-------------------------
Last update: ${getTimeDiffInMinutes(rates.updatedDate)} minutes ago
Rates are usually updated every 30 minutes`)
})
