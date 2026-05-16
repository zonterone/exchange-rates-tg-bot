import {
  formatRate,
  getTimeDiffInMinutes,
  isPositiveRate,
} from "./helpers";
import { getStoredRates } from "./updateRates";

export const calculateRatesFromRub = async (
  currency: "GEL" | "USD",
  sum: number
) => {
  const rates = await getStoredRates();

  if (!rates) return "Rates are not loaded yet. Try again later.";

  const rubToCurrencyInKoronaPay = isPositiveRate(rates[`koronaRate${currency}`])
    ? sum / rates[`koronaRate${currency}`]
    : -1;

  return `CBR
RUB->${currency}: ${sum}RUB=${formatRate(
    sum / rates[`CBRRate${currency}`]
  )}${currency}
-------------------------
KoronaPay
RUB->${currency}: ${sum}RUB=${formatRate(
    rubToCurrencyInKoronaPay
  )}${currency}
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

  const rubToCurrencyInKoronaPay = isPositiveRate(rates[`koronaRate${currency}`])
    ? sum * rates[`koronaRate${currency}`]
    : -1;

  return `CBR
RUB->${currency}: ${formatRate(
    sum * rates[`CBRRate${currency}`]
  )}RUB=${sum}${currency}
-------------------------
KoronaPay
RUB->${currency}: ${formatRate(
    rubToCurrencyInKoronaPay
  )}RUB=${sum}${currency}
-------------------------
Last update: ${getTimeDiffInMinutes(rates.updatedDate)} minutes ago
Rates are usually updated every 30 minutes
`;
};
