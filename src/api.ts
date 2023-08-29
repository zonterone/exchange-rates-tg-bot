import ky from 'ky'

const api = ky.create({
	retry: {
		limit: 3,
		backoffLimit: 5000,
	},
	timeout: 60000,
})

enum currenciesEnum {
	'GEL' = '981',
	'USD' = '840',
}
export const getKoronaPayRates = async (
	receivingCurrency: keyof typeof currenciesEnum
): Promise<number | string> => {
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
	const res = (await api
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

export const getCBRRates = async (
	currencies: ('USD' | 'GEL')[]
): Promise<(number | string)[]> => {
	const response = (await api
		.get('https://www.cbr-xml-daily.ru/daily_json.js', {})
		.json()) as any

	const result = currencies.map((currency) => {
		return response.Valute[currency].Value
	})

	return result
}

enum SideEnum {
	'sell',
	'buy',
}

enum PaymentTypeEnum {
	'SBP Fast Bank Transfer' = 14,
	'Bank of Georgia' = 11,
}

type ByBitRatesArgType = { type: 'sell' | 'buy' } & ({
	currency: 'RUB'
	paymentMethod: 'SBP Fast Bank Transfer'
} | {
	currency: 'GEL'
	paymentMethod: 'Bank of Georgia'
} |
{
	currency: 'USD'
	paymentMethod: 'Bank of Georgia'
})

export const getByBitRates = async (args: ByBitRatesArgType) => {

	const response = (await api
		.post('https://api2.bybit.com/fiat/otc/item/online', {
			json: {
				tokenId: "USDT",
				currencyId: args.currency,
				payment: [
					`${PaymentTypeEnum[args.paymentMethod]}`
				],
				side: `${SideEnum[args.type]}`,
				size: "1",
				page: "1",
				amount: "",
				authMaker: false,
				canTrade: false
			}
		})
		.json()) as any

	return response.result.items[0].price
}
