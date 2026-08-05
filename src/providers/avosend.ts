import { Result, err } from "neverthrow";
import { z } from "zod";
import { isValidFee, round } from "../rates";
import { fromZod } from "../result";
import type { Payload, Provider } from "./types";
import { api, request, userAgent } from "./types";

const url = "https://avosend.com/api/comission.php";

// the endpoint answers with a <script> block followed by bare JSON
const jsonPattern = /\{"fromScale"[\s\S]*\}/;

const schema = z.object({
  convertRate: z.coerce.number().positive(),
  fee: z.coerce.number().optional(),
  tariffs: z
    .array(z.object({ fix: z.coerce.number(), percent: z.coerce.number() }))
    .optional(),
});

const parseJson = Result.fromThrowable(JSON.parse, () => "shape" as const);

const toJson = (text: string): Result<unknown, "shape"> => {
  const found = text.match(jsonPattern);
  if (!found) return err("shape");

  return parseJson(found[0]);
};

export const parse = (raw: string): Result<Payload, "shape"> =>
  toJson(raw)
    .andThen((json) => fromZod(schema.safeParse(json)))
    .map((data) => {
      // convertRate is dollars per rouble, the bot speaks roubles per dollar
      const rate = round(1 / data.convertRate, 4);
      const fee = data.tariffs?.[0] ?? { fix: data.fee ?? 0, percent: 0 };

      // a zero fee is a shape that drifted, not a transfer that became free
      return {
        rates: { "rubPerUsd.avosend": rate },
        ...(isValidFee(fee) ? { fee } : {}),
      };
    });

export const avosend: Provider = {
  name: "avosend",
  ids: ["rubPerUsd.avosend"],
  fetch: () =>
    request(
      "avosend",
      api
        .post(url, {
          headers: {
            accept: "*/*",
            "bx-ajax": "true",
            "content-type": "application/x-www-form-urlencoded",
            origin: "https://avosend.com",
            referer: "https://avosend.com/en/",
            "user-agent": userAgent,
          },
          body: new URLSearchParams({
            countryCodeFrom: "ru",
            countryIdFrom: "643",
            countryCodeTo: "ge",
            countryIdTo: "268",
            currencyIdFrom: "643",
            currencyIdTo: "840",
            summSend: "1",
            direction: "to",
            toPrvId: "135512",
          }),
        })
        .text()
    ).andThen(parse),
};
