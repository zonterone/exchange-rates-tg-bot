import ky from "ky";
import type { Failure, Fee, ProviderName, RateId } from "../rates";

export type Payload = {
  rates: Partial<Record<RateId, number>>;
  fee?: Fee;
  failure?: Failure;
};

export type Provider = {
  name: ProviderName;
  ids: RateId[];
  fetch: () => Promise<Payload>;
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
