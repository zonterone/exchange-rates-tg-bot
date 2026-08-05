import { providers } from "../src/providers";
import { isValidRate, type RateId } from "../src/rates";

// hits every live endpoint and prints what parsed — the quickest way to tell
// a broken provider from a broken parser
const probe = async () => {
  const results = await Promise.allSettled(
    providers.map(async (provider) => {
      const started = Date.now();
      const payload = await provider.fetch();
      return { provider, payload, ms: Date.now() - started };
    })
  );

  results.forEach((result, index) => {
    const name = providers[index]?.name ?? "unknown";

    if (result.status === "rejected") {
      console.error(`${name}: request failed —`, result.reason);
      return;
    }

    const { payload, ms } = result.value;
    const rates = Object.entries(payload.rates)
      .map(([id, value]) => {
        const valid = isValidRate(id as RateId, value) ? "" : " (out of range!)";
        return `${id}=${value}${valid}`;
      })
      .join(", ");

    console.info(
      [
        `${name}: ${ms}ms`,
        payload.failure ? `failure=${payload.failure}` : "",
        rates || "no rates",
        payload.fee ? `fee=${JSON.stringify(payload.fee)}` : "",
      ]
        .filter(Boolean)
        .join(" | ")
    );
  });
};

probe().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
