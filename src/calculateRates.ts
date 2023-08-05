import { db } from './db'
import { getTimeDiffInMinutes } from './helpers'
import { Rates } from './updateRates'

export const calculateRatesFromRub = async (
	currency: 'GEL' | 'USD',
	sum: number
) => {
	const rates = (await db.getData(`/rates`)) as Rates
	const rubToCurrencyInBinance =
		rates.binanceBuyRubToUSDT / rates[`binanceSellUsdtTo${currency}`]

	return `CBR
RUB->${currency}: ${sum}RUB=${(sum / rates[`CBRRate${currency}`]).toFixed(
		2
	)}${currency}
-------------------------
Binance
RUB->USDT->${currency}: ${sum}RUB=${(sum / rubToCurrencyInBinance).toFixed(
		2
	)}${currency}
-------------------------
KoronaPay
RUB->${currency}: ${sum}RUB=${(sum / rates[`koronaRate${currency}`]).toFixed(
		2
	)}${currency}
-------------------------
Last update: ${getTimeDiffInMinutes(rates.updatedDate)} minutes ago
Rates are usually updated every 30 minutes
`
}

export const calculateRatesToRub = async (
	currency: 'GEL' | 'USD',
	sum: number
) => {
	const rates = (await db.getData(`/rates`)) as Rates
	const rubToCurrencyInBinance =
		rates.binanceBuyRubToUSDT / rates[`binanceSellUsdtTo${currency}`]

	return `CBR
RUB->${currency}: ${(sum * rates[`CBRRate${currency}`]).toFixed(
		2
	)}RUB=${sum}${currency}
-------------------------
Binance
RUB->USDT->${currency}: ${(sum * rubToCurrencyInBinance).toFixed(
		2
	)}RUB=${sum}${currency}
-------------------------
KoronaPay
RUB->${currency}: ${(sum * rates[`koronaRate${currency}`]).toFixed(
		2
	)}RUB=${sum}${currency}
-------------------------
Last update: ${getTimeDiffInMinutes(rates.updatedDate)} minutes ago
Rates are usually updated every 30 minutes
`
}
