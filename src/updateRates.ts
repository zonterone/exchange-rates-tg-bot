import { getCBRRates, getKoronaPayRates } from "./api";
import { db } from "./db";
import { isPositiveRate } from "./helpers";

export type Rates = {
  koronaRateGEL: number;
  koronaRateUSD: number;
  CBRRateUSD: number;
  CBRRateGEL: number;
  updatedDate: number;
};

type Providers = {
  koronaGelRate: () => Promise<number>;
  koronaUsdRate: () => Promise<number>;
  CBRRates: () => Promise<number[]>;
};

const providers: Providers = {
  koronaGelRate: () => getKoronaPayRates("GEL"),
  koronaUsdRate: () => getKoronaPayRates("USD"),
  CBRRates: () => getCBRRates(["USD", "GEL"]),
};

export const getStoredRates = async () => {
  if (!(await db.exists("/rates"))) return null;
  return (await db.getData("/rates")) as Rates;
};

const normalize = (rate: unknown, fallback: number) => {
  const value = Number(rate);
  return isPositiveRate(value) ? value : fallback;
};

const getSettledRate = (
  result: PromiseSettledResult<number>,
  fallback: number
) => {
  if (result.status === "rejected") {
    console.error(result.reason);
    return fallback;
  }

  return normalize(result.value, fallback);
};

const getSettledCBRRate = (
  result: PromiseSettledResult<number[]>,
  index: number,
  fallback: number
) => {
  if (result.status === "rejected") {
    console.error(result.reason);
    return fallback;
  }

  return normalize(result.value[index], fallback);
};

export const updateRates = async (ratesProviders = providers) => {
  try {
    const fallback = await getStoredRates();
    const responses = (await Promise.allSettled([
      ratesProviders.koronaGelRate(),
      ratesProviders.koronaUsdRate(),
      ratesProviders.CBRRates(),
    ])) as [
      PromiseSettledResult<number>,
      PromiseSettledResult<number>,
      PromiseSettledResult<number[]>
    ];

    const [koronaGelRate, koronaUsdRate, CBRRates] = responses;

    const result: Rates = {
      koronaRateGEL: getSettledRate(
        koronaGelRate,
        fallback?.koronaRateGEL ?? -1
      ),
      koronaRateUSD: getSettledRate(
        koronaUsdRate,
        fallback?.koronaRateUSD ?? -1
      ),
      CBRRateUSD: getSettledCBRRate(
        CBRRates,
        0,
        fallback?.CBRRateUSD ?? -1
      ),
      CBRRateGEL: getSettledCBRRate(
        CBRRates,
        1,
        fallback?.CBRRateGEL ?? -1
      ),
      updatedDate: new Date().getTime(),
    };

    await db.push("/rates", result, false);
    return result;
  } catch (error) {
    console.error(error);
    return null;
  }
};
