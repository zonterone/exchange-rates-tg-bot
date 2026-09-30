import { paused } from "../rates";
import { avosend } from "./avosend";
import { cbr } from "./cbr";
import { kursi } from "./kursi";
import { kwikpay } from "./kwikpay";
import { multitransfer } from "./multitransfer";
import type { Provider } from "./types";
import { unired } from "./unired";

// every source the bot knows, paused or not — the probe asks all of them, since
// it is what says whether a paused one is worth bringing back
export const registered: Provider[] = [
  unired,
  multitransfer,
  avosend,
  kwikpay,
  kursi,
  cbr,
];

// the cycle asks everything that is not paused: a paused source keeps its file
// and its registration here, and only `paused` in `src/rates.ts` says whether
// this half hour talks to it
export const providers = registered.filter(
  (provider) => !paused.includes(provider.name)
);
