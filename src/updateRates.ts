import { ResultAsync, err, errAsync, ok } from "neverthrow";
import type { Result } from "neverthrow";
import { db } from "./db";
import { providers as defaultProviders } from "./providers";
import type { Payload, Provider } from "./providers/types";
import { read, write } from "./result";
import {
  isFailure,
  isProviderName,
  isRateId,
  isValidFee,
  isValidRate,
  type Failure,
  type Fee,
  type HistoryPoint,
  type Quote,
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

const toSnapshot = (stored: unknown): Result<Snapshot, "unreadable"> => {
  if (!stored || typeof stored !== "object") return err("unreadable");

  const snapshot = stored as Partial<Snapshot>;
  if (!snapshot.quotes || typeof snapshot.updatedDate !== "number") {
    return err("unreadable");
  }

  return ok({
    updatedDate: snapshot.updatedDate,
    quotes: toQuotes(snapshot.quotes),
    fees: toFees(snapshot.fees),
    failures: toFailures(snapshot.failures),
    history: pruneHistory(snapshot.history, snapshot.updatedDate),
  });
};

export const getStoredRates = (): ResultAsync<
  Snapshot,
  "cold" | "unreadable"
> =>
  // the lookup is bridged exactly like the read that follows it: json-db
  // throws on both once a load has failed
  read("rates", db.exists("/rates")).andThen((exists) =>
    exists
      ? read("rates", db.getObject<unknown>("/rates")).andThen(toSnapshot)
      : errAsync("cold" as const)
  );

// nothing stored yet reads like a snapshot with nothing in it: every merge
// below then works on one shape instead of an optional one
const empty: Snapshot = {
  updatedDate: 0,
  quotes: {},
  fees: {},
  failures: {},
  history: [],
};

type Answer = { provider: Provider; result: Result<Payload, Failure> };

const merge = (
  stored: Snapshot,
  answers: Answer[],
  updatedDate: number
): Snapshot => {
  const quotes: Snapshot["quotes"] = { ...stored.quotes };
  const fees: Snapshot["fees"] = { ...stored.fees };
  const failures: Snapshot["failures"] = {};
  const fresh: HistoryPoint[] = [];

  answers.forEach(({ provider, result }) => {
    if (result.isErr()) {
      failures[provider.name] = result.error;
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

    // it answered, but nothing readable came out of the answer — a shape
    // change, not a source that never came back
    if (accepted.length === 0) {
      failures[provider.name] = "shape";
      return;
    }

    accepted.forEach((point) => {
      quotes[point.key] = { value: point.value, updatedDate };
    });
    fresh.push(...accepted);
  });

  return {
    updatedDate,
    quotes,
    fees,
    failures,
    history: pruneHistory([...stored.history, ...fresh], updatedDate),
  };
};

// a provider builds its request eagerly, so a header value it cannot send
// throws before its ResultAsync ever exists — the guard is what makes the
// signature above true, and keeps one broken source from costing the cycle
const ask = (provider: Provider): Promise<Result<Payload, Failure>> =>
  Promise.resolve()
    .then(() => provider.fetch())
    .catch((cause) => {
      console.error(provider.name, cause);
      return err("unavailable" as const);
    });

// nothing here rejects, so all five run together and a failed one is simply
// the word it answered with
const collect = (providers: Provider[]) =>
  Promise.all(
    providers.map(async (provider) => ({
      provider,
      result: await ask(provider),
    }))
  );

const cycle = async (providers: Provider[]) => {
  // neither a cold nor an unreadable store may abort the cycle: both mean
  // there is nothing to carry over, and an unreadable one is then overwritten
  // by what this round fetched — a snapshot the formatters reject is worth
  // less than a fresh one with no history
  const stored = await getStoredRates().unwrapOr(empty);
  const answers = await collect(providers);

  return merge(stored, answers, Date.now());
};

const persist = (snapshot: Snapshot) =>
  write("rates", db.push("/rates", snapshot, true)).map(() => snapshot);

export const updateRates = (
  providers: Provider[] = defaultProviders
): ResultAsync<Snapshot, "store"> =>
  ResultAsync.fromSafePromise(cycle(providers)).andThen(persist);
