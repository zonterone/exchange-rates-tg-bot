import ky from "ky";
import { z } from "zod";

const api = ky.create({
  retry: {
    limit: 3,
    backoffLimit: 5000,
  },
  timeout: 60000,
});

enum currenciesEnum {
  "GEL" = "981",
  "USD" = "840",
}

const failedRate = -1;
const rateSchema = z.coerce.number().positive();
const koronaSchema = z.array(z.object({ exchangeRate: rateSchema })).min(1);
const cbrSchema = z.object({
  Valute: z.record(z.string(), z.object({ Value: rateSchema })),
});

export const getKoronaPayRates = async (
  receivingCurrency: keyof typeof currenciesEnum
): Promise<number> => {
  const searchParams = new URLSearchParams({
    sendingCountryId: "RUS",
    sendingCurrencyId: "810",
    receivingCountryId: "GEO",
    receivingCurrencyId: currenciesEnum[receivingCurrency],
    paymentMethod: "debitCard",
    receivingAmount: "100",
    receivingMethod: "cash",
    paidNotificationEnabled: "false",
  });
  const res = await api
    .get("https://koronapay.com/transfers/online/api/transfers/tariffs", {
      searchParams: searchParams,
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      },
    })
    .json<unknown>();

  const result = koronaSchema.safeParse(res);
  if (!result.success) return failedRate;

  return result.data[0]?.exchangeRate ?? failedRate;
};

export const getCBRRates = async (
  currencies: ("USD" | "GEL")[]
): Promise<number[]> => {
  const response = await api
    .get("https://www.cbr-xml-daily.ru/daily_json.js", {})
    .json<unknown>();

  const parsed = cbrSchema.safeParse(response);
  if (!parsed.success) return currencies.map(() => failedRate);

  const result = currencies.map((currency) => {
    return parsed.data.Valute[currency]?.Value ?? failedRate;
  });

  return result;
};
