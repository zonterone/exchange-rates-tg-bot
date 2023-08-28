import { getByBitRates, getCBRRates, getKoronaPayRates, getOKXRates } from './api'
import { db } from './db'

export interface Rates {
	koronaRateGEL: number
	koronaRateUSD: number
	CBRRateUSD: number
	CBRRateGEL: number
	OKXBuyRUBToUsdt: number
	OKXSellUsdtToGEL: number
	OKXSellUsdtToUSD: number
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
		const OKXBuyRubToUsdt = async () => await getOKXRates({ currency: 'rub', paymentMethod: 'SBP Fast Bank Transfer', type: 'buy' })
		const OKXSellUsdtToGel = async () => await getOKXRates({ currency: 'gel', paymentMethod: 'Bank of Georgia', type: 'sell' })
		const ByBitBuyRubToUsdt = async () => await getByBitRates({ currency: 'RUB', paymentMethod: 'SBP Fast Bank Transfer', type: 'buy' })
		const ByBitSellUsdtToGel = async () => await getByBitRates({ currency: 'GEL', paymentMethod: 'Bank of Georgia', type: 'sell' })
		const ByBitSellUsdtToUsd = async () => await getByBitRates({ currency: 'USD', paymentMethod: 'Bank of Georgia', type: 'sell' })

		const responses = await Promise.all([
			koronaGelRate(),
			koronaUsdRate(),
			CBRRates(),
			OKXBuyRubToUsdt(),
			OKXSellUsdtToGel(),
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
			OKXBuyRUBToUsdt: flatNormalizedResponses[4],
			OKXSellUsdtToGEL: flatNormalizedResponses[5],
			OKXSellUsdtToUSD: -1,
			ByBitBuyRUBToUsdt: flatNormalizedResponses[6],
			ByBitSellUsdtToGEL: flatNormalizedResponses[7],
			ByBitSellUsdtToUSD: flatNormalizedResponses[8],
			updatedDate: new Date().getTime(),
		}

		await db.push(`/rates`, result, false)
	} catch (error) {
		console.error(error)
	}
}
