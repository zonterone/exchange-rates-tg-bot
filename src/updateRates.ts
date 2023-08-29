import { getByBitRates, getCBRRates, getKoronaPayRates } from './api'
import { db } from './db'

export interface Rates {
	koronaRateGEL: number
	koronaRateUSD: number
	CBRRateUSD: number
	CBRRateGEL: number
	ByBitBuyRUBToUsdt: number
	ByBitSellUsdtToGEL: number
	ByBitSellUsdtToUSD: number
	updatedDate: number
}

export const updateRates = async () => {
	try {
		const koronaGelRate = async () => await getKoronaPayRates('GEL')
		const koronaUsdRate = async () => await getKoronaPayRates('USD')
		const CBRRates = async () => await getCBRRates(['USD', 'GEL'])
		const ByBitBuyRubToUsdt = async () => await getByBitRates({ currency: 'RUB', paymentMethod: 'SBP Fast Bank Transfer', type: 'buy' })
		const ByBitSellUsdtToGel = async () => await getByBitRates({ currency: 'GEL', paymentMethod: 'Bank of Georgia', type: 'sell' })
		const ByBitSellUsdtToUsd = async () => await getByBitRates({ currency: 'USD', paymentMethod: 'Bank of Georgia', type: 'sell' })

		const responses = await Promise.all([
			koronaGelRate(),
			koronaUsdRate(),
			CBRRates(),
			ByBitBuyRubToUsdt(),
			ByBitSellUsdtToGel(),
			ByBitSellUsdtToUsd(),
		])

		const flatNormalizedResponses = responses
			.flat()
			.map((rate) => Number(rate))

		const result: Rates = {
			koronaRateGEL: flatNormalizedResponses[0],
			koronaRateUSD: flatNormalizedResponses[1],
			CBRRateUSD: flatNormalizedResponses[2],
			CBRRateGEL: flatNormalizedResponses[3],
			ByBitBuyRUBToUsdt: flatNormalizedResponses[4],
			ByBitSellUsdtToGEL: flatNormalizedResponses[5],
			ByBitSellUsdtToUSD: flatNormalizedResponses[6],
			updatedDate: new Date().getTime(),
		}

		await db.push(`/rates`, result, false)
	} catch (error) {
		console.error(error)
	}
}
