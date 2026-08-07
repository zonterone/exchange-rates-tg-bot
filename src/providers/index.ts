import { avosend } from "./avosend";
import { cbr } from "./cbr";
import { kursi } from "./kursi";
import { kwikpay } from "./kwikpay";
import { multitransfer } from "./multitransfer";
import type { Provider } from "./types";
import { unired } from "./unired";

export const providers: Provider[] = [
  unired,
  multitransfer,
  avosend,
  kwikpay,
  kursi,
  cbr,
];
