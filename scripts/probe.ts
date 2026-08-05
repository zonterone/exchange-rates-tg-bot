import { providers } from "../src/providers";
import type { Payload } from "../src/providers/types";
import { isValidRate, type RateId } from "../src/rates";

const describe = (payload: Payload) => {
  const rates = Object.entries(payload.rates)
    .map(([id, value]) => {
      const valid = isValidRate(id as RateId, value) ? "" : " (out of range!)";
      return `${id}=${value}${valid}`;
    })
    .join(", ");

  return [
    rates || "no rates",
    payload.fee ? `fee=${JSON.stringify(payload.fee)}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
};

// hits every live endpoint and prints what parsed — the quickest way to tell
// a broken provider from a broken parser
const probe = async () => {
  const answers = await Promise.all(
    providers.map(async (provider) => {
      const started = Date.now();
      const result = await provider.fetch();
      return { name: provider.name, result, ms: Date.now() - started };
    })
  );

  answers.forEach(({ name, result, ms }) => {
    result.match(
      (payload) => console.info(`${name}: ${ms}ms | ${describe(payload)}`),
      (failure) => console.error(`${name}: ${ms}ms | failure=${failure}`)
    );
  });
};

probe().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
