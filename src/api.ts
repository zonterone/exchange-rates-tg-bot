import ky from 'ky'

export const getBinanceP2PRates = async (
	asset: string,
	fiat: string,
	payTypes: string[],
	tradeType: 'BUY' | 'SELL'
) => {
	const res = (await ky
		.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
			json: {
				asset: asset,
				fiat: fiat,
				merchantCheck: 'False',
				page: 1,
				payTypes: payTypes,
				rows: 1,
				tradeType: tradeType,
			},
		})
		.json()) as any

	return res.data[0].adv.price
}

enum currenciesEnum {
	'GEL' = '981',
	'USD' = '840',
}
export const getKoronaPayRates = async (
	receivingCurrency: keyof typeof currenciesEnum
) => {
	const searchParams = new URLSearchParams({
		sendingCountryId: 'RUS',
		sendingCurrencyId: '810',
		receivingCountryId: 'GEO',
		receivingCurrencyId: currenciesEnum[receivingCurrency],
		paymentMethod: 'debitCard',
		receivingAmount: '100',
		receivingMethod: 'cash',
		paidNotificationEnabled: 'false',
	})
	const res = (await ky
		.get('https://koronapay.com/transfers/online/api/transfers/tariffs', {
			headers: {
				authority: 'koronapay.com',
				accept: 'application/vnd.cft-data.v2.99+json',
				'accept-language': 'en',
				dnt: '1',
				referer: 'https://koronapay.com/transfers/online/',
				'sec-ch-ua': '"Chromium";v="115", "Not/A)Brand";v="99"',
				'sec-ch-ua-mobile': '?0',
				'sec-ch-ua-platform': '"macOS"',
				'sec-fetch-dest': 'empty',
				'sec-fetch-mode': 'cors',
				'sec-fetch-site': 'same-origin',
				'user-agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
				'x-application': 'Qpay-Web/3.0',
			},
			searchParams: searchParams,
		})
		.json()) as any

	return res[0].exchangeRate
}

export const getCBRRates = async (currencies: ('USD' | 'GEL')[]) => {
	const response = (await ky
		.get('https://www.cbr-xml-daily.ru/daily_json.js', {})
    .json()) as any
  
  const result = currencies.map((currency) => {
    return response.Valute[currency].Value
   })

	return result
}
