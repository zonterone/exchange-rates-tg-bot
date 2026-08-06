import { randomUUID } from "node:crypto";
import { err, errAsync, ok } from "neverthrow";
import type { Result } from "neverthrow";
import { isMatching } from "ts-pattern";
import { z } from "zod";
import { fromZod } from "../result";
import { forget, mint, remember, stored } from "../session";
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

const quote = (id: string) =>
  request(
    "multitransfer",
    api.post(url, {
      throwHttpErrors: false,
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "ru",
        "client-id": "multitransfer-web-id",
        "content-type": "application/json",
        fhprequestid: randomUUID(),
        fhpsessionid: id,
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
    // the antifraud answers with its own status, so a rejected session id is
    // distinguishable from an endpoint that is simply down
    if (res.status === sessionRejected) return errAsync("session" as const);
    if (!res.ok) return errAsync("unavailable" as const);

    return body("multitransfer", res)
      .andThen(parse)
      .map((rates) => ({ rates }));
  });

// the cache is written here and nowhere else: an id is worth keeping once it
// has bought a rate, and worth dropping the moment the antifraud refuses it
const ask = (id: string) =>
  quote(id)
    .andTee(() => remember(id))
    .orTee((failure) => {
      if (failure === "session") forget();
    });

export const multitransfer: Provider = {
  name: "multitransfer",
  ids: ["rubPerUsd.multitransfer"],
  fetch: () => {
    const id = stored();
    // nothing proven yet, so the id this asks with is minted now — a refusal
    // then is a real one and there is nothing older to retry with
    if (!id) return mint().andThen(ask);

    return ask(id).orElse((failure) =>
      failure === "session" ? mint().andThen(ask) : errAsync(failure)
    );
  },
};
