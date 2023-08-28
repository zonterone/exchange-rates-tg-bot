import { getCBRRates, getKoronaPayRates } from './api'
import { db } from './db'

export interface Rates {
	koronaRateGEL: number
	koronaRateUSD: number
	CBRRateUSD: number
	CBRRateGEL: number
	updatedDate: number
}

export const updateRates = async () => {
	try {
		const koronaGelRate = async () => await getKoronaPayRates('GEL')
		const koronaUsdRate = async () => await getKoronaPayRates('USD')
		const CBRRates = async () => await getCBRRates(['USD', 'GEL'])

		const responses = await Promise.all([
			koronaGelRate(),
			koronaUsdRate(),
			CBRRates(),
		])

		const flatNormalizedResponses = responses
			.flat()
			.map((rate) => Number(rate))

		const result = {
			koronaRateGEL: flatNormalizedResponses[0],
			koronaRateUSD: flatNormalizedResponses[1],
			CBRRateUSD: flatNormalizedResponses[2],
			CBRRateGEL: flatNormalizedResponses[3],
			updatedDate: new Date().getTime(),
		} as Rates

		await db.push(`/rates`, result, false)
	} catch (error) {
		console.error(error)
	}
}
