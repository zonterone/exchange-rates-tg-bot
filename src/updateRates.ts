import { db } from "./db";
import { providers as defaultProviders } from "./providers";
import type { Provider } from "./providers/types";
import {
  isFailure,
  isProviderName,
  isRateId,
  isValidFee,
  isValidRate,
  type Failure,
  type Fee,
  type HistoryPoint,
  type ProviderName,
  type Quote,
  type RateId,
  type Snapshot,
} from "./rates";
import { pruneHistory } from "./trend";

const entriesOf = (stored: unknown) =>
  !stored || typeof stored !== "object"
    ? []
    : Object.entries(stored as Record<string, unknown>);

// the database is a boundary like any provider: a value that drifted, aged out
// of the rate ids or was hand-edited would otherwise reach the formatters
const toQuotes = (stored: unknown) => {
  const quotes: Snapshot["quotes"] = {};

  entriesOf(stored).forEach(([key, stored]) => {
    if (!isRateId(key) || !stored || typeof stored !== "object") return;

    const { value, updatedDate } = stored as Partial<Quote>;
    if (!isValidRate(key, value) || typeof updatedDate !== "number") return;

    quotes[key] = { value, updatedDate };
  });

  return quotes;
};

const toFees = (stored: unknown) => {
  const fees: Snapshot["fees"] = {};

  entriesOf(stored).forEach(([key, stored]) => {
    if (!isProviderName(key) || !stored || typeof stored !== "object") return;

    const { fix, percent } = stored as Partial<Fee>;
    const fee = { fix: Number(fix), percent: Number(percent) };
    if (isValidFee(fee)) fees[key] = fee;
  });

  return fees;
};

const toFailures = (stored: unknown) => {
  const failures: Snapshot["failures"] = {};

  entriesOf(stored).forEach(([key, value]) => {
    if (isProviderName(key) && isFailure(value)) failures[key] = value;
  });

  return failures;
};

const toSnapshot = (stored: unknown): Snapshot | null => {
  if (!stored || typeof stored !== "object") return null;

  const snapshot = stored as Partial<Snapshot>;
  if (!snapshot.quotes || typeof snapshot.updatedDate !== "number") return null;

  return {
    updatedDate: snapshot.updatedDate,
    quotes: toQuotes(snapshot.quotes),
    fees: toFees(snapshot.fees),
    failures: toFailures(snapshot.failures),
    history: pruneHistory(snapshot.history, snapshot.updatedDate),
  };
};

export const getStoredRates = async () => {
  if (!(await db.exists("/rates"))) return null;

  return toSnapshot(await db.getData("/rates"));
};

export const updateRates = async (providers: Provider[] = defaultProviders) => {
  try {
    const stored = await getStoredRates();
    const results = await Promise.allSettled(
      providers.map((provider) => provider.fetch())
    );
    const updatedDate = Date.now();

    const quotes: Partial<Record<RateId, Quote>> = { ...stored?.quotes };
    const fees: Partial<Record<ProviderName, Fee>> = { ...stored?.fees };
    const failures: Partial<Record<ProviderName, Failure>> = {};
    const fresh: HistoryPoint[] = [];

    providers.forEach((provider, index) => {
      const result = results[index];

      if (!result || result.status === "rejected") {
        console.error(provider.name, result?.reason);
        failures[provider.name] = "unavailable";
        return;
      }

      const payload = result.value;
      // an unusable fee keeps the last known one rather than zeroing the cost
      if (payload.fee && isValidFee(payload.fee)) {
        fees[provider.name] = payload.fee;
      }

      const accepted = provider.ids.flatMap((id) => {
        const value = payload.rates[id];
        return isValidRate(id, value) ? [{ key: id, value, updatedDate }] : [];
      });

      accepted.forEach((point) => {
        quotes[point.key] = { value: point.value, updatedDate };
      });
      fresh.push(...accepted);

      if (payload.failure) failures[provider.name] = payload.failure;
      // a provider answering with nothing usable is as unavailable as a dead one
      else if (accepted.length === 0) failures[provider.name] = "unavailable";
    });

    const snapshot: Snapshot = {
      updatedDate,
      quotes,
      fees,
      failures,
      history: pruneHistory(
        [...(stored?.history ?? []), ...fresh],
        updatedDate
      ),
    };

    await db.push("/rates", snapshot, true);
    return snapshot;
  } catch (error) {
    console.error(error);
    return null;
  }
};
