import ky from "ky";
import type { KyResponse } from "ky";
import { ResultAsync } from "neverthrow";
import type { Failure, Fee, ProviderName, RateId } from "../rates";

export type Payload = {
  rates: Partial<Record<RateId, number>>;
  fee?: Fee;
};

export type Provider = {
  name: ProviderName;
  ids: RateId[];
  fetch: () => ResultAsync<Payload, Failure>;
};

export const api = ky.create({
  // ky retries neither POST nor timeouts by default, and half of the sources
  // are POST — every request here is a read, so repeating one is safe
  retry: {
    limit: 3,
    backoffLimit: 5000,
    methods: ["get", "post"],
    retryOnTimeout: true,
  },
  // per attempt; four full minutes of retries would stall the update cycle
  timeout: 15000,
  totalTimeout: 60000,
});

export const userAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

// every provider bridges ky the same way: a request that never came back with
// an answer is unavailable to the caller, and only that word travels on — so
// the cause is logged here, the last place it exists
export const request = <T>(name: ProviderName, promise: PromiseLike<T>) =>
  ResultAsync.fromPromise(promise, (cause) => {
    console.error(name, cause);
    return "unavailable" as const;
  });

// reading the body is its own step: an answer that arrived and cannot be read
// is a source that changed shape, not one that never answered — a WAF page in
// place of json says nothing about the endpoint being up
export const body = (name: ProviderName, res: KyResponse) =>
  ResultAsync.fromPromise(res.json<unknown>(), (cause) => {
    console.error(name, cause);
    return "shape" as const;
  });
