import { getCBRRates, getKoronaPayRates } from "./api";
import { db } from "./db";
import { isPositiveRate } from "./helpers";
import {
  pruneRateHistory,
  type RateHistoryPoint,
  type RateSnapshot,
} from "./trend";

export type Rates = RateSnapshot & {
  history?: RateHistoryPoint[];
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

const getFreshRate = (
  result: PromiseSettledResult<number>,
  key: RateHistoryPoint["key"],
  updatedDate: number
) => {
  if (result.status === "rejected") return null;

  const value = Number(result.value);
  if (!isPositiveRate(value)) return null;

  return { key, value, updatedDate };
};

const getFreshCBRRate = (
  result: PromiseSettledResult<number[]>,
  index: number,
  key: RateHistoryPoint["key"],
  updatedDate: number
) => {
  if (result.status === "rejected") return null;

  const value = Number(result.value[index]);
  if (!isPositiveRate(value)) return null;

  return { key, value, updatedDate };
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
    const updatedDate = new Date().getTime();

    const current = {
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
      updatedDate,
    };
    const history = pruneRateHistory(fallback?.history ?? [], updatedDate);
    const fresh = [
      getFreshRate(koronaGelRate, "koronaRateGEL", updatedDate),
      getFreshRate(koronaUsdRate, "koronaRateUSD", updatedDate),
      getFreshCBRRate(CBRRates, 0, "CBRRateUSD", updatedDate),
      getFreshCBRRate(CBRRates, 1, "CBRRateGEL", updatedDate),
    ].filter((point): point is RateHistoryPoint => point !== null);
    const result: Rates = {
      ...current,
      history: pruneRateHistory([...history, ...fresh], updatedDate),
    };

    await db.push("/rates", result, true);
    return result;
  } catch (error) {
    console.error(error);
    return null;
  }
};
