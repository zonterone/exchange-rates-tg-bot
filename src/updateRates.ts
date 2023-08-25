import { getBinanceP2PRates, getCBRRates, getKoronaPayRates } from './api'
import { db } from './db'

export interface Rates {
	binanceBuyRubToUSDT: number
	binanceSellUsdtToGEL: number
	binanceSellUsdtToUSD: number
	koronaRateGEL: number
	koronaRateUSD: number
	CBRRateUSD: number
	CBRRateGEL: number
	updatedDate: number
}

export const updateRates = async () => {
	try {
		const binanceBuyRubToUsdt = async () =>
			await getBinanceP2PRates('USDT', 'RUB', ['RaiffeisenBank'], 'BUY')
		const binanceSellUsdtToGel = async () =>
			await getBinanceP2PRates('USDT', 'GEL', ['BankOfGeorgia'], 'SELL')
		const binanceSellUsdtToUsd = async () =>
			await getBinanceP2PRates('USDT', 'USD', ['BankOfGeorgia'], 'SELL')
		const koronaGelRate = async () => await getKoronaPayRates('GEL')
		const koronaUsdRate = async () => await getKoronaPayRates('USD')
		const CBRRates = async () => await getCBRRates(['USD', 'GEL'])

		const responses = await Promise.all([
			binanceBuyRubToUsdt(),
			binanceSellUsdtToGel(),
			binanceSellUsdtToUsd(),
			koronaGelRate(),
			koronaUsdRate(),
			CBRRates(),
		])

		const flatNormalizedResponses = responses
			.flat()
			.map((rate) => Number(rate))

		const result = {
			binanceBuyRubToUSDT: flatNormalizedResponses[0],
			binanceSellUsdtToGEL: flatNormalizedResponses[1],
			binanceSellUsdtToUSD: flatNormalizedResponses[2],
			koronaRateGEL: flatNormalizedResponses[3],
			koronaRateUSD: flatNormalizedResponses[4],
			CBRRateUSD: flatNormalizedResponses[5],
			CBRRateGEL: flatNormalizedResponses[6],
			updatedDate: new Date().getTime(),
		} as Rates

		await db.push(`/rates`, result, false)
	} catch (error) {
		console.error(error)
	}
}
