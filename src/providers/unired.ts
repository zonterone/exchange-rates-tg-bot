import { isMatching } from "ts-pattern";
import { z } from "zod";
import type { Payload, Provider } from "./types";
import { api, userAgent } from "./types";

const url = "https://unired-mobile-api.cloudgate.uz/get_rate_marketing/";

// the list carries every direction the bank sells; one malformed neighbour
// must not cost us the only rate we read
const isRubUsd = isMatching({ currency_name: "RUB_TO_USD" });

const schema = z.object({ sell: z.coerce.number() });

export const parse = (raw: unknown): Payload["rates"] => {
  const list = z.array(z.unknown()).safeParse(raw);
  if (!list.success) return {};

  const parsed = schema.safeParse(list.data.find(isRubUsd));
  if (!parsed.success) return {};

  return { "rubPerUsd.unired": parsed.data.sell };
};

export const unired: Provider = {
  name: "unired",
  ids: ["rubPerUsd.unired"],
  fetch: async () => {
    const res = await api
      .get(url, {
        headers: {
          accept: "*/*",
          origin: "https://unired.uz",
          "user-agent": userAgent,
        },
      })
      .json<unknown>();

    return { rates: parse(res) };
  },
};
