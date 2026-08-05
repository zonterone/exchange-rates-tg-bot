import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";
import { isMatching } from "ts-pattern";
import { z } from "zod";
import { fromZod } from "../result";
import type { Payload, Provider } from "./types";
import { api, body, request, userAgent } from "./types";

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

export const parse = (raw: unknown): Result<Payload["rates"], "shape"> =>
  fromZod(z.array(z.unknown()).safeParse(raw))
    .andThen((list) => fromZod(schema.safeParse(list.find(isGelUsd))))
    .andThen((pair) => {
      // banks buy dollars from us, so buyRate is what we get per dollar
      const rates: Payload["rates"] = {
        ...(pair.buyRate === undefined
          ? {}
          : { "gelPerUsd.kursi": pair.buyRate }),
        ...(pair.bankRates?.["BOG"] && {
          "gelPerUsd.bog": pair.bankRates["BOG"].buyRate,
        }),
        ...(pair.bankRates?.["TBC"] && {
          "gelPerUsd.tbc": pair.bankRates["TBC"].buyRate,
        }),
        ...(pair.nbgRate === undefined
          ? {}
          : { "gelPerUsd.nbg": pair.nbgRate }),
      };

      // two of the four rates are still rates; none of them means the pair we
      // found no longer carries a number we know how to read
      return Object.keys(rates).length === 0 ? err("shape") : ok(rates);
    });

export const kursi: Provider = {
  name: "kursi",
  ids: ["gelPerUsd.kursi", "gelPerUsd.bog", "gelPerUsd.tbc", "gelPerUsd.nbg"],
  fetch: () =>
    request(
      "kursi",
      api.get(url, {
        headers: {
          accept: "application/json, text/plain, */*",
          origin: "https://kursi.ge",
          referer: "https://kursi.ge/",
          "user-agent": userAgent,
        },
      })
    )
      .andThen((res) => body("kursi", res))
      .andThen(parse)
      .map((rates) => ({ rates })),
};
