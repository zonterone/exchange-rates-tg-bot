import type { Result } from "neverthrow";
import { isMatching } from "ts-pattern";
import { z } from "zod";
import { fromZod } from "../result";
import type { Payload, Provider } from "./types";
import { api, body, request, userAgent } from "./types";

const url = "https://unired-mobile-api.cloudgate.uz/get_rate_marketing/";

// the list carries every direction the bank sells; one malformed neighbour
// must not cost us the only rate we read
const isRubUsd = isMatching({ currency_name: "RUB_TO_USD" });

const schema = z.object({ sell: z.coerce.number() });

export const parse = (raw: unknown): Result<Payload["rates"], "shape"> =>
  fromZod(z.array(z.unknown()).safeParse(raw))
    .andThen((list) => fromZod(schema.safeParse(list.find(isRubUsd))))
    .map((entry) => ({ "rubPerUsd.unired": entry.sell }));

export const unired: Provider = {
  name: "unired",
  ids: ["rubPerUsd.unired"],
  fetch: () =>
    request(
      "unired",
      api.get(url, {
        headers: {
          accept: "*/*",
          origin: "https://unired.uz",
          "user-agent": userAgent,
        },
      })
    )
      .andThen((res) => body("unired", res))
      .andThen(parse)
      .map((rates) => ({ rates })),
};
