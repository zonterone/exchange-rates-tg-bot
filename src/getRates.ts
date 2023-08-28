import { db } from './db'
import { getTimeDiffInMinutes } from './helpers'
import { Rates } from './updateRates'

export const getRates = async () => {
	const rates = (await db.getData(`/rates`)) as Rates

	return `CBR
RUB->GEL: 1GEL=${rates.CBRRateGEL.toFixed(2)}RUB
RUB->USD: 1USD=${rates.CBRRateUSD.toFixed(2)}RUB

-------------------------

KoronaPay
RUB->GEL: 1GEL=${rates.koronaRateGEL.toFixed(2)}RUB
RUB->USD: 1USD=${rates.koronaRateUSD.toFixed(2)}RUB

-------------------------
Last update: ${getTimeDiffInMinutes(rates.updatedDate)} minutes ago
Rates are usually updated every 30 minutes

If you want to calculate sum send it to me
`
}
