import type { Result } from "neverthrow";
import { isMatching } from "ts-pattern";
import { z } from "zod";
import { fromZod } from "../result";
import type { Payload, Provider } from "./types";
import { api, body, request, userAgent } from "./types";

const url = "https://api.koronapay.com/transfers/tariffs";

// Georgia is paid out across a counter only — `card` is refused for this
// route. The amount is in cents, and neither the rate nor the commission (none)
// moves with it anywhere from one dollar to five thousand
const searchParams = {
  sendingCountryId: "RUS",
  sendingCurrencyId: "810",
  receivingCountryId: "GEO",
  receivingCurrencyId: "840",
  paymentMethod: "debitCard",
  receivingMethod: "cash",
  paidNotificationEnabled: "false",
  receivingAmount: "100000",
};

// a lari tariff is roubles per unit too, and its 32 ₽ sits inside the dollar
// sanity range — so the currency is read off the answer, not trusted to the query
const isUsd = isMatching({ receivingCurrency: { code: "USD" } });

const schema = z.object({ exchangeRate: z.number() });

export const parse = (raw: unknown): Result<Payload["rates"], "shape"> =>
  fromZod(z.array(z.unknown()).safeParse(raw))
    .andThen((list) => fromZod(schema.safeParse(list.find(isUsd))))
    .map((tariff) => ({ "rubPerUsd.koronapay": tariff.exchangeRate }));

export const koronapay: Provider = {
  name: "koronapay",
  ids: ["rubPerUsd.koronapay"],
  fetch: () =>
    request(
      "koronapay",
      api.get(url, {
        headers: {
          // the site pins its api version here, and every version but the
          // current one is answered with 406 — pinned, their next release would
          // read as a source that is down rather than one that changed shape
          accept: "*/*",
          origin: "https://koronapay.com",
          referer: "https://koronapay.com/",
          "user-agent": userAgent,
          "x-application": "Qpay-Web/3.0",
        },
        searchParams,
      })
    )
      .andThen((res) => body("koronapay", res))
      .andThen(parse)
      .map((rates) => ({ rates })),
};
