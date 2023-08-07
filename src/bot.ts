import { Bot, InlineKeyboard, Keyboard } from 'grammy'

import 'dotenv/config'
import { calculateRatesFromRub, calculateRatesToRub } from './calculateRates'
import { db } from './db'
import { getRates } from './getRates'

export const bot = new Bot(process.env.BOT_TOKEN as string)

const getRatesButtonText = 'Get rates 💸'
const keyboard = new Keyboard()
	.text(getRatesButtonText)
	.resized()
	.persistent()
	.placeholder('Send me sum')

enum currency {
	TO_GEL = 'TO_GEL',
	TO_USD = 'TO_USD',
	FROM_GEL = 'FROM_GEL',
	FROM_USD = 'FROM_USD',
}

const getInlineKeyboard = (
	sum: number,
	activeBtnCommand: keyof typeof currency
) => {
	const keyboardBtns = [
		{ text: `${sum}RUB to ?GEL`, command: currency.TO_GEL },
		{ text: `${sum}RUB to ?USD`, command: currency.TO_USD },
		{ text: `?RUB to ${sum}USD`, command: currency.FROM_USD },
		{ text: `?RUB to ${sum}GEL`, command: currency.FROM_GEL },
	]
	const inlineKeyboard = new InlineKeyboard()
	keyboardBtns.forEach((keyboardBtn) => {
		if (keyboardBtn.command !== activeBtnCommand) {
			inlineKeyboard.text(keyboardBtn.text, keyboardBtn.command).row()
		}
	})
	return inlineKeyboard
}

bot.api.setMyCommands([{ command: 'start', description: 'Start bot' }, { command: 'rates', description: 'Get rates' }])

bot.command(['start'], async (ctx) => {
	await db.push(`/users/${ctx.message?.chat.id}`, {}, false)
	ctx.reply(
		`Hello! This bot watch current exchange rates for Binance and KoronaPay in Georgia direction. To get the rates click the "${getRatesButtonText}".`,
		{ reply_markup: keyboard }
	)
})

bot.on('message', async (ctx) => {
	if (getRatesButtonText === ctx.message?.text) {
		const ratesMessage = await getRates()
		ctx.reply(ratesMessage)
	} else if (!isNaN(Number(ctx.message?.text))) {
		const sum = Number(ctx.message?.text)
		await db.push(
			`/users/${ctx.message?.chat.id}`,
			{ lastSumToCalculate: sum },
			false
		)
		const calculateMessage = await calculateRatesFromRub('GEL', sum)
		ctx.reply(calculateMessage, {
			reply_markup: getInlineKeyboard(sum, currency.TO_GEL),
		})
		await ctx.answerCallbackQuery()
	}
})

bot.callbackQuery(currency.TO_GEL, async (ctx) => {
	const sum = await db.getData(`/users/${ctx?.chat?.id}/lastSumToCalculate`)
	const calculateMessage = await calculateRatesFromRub('GEL', sum)
	await ctx.editMessageText(calculateMessage, {
		reply_markup: getInlineKeyboard(sum, currency.TO_GEL),
	})
	await ctx.answerCallbackQuery()
})

bot.callbackQuery(currency.TO_USD, async (ctx) => {
	const sum = await db.getData(`/users/${ctx?.chat?.id}/lastSumToCalculate`)
	const calculateMessage = await calculateRatesFromRub('USD', sum)
	await ctx.editMessageText(calculateMessage, {
		reply_markup: getInlineKeyboard(sum, currency.TO_USD),
	})
	await ctx.answerCallbackQuery()
})

bot.callbackQuery(currency.FROM_GEL, async (ctx) => {
	const sum = await db.getData(`/users/${ctx?.chat?.id}/lastSumToCalculate`)
	const calculateMessage = await calculateRatesToRub('GEL', sum)
	await ctx.editMessageText(calculateMessage, {
		reply_markup: getInlineKeyboard(sum, currency.FROM_GEL),
	})
	await ctx.answerCallbackQuery()
})

bot.callbackQuery(currency.FROM_USD, async (ctx) => {
	const sum = await db.getData(`/users/${ctx?.chat?.id}/lastSumToCalculate`)
	const calculateMessage = await calculateRatesToRub('USD', sum)
	await ctx.editMessageText(calculateMessage, {
		reply_markup: getInlineKeyboard(sum, currency.FROM_USD),
	})
	await ctx.answerCallbackQuery()
})
