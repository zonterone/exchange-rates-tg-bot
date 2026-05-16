import {
  currencySymbols,
  formatRate,
  getTimeDiffInMinutes,
  isPositiveRate,
} from "./helpers";
import { formatRateInsightsSuffix } from "./trend";
import { getStoredRates } from "./updateRates";

export const calculateRatesFromRub = async (
  currency: "GEL" | "USD",
  sum: number
) => {
  const rates = await getStoredRates();

  if (!rates) return "Rates are not loaded yet. Try again later.";

  const symbol = currencySymbols[currency];
  const rubToCurrencyInKoronaPay = isPositiveRate(rates[`koronaRate${currency}`])
    ? sum / rates[`koronaRate${currency}`]
    : -1;

  return `CBR
${sum}${currencySymbols.RUB}=${formatRate(
    sum / rates[`CBRRate${currency}`]
  )}${symbol}${formatRateInsightsSuffix(
    rates.history,
    `CBRRate${currency}`,
    rates[`CBRRate${currency}`],
    rates.updatedDate
  )}
-------------------------
KoronaPay
${sum}${currencySymbols.RUB}=${formatRate(
    rubToCurrencyInKoronaPay
  )}${symbol}${formatRateInsightsSuffix(
    rates.history,
    `koronaRate${currency}`,
    rates[`koronaRate${currency}`],
    rates.updatedDate
  )}
-------------------------
Last update: ${getTimeDiffInMinutes(rates.updatedDate)} minutes ago
Rates are usually updated every 30 minutes
`;
};

export const calculateRatesToRub = async (
  currency: "GEL" | "USD",
  sum: number
) => {
  const rates = await getStoredRates();

  if (!rates) return "Rates are not loaded yet. Try again later.";

  const symbol = currencySymbols[currency];
  const rubToCurrencyInKoronaPay = isPositiveRate(rates[`koronaRate${currency}`])
    ? sum * rates[`koronaRate${currency}`]
    : -1;

  return `CBR
${formatRate(
    sum * rates[`CBRRate${currency}`]
  )}${currencySymbols.RUB}=${sum}${symbol}${formatRateInsightsSuffix(
    rates.history,
    `CBRRate${currency}`,
    rates[`CBRRate${currency}`],
    rates.updatedDate
  )}
-------------------------
KoronaPay
${formatRate(
    rubToCurrencyInKoronaPay
  )}${currencySymbols.RUB}=${sum}${symbol}${formatRateInsightsSuffix(
    rates.history,
    `koronaRate${currency}`,
    rates[`koronaRate${currency}`],
    rates.updatedDate
  )}
-------------------------
Last update: ${getTimeDiffInMinutes(rates.updatedDate)} minutes ago
Rates are usually updated every 30 minutes
`;
};
