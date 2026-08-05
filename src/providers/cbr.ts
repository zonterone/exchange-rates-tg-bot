import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";
import { z } from "zod";
import { fromZod } from "../result";
import type { Payload, Provider } from "./types";
import { api, body, request, userAgent } from "./types";

const url = "https://www.cbr-xml-daily.ru/daily_json.js";

// the daily file carries every currency the bank quotes; only two are ours,
// so each is validated on its own
const schema = z.object({ Valute: z.record(z.string(), z.unknown()) });

const valuteSchema = z.object({
  Value: z.coerce.number(),
  Nominal: z.coerce.number().optional(),
});

export const parse = (raw: unknown): Result<Payload["rates"], "shape"> =>
  fromZod(schema.safeParse(raw)).andThen((data) => {
    const rate = (code: string) => {
      const valute = valuteSchema.safeParse(data.Valute[code]);
      if (!valute.success) return undefined;

      return valute.data.Value / (valute.data.Nominal || 1);
    };

    const usd = rate("USD");
    const gel = rate("GEL");

    const rates: Payload["rates"] = {
      ...(usd === undefined ? {} : { "rubPerUsd.cbr": usd }),
      ...(gel === undefined ? {} : { "rubPerGel.cbr": gel }),
    };

    // one of the two currencies is still a rate; neither of them means the
    // daily file no longer says what it used to
    return Object.keys(rates).length === 0 ? err("shape") : ok(rates);
  });

export const cbr: Provider = {
  name: "cbr",
  ids: ["rubPerUsd.cbr", "rubPerGel.cbr"],
  fetch: () =>
    request("cbr", api.get(url, { headers: { "user-agent": userAgent } }))
      .andThen((res) => body("cbr", res))
      .andThen(parse)
      .map((rates) => ({ rates })),
};
