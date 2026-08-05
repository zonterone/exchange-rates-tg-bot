import { z } from "zod";
import { isValidFee, round } from "../rates";
import type { Payload, Provider } from "./types";
import { api, userAgent } from "./types";

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

const toJson = (text: string) => {
  const match = text.match(jsonPattern);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as unknown;
  } catch {
    return null;
  }
};

export const parse = (raw: string): Payload => {
  const parsed = schema.safeParse(toJson(raw));
  if (!parsed.success) return { rates: {} };

  // convertRate is dollars per rouble, the bot speaks roubles per dollar
  const rate = round(1 / parsed.data.convertRate, 4);
  const fee = parsed.data.tariffs?.[0] ?? {
    fix: parsed.data.fee ?? 0,
    percent: 0,
  };

  // a zero fee is a shape that drifted, not a transfer that became free
  return {
    rates: { "rubPerUsd.avosend": rate },
    ...(isValidFee(fee) ? { fee } : {}),
  };
};

export const avosend: Provider = {
  name: "avosend",
  ids: ["rubPerUsd.avosend"],
  fetch: async () => {
    const res = await api
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
      .text();

    return parse(res);
  },
};
