import { randomUUID } from "node:crypto";
import { err, errAsync, ok } from "neverthrow";
import type { Result } from "neverthrow";
import { isMatching } from "ts-pattern";
import { z } from "zod";
import { env } from "../env";
import { fromZod } from "../result";
import type { Payload, Provider } from "./types";
import { api, body, request, userAgent } from "./types";

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

export const parse = (raw: unknown): Result<Payload["rates"], "shape"> =>
  fromZod(schema.safeParse(raw))
    .andThen((data) => fromZod(feeSchema.safeParse(data.fees.find(isToCard))))
    .andThen((card) => {
      const rate = card.commissions[0]?.money.rate;
      if (rate === undefined) return err("shape");

      return ok({ "rubPerUsd.multitransfer": rate });
    });

export const multitransfer: Provider = {
  name: "multitransfer",
  ids: ["rubPerUsd.multitransfer"],
  fetch: () => {
    // a missing session id is answered with 400, so do not spend the request
    if (!env.session) return errAsync("session");

    return request(
      "multitransfer",
      api.post(url, {
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
      })
    ).andThen((res) => {
      // the antifraud answers with its own status, so the session id is
      // distinguishable from an endpoint that is simply down
      if (res.status === sessionRejected) return errAsync("session" as const);
      if (!res.ok) return errAsync("unavailable" as const);

      return body("multitransfer", res)
        .andThen(parse)
        .map((rates) => ({ rates }));
    });
  },
};
