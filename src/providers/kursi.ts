import { isMatching } from "ts-pattern";
import { z } from "zod";
import type { Payload, Provider } from "./types";
import { api, userAgent } from "./types";

const url = "https://api-core.kursi.ge/api/public/currencies";

const rate = z.coerce.number();

// the response lists dozens of pairs and we need one: validating the whole
// list would let a single broken neighbour cost us four of our nine rates
const isGelUsd = isMatching({
  baseCurrencyCode: "GEL",
  secondaryCurrencyCode: "USD",
});

const schema = z.object({
  buyRate: rate.optional(),
  nbgRate: rate.optional(),
  bankRates: z.record(z.string(), z.object({ buyRate: rate })).optional(),
});

export const parse = (raw: unknown): Payload["rates"] => {
  const list = z.array(z.unknown()).safeParse(raw);
  if (!list.success) return {};

  const parsed = schema.safeParse(list.data.find(isGelUsd));
  if (!parsed.success) return {};

  const pair = parsed.data;

  // banks buy dollars from us, so buyRate is what we get per dollar
  return {
    ...(pair.buyRate === undefined ? {} : { "gelPerUsd.kursi": pair.buyRate }),
    ...(pair.bankRates?.["BOG"] && {
      "gelPerUsd.bog": pair.bankRates["BOG"].buyRate,
    }),
    ...(pair.bankRates?.["TBC"] && {
      "gelPerUsd.tbc": pair.bankRates["TBC"].buyRate,
    }),
    ...(pair.nbgRate === undefined ? {} : { "gelPerUsd.nbg": pair.nbgRate }),
  };
};

export const kursi: Provider = {
  name: "kursi",
  ids: ["gelPerUsd.kursi", "gelPerUsd.bog", "gelPerUsd.tbc", "gelPerUsd.nbg"],
  fetch: async () => {
    const res = await api
      .get(url, {
        headers: {
          accept: "application/json, text/plain, */*",
          origin: "https://kursi.ge",
          referer: "https://kursi.ge/",
          "user-agent": userAgent,
        },
      })
      .json<unknown>();

    return { rates: parse(res) };
  },
};
