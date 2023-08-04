import { getBinanceP2PRates, getCBRRates, getKoronaPayRates } from './api'
import { db } from './db'

export interface Rates {
	binanceBuyRubToUsdt: number
	binanceSellUsdtToGel: number
	koronaGelRate: number
	koronaUsdRate: number
	CBRRateUSD: number
	CBRRateGEL: number
	updatedDate: number
}

export const updateRates = async () => {
	try {
		

	const binanceBuyRubToUsdt = async () =>
		await getBinanceP2PRates('USDT', 'RUB', ['TinkoffNew', 'Tinkoff'], 'BUY')
	const binanceSellUsdtToGel = async () =>
		await getBinanceP2PRates('USDT', 'GEL', ['BankOfGeorgia'], 'SELL')
	const koronaGelRate = async () => await getKoronaPayRates('GEL')
	const koronaUsdRate = async () => await getKoronaPayRates('USD')
	const CBRRates = async () => await getCBRRates(['USD', 'GEL'])

	const responses = await Promise.all([
		binanceBuyRubToUsdt(),
		binanceSellUsdtToGel(),
		koronaGelRate(),
		koronaUsdRate(),
		CBRRates(),
	])
	const flatNormalizedResponses = responses
		.flat()
		.map((rate: string) => Number(rate))
	const result = {
		binanceBuyRubToUsdt: flatNormalizedResponses[0],
		binanceSellUsdtToGel: flatNormalizedResponses[1],
		koronaGelRate: flatNormalizedResponses[2],
		koronaUsdRate: flatNormalizedResponses[3],
		CBRRateUSD: flatNormalizedResponses[4],
		CBRRateGEL: flatNormalizedResponses[5],
		updatedDate: new Date().getTime(),
	} as Rates

	await db.push(`/rates`, result, false)
		console.info('rates are updated');
	} catch (error) {
		console.error(error)
	}
}
