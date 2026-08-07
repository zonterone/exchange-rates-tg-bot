import { Result, err, ok } from "neverthrow";
import { z } from "zod";
import { isValidFee, round } from "../rates";
import { fromZod } from "../result";
import type { Payload, Provider } from "./types";
import { api, body, request, userAgent } from "./types";

const origin = "https://kwikpay.ru";
const url = `${origin}/`;

// the calculator is a livewire component, so the rate lives behind a signed
// snapshot the page hands out: the checksum on it is the server's, which is
// what keeps the snapshot and the endpoint that updates it from being written
// out here as literals
const uriPattern = /"uri":"([^"]+)"/;
const snapshotPattern = /wire:snapshot="([^"]+)"/g;
const component = "online-calculator";

// the calculator quotes nothing outside its limits — a dollar or five thousand
// come back with no fee at all — and the rate itself does not move with the
// amount, so any sum in the middle buys the same number
const amount = "100";

const call = (method: string) => ({ method, params: [], metadata: {} });

const unescape = (value: string) =>
  value.replaceAll("&quot;", '"').replaceAll("&amp;", "&");

// the page carries a snapshot per livewire component and the calculator names
// itself inside its own memo — that name is the only stable way to tell it
// from the transfer status widget and the feedback form beside it
export const bootstrap = (
  html: string
): Result<{ uri: string; snapshot: string }, "shape"> => {
  const uri = html.match(uriPattern)?.[1]?.replaceAll("\\/", "/");
  const snapshot = [...html.matchAll(snapshotPattern)]
    .map(([, value]) => unescape(value ?? ""))
    .find((value) => value.includes(`"${component}"`));

  if (!uri || !snapshot) return err("shape");

  return ok({ uri, snapshot });
};

const answer = z.object({
  components: z.array(z.object({ snapshot: z.string() })),
});

// every update answers with the component's next snapshot, and the amount can
// only be set against the one the update before it produced
const next = (raw: unknown): Result<string, "shape"> =>
  fromZod(answer.safeParse(raw)).andThen((data) => {
    const snapshot = data.components[0]?.snapshot;
    if (snapshot === undefined) return err("shape" as const);

    return ok(snapshot);
  });

const parseJson = Result.fromThrowable(JSON.parse, () => "shape" as const);

// the calculated state comes back as json inside the snapshot string, and the
// list ends with livewire's own type marker rather than an offer
const calculated = z.object({
  data: z.object({ fee: z.array(z.unknown()) }),
});

const offer = z.object({
  acceptedAmount: z.coerce.number().positive(),
  acceptedTransferAmount: z.coerce.number().positive(),
  acceptedTotalFee: z.coerce.number().nonnegative(),
  withdrawAmount: z.coerce.number().positive(),
});

export const parse = (raw: unknown): Result<Payload, "shape"> =>
  next(raw)
    .andThen(parseJson)
    .andThen((json) => fromZod(calculated.safeParse(json)))
    .andThen((state) => fromZod(offer.safeParse(state.data.fee[0])))
    .map((quoted) => {
      // KwikPay quotes a rate its commission is not in and bills the percent
      // beside it. The commission is proportional, so it is a rate by another
      // name: the whole rouble side over the dollars paid out is what a dollar
      // costs, and the fee travels along to be shown, never to be added again
      const rate = round(quoted.acceptedAmount / quoted.withdrawAmount, 4);
      const fee = {
        fix: 0,
        percent: round(
          (quoted.acceptedTotalFee / quoted.acceptedTransferAmount) * 100,
          2
        ),
      };

      return {
        rates: { "rubPerUsd.kwikpay": rate },
        ...(isValidFee(fee) ? { fee } : {}),
      };
    });

const update = (
  uri: string,
  snapshot: string,
  updates: Record<string, string>,
  calls: ReturnType<typeof call>[]
) =>
  request(
    "kwikpay",
    api.post(uri, {
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        origin,
        referer: url,
        "user-agent": userAgent,
        "x-livewire": "1",
      },
      json: { components: [{ snapshot, updates, calls }] },
    })
  ).andThen((res) => body("kwikpay", res));

// the direction and the amount cannot travel together: the component mounts
// lazily on the first update and clears the amount while it mounts, so the sum
// is set against the snapshot that mount gives back
export const quote = (amount: string) =>
  request(
    "kwikpay",
    api.get(url, { headers: { accept: "text/html", "user-agent": userAgent } }).text()
  )
    .andThen(bootstrap)
    .andThen(({ uri, snapshot }) =>
      update(uri, snapshot, { country: "GEO", currency: "USD" }, [call("$set")])
        .andThen(next)
        .andThen((mounted) =>
          update(uri, mounted, { amount }, [call("$set"), call("calculate")])
        )
    )
    .andThen(parse);

export const kwikpay: Provider = {
  name: "kwikpay",
  ids: ["rubPerUsd.kwikpay"],
  fetch: () => quote(amount),
};
