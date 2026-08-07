import { providers } from "../src/providers";
import { quote } from "../src/providers/kwikpay";
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

// KwikPay's commission is folded into its rate, which is only honest while the
// commission stays proportional. One sum can never show that: a fixed part
// would quietly ride along inside the rate and be wrong for every other sum,
// so the check is the same rate coming back at two of them
const folded = async () => {
  const answers = await Promise.all(["100", "500"].map(quote));
  const nothing: Payload = { rates: {} };
  const [first, second] = answers.map(
    (answer) => answer.unwrapOr(nothing).rates["rubPerUsd.kwikpay"]
  );

  if (first === undefined || second === undefined) {
    console.error("kwikpay: no rate at one of the two sums, nothing to compare");
    return;
  }

  // the rouble side is quoted to the kopeck, so dividing it by two different
  // sums lands the rate a fraction of a kopeck apart; a fixed part of even one
  // rouble would move it by 0.008 — an order of magnitude past this
  const drift = 0.001;
  if (Math.abs(first - second) > drift) {
    console.error(
      `kwikpay: rate moves with the sum (${first} at 100$, ${second} at 500$) — the fee is no longer proportional and must leave the rate!`
    );
    return;
  }

  console.info(`kwikpay: rate holds at 100$ and 500$ (${first}, ${second})`);
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

  await folded();
};

probe().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
