import { currencySymbols, getTimeDiffInMinutes } from "./helpers";
import { formatRateWithInsights } from "./trend";
import { getStoredRates } from "./updateRates";

export const getRates = async () => {
  const rates = await getStoredRates();

  if (!rates) return "Rates are not loaded yet. Try again later.";

  return `CBR
1${currencySymbols.GEL}=${formatRateWithInsights(
    rates.CBRRateGEL,
    rates.history,
    "CBRRateGEL",
    rates.updatedDate
  )}
1${currencySymbols.USD}=${formatRateWithInsights(
    rates.CBRRateUSD,
    rates.history,
    "CBRRateUSD",
    rates.updatedDate
  )}
-------------------------
KoronaPay
1${currencySymbols.GEL}=${formatRateWithInsights(
    rates.koronaRateGEL,
    rates.history,
    "koronaRateGEL",
    rates.updatedDate
  )}
1${currencySymbols.USD}=${formatRateWithInsights(
    rates.koronaRateUSD,
    rates.history,
    "koronaRateUSD",
    rates.updatedDate
  )}
-------------------------
Last update: ${getTimeDiffInMinutes(rates.updatedDate)} minutes ago
Rates are usually updated every 30 minutes

If you want to calculate sum send it to me
`;
};
