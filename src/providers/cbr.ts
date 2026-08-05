import { z } from "zod";
import type { Payload, Provider } from "./types";
import { api, userAgent } from "./types";

const url = "https://www.cbr-xml-daily.ru/daily_json.js";

// the daily file carries every currency the bank quotes; only two are ours,
// so each is validated on its own
const schema = z.object({ Valute: z.record(z.string(), z.unknown()) });

const valuteSchema = z.object({
  Value: z.coerce.number(),
  Nominal: z.coerce.number().optional(),
});

export const parse = (raw: unknown): Payload["rates"] => {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return {};

  const rate = (code: string) => {
    const valute = valuteSchema.safeParse(parsed.data.Valute[code]);
    if (!valute.success) return undefined;

    return valute.data.Value / (valute.data.Nominal || 1);
  };

  const usd = rate("USD");
  const gel = rate("GEL");

  return {
    ...(usd === undefined ? {} : { "rubPerUsd.cbr": usd }),
    ...(gel === undefined ? {} : { "rubPerGel.cbr": gel }),
  };
};

export const cbr: Provider = {
  name: "cbr",
  ids: ["rubPerUsd.cbr", "rubPerGel.cbr"],
  fetch: async () => {
    const res = await api
      .get(url, { headers: { "user-agent": userAgent } })
      .json<unknown>();

    return { rates: parse(res) };
  },
};
