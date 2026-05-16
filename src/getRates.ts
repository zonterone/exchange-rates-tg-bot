import { formatRate, getTimeDiffInMinutes } from "./helpers";
import { getStoredRates } from "./updateRates";

export const getRates = async () => {
  const rates = await getStoredRates();

  if (!rates) return "Rates are not loaded yet. Try again later.";

  return `CBR
RUB->GEL: 1GEL=${formatRate(rates.CBRRateGEL)}RUB
RUB->USD: 1USD=${formatRate(rates.CBRRateUSD)}RUB
-------------------------
KoronaPay
RUB->GEL: 1GEL=${formatRate(rates.koronaRateGEL)}RUB
RUB->USD: 1USD=${formatRate(rates.koronaRateUSD)}RUB
-------------------------
Last update: ${getTimeDiffInMinutes(rates.updatedDate)} minutes ago
Rates are usually updated every 30 minutes

If you want to calculate sum send it to me
`;
};
