export const rateIds = [
  "rubPerUsd.unired",
  "rubPerUsd.multitransfer",
  "rubPerUsd.avosend",
  "rubPerUsd.cbr",
  "gelPerUsd.kursi",
  "gelPerUsd.bog",
  "gelPerUsd.tbc",
  "gelPerUsd.nbg",
  "rubPerGel.cbr",
] as const;

export type RateId = (typeof rateIds)[number];

export type Unit = "rubPerUsd" | "gelPerUsd" | "rubPerGel";

export const providerNames = [
  "unired",
  "multitransfer",
  "avosend",
  "kursi",
  "cbr",
] as const;

export type ProviderName = (typeof providerNames)[number];

export type Fee = { fix: number; percent: number };

export type Quote = { value: number; updatedDate: number };

export type HistoryPoint = { key: RateId; value: number; updatedDate: number };

// why a provider has no fresh rate: session — antifraud rejected our session
// id, shape — it answered, but nothing readable came out of the answer
const failures = ["session", "unavailable", "shape"] as const;

export type Failure = (typeof failures)[number];

export type Snapshot = {
  updatedDate: number;
  quotes: Partial<Record<RateId, Quote>>;
  fees: Partial<Record<ProviderName, Fee>>;
  failures: Partial<Record<ProviderName, Failure>>;
  history: HistoryPoint[];
};

// a value outside its range means the source changed shape (or we forgot to
// invert a quote) — treated as missing rather than shown as a rate
const ranges: Record<Unit, { min: number; max: number }> = {
  rubPerUsd: { min: 30, max: 300 },
  gelPerUsd: { min: 1, max: 10 },
  rubPerGel: { min: 5, max: 100 },
};

export const unitOf = (id: RateId) => id.split(".")[0] as Unit;

// bank and reference rates all arrive in the kursi.ge response
export const providerOf: Record<RateId, ProviderName> = {
  "rubPerUsd.unired": "unired",
  "rubPerUsd.multitransfer": "multitransfer",
  "rubPerUsd.avosend": "avosend",
  "rubPerUsd.cbr": "cbr",
  "gelPerUsd.kursi": "kursi",
  "gelPerUsd.bog": "kursi",
  "gelPerUsd.tbc": "kursi",
  "gelPerUsd.nbg": "kursi",
  "rubPerGel.cbr": "cbr",
};

export const isRateId = (key: unknown): key is RateId =>
  rateIds.includes(key as RateId);

export const isProviderName = (key: unknown): key is ProviderName =>
  providerNames.includes(key as ProviderName);

// anything else in the stored snapshot is not a failure we know how to explain
export const isFailure = (value: unknown): value is Failure =>
  failures.includes(value as Failure);

export const isValidRate = (id: RateId, value: unknown): value is number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;

  const range = ranges[unitOf(id)];
  return value >= range.min && value <= range.max;
};

const maxFix = 10000;

// a zero fee means the source changed shape, not that a transfer became free:
// an unusable fee is dropped so the last known one survives in the snapshot
export const isValidFee = (fee: Fee) => {
  const finite = Number.isFinite(fee.fix) && Number.isFinite(fee.percent);
  if (!finite || fee.fix < 0 || fee.percent < 0) return false;
  if (fee.fix > maxFix || fee.percent > 100) return false;

  return fee.fix > 0 || fee.percent > 0;
};

export type Entry = {
  id: RateId;
  label: string;
  short: string;
  reference?: boolean;
};

// one registry for both renderers: the card reads label, the monospace grid
// reads short, and neither can drift away from the other
export const transfers: Entry[] = [
  { id: "rubPerUsd.cbr", label: "CBR", short: "CBR", reference: true },
  { id: "rubPerUsd.unired", label: "Unired", short: "Unrd" },
  { id: "rubPerUsd.multitransfer", label: "MultiTransfer", short: "MltTr" },
  { id: "rubPerUsd.avosend", label: "Avosend", short: "Avsnd" },
];

export const exchanges: Entry[] = [
  { id: "gelPerUsd.nbg", label: "NBG", short: "NBG", reference: true },
  { id: "gelPerUsd.kursi", label: "Kursi", short: "Kursi" },
  { id: "gelPerUsd.bog", label: "Bank of Georgia", short: "BoG" },
  { id: "gelPerUsd.tbc", label: "TBC", short: "TBC" },
];

// the one ₽ → ₾ rate that needs no chain, shown against the chained ones
export const direct: Entry = {
  id: "rubPerGel.cbr",
  label: "CBR",
  short: "CBR",
  reference: true,
};

export const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
