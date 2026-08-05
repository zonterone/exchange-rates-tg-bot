import { randomUUID } from "node:crypto";
import { isMatching } from "ts-pattern";
import { z } from "zod";
import { env } from "../env";
import type { Payload, Provider } from "./types";
import { api, userAgent } from "./types";

const url =
  "https://api.multitransfer.ru/anonymous/multi/multitransfer-fee-calc/v3/commissions";

const sessionRejected = 423;

// the response quotes every delivery type; a broken cash entry must not cost
// us the card one, which is the only rate the bot uses
const isToCard = isMatching({ deliveryType: "to_card" });

const schema = z.object({ fees: z.array(z.unknown()) });

const feeSchema = z.object({
  commissions: z.array(z.object({ money: z.object({ rate: z.coerce.number() }) })),
});

export const parse = (raw: unknown): Payload["rates"] => {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return {};

  const card = feeSchema.safeParse(parsed.data.fees.find(isToCard));
  if (!card.success) return {};

  const rate = card.data.commissions[0]?.money.rate;
  if (rate === undefined) return {};

  return { "rubPerUsd.multitransfer": rate };
};

export const multitransfer: Provider = {
  name: "multitransfer",
  ids: ["rubPerUsd.multitransfer"],
  fetch: async () => {
    // a missing session id is answered with 400, so do not spend the request
    if (!env.session) return { rates: {}, failure: "session" };

    const res = await api.post(url, {
      throwHttpErrors: false,
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "ru",
        "client-id": "multitransfer-web-id",
        "content-type": "application/json",
        fhprequestid: randomUUID(),
        fhpsessionid: env.session,
        origin: "https://multitransfer.ru",
        referer: "https://multitransfer.ru/",
        "x-request-id": randomUUID(),
        "user-agent": userAgent,
      },
      json: {
        countryCode: "GEO",
        range: "ALL_PLUS_LIMITS",
        money: {
          acceptedMoney: { currencyCode: "RUB" },
          withdrawMoney: { currencyCode: "USD", amount: 1 },
        },
      },
    });

    if (res.status === sessionRejected) {
      return { rates: {}, failure: "session" };
    }
    if (!res.ok) return { rates: {}, failure: "unavailable" };

    return { rates: parse(await res.json<unknown>()) };
  },
};
