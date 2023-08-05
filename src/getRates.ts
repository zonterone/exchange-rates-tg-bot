import { db } from './db'
import { getTimeDiffInMinutes } from './helpers'
import { Rates } from './updateRates'

export const getRates = async () => {
	const rates = (await db.getData(`/rates`)) as Rates
	const rubToGelInBinance =
		rates.binanceBuyRubToUSDT / rates.binanceSellUsdtToGEL
	const rubToUsdInBinance =
		rates.binanceBuyRubToUSDT / rates.binanceSellUsdtToUSD

	return `CBR
RUB->GEL: 1GEL=${rates.CBRRateGEL.toFixed(2)}RUB
RUB->USD: 1USD=${rates.CBRRateUSD.toFixed(2)}RUB

-------------------------

Binance
Buy: 1USDT=${rates.binanceBuyRubToUSDT.toFixed(2)}RUB
Sell: 1USDT=${rates.binanceSellUsdtToGEL.toFixed(2)}GEL
Sell: 1USDT=${rates.binanceSellUsdtToUSD.toFixed(2)}USD
RUB->USDT->GEL: 1GEL=${rubToGelInBinance.toFixed(2)}RUB ${
		rubToGelInBinance < rates.koronaRateGEL ? '👍' : ''
	}
RUB->USDT->USD: 1USD=${rubToUsdInBinance.toFixed(2)}RUB ${
		rubToUsdInBinance < rates.koronaRateUSD ? '👍' : ''
	}

-------------------------

KoronaPay
RUB->GEL: 1GEL=${rates.koronaRateGEL.toFixed(2)}RUB ${
		rubToGelInBinance < rates.koronaRateGEL ? '' : '👍'
	}
RUB->USD: 1USD=${rates.koronaRateUSD.toFixed(2)}RUB ${
		rubToUsdInBinance < rates.koronaRateUSD ? '' : '👍'
	}

-------------------------
Last update: ${getTimeDiffInMinutes(rates.updatedDate)} minutes ago
Rates are usually updated every 30 minutes

If you want to calculate sum send it to me
`
}
