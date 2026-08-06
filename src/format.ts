import { match, P } from "ts-pattern";

import { unitOf, type Fee, type RateId, type Snapshot, type Unit } from "./rates";
import { dayDelta, weekAverage } from "./trend";

export const rub = "₽";
export const usd = "$";
export const gel = "₾";

export const missing = "n/a";
export const noTrend = "—";
export const staleMark = "old";

// non-breaking thousands separator, used outside monospace grids only
const nbsp = " ";

const rateDecimals: Record<Unit, number> = {
  rubPerUsd: 2,
  gelPerUsd: 4,
  rubPerGel: 2,
};
const deltaDecimals: Record<Unit, number> = {
  rubPerUsd: 2,
  gelPerUsd: 3,
  rubPerGel: 2,
};

export const valueOf = (snapshot: Snapshot, id: RateId) =>
  snapshot.quotes[id]?.value;

// a quote the last cycle failed to refresh: it is carried over rather than
// dropped, so the reader has to be told it is not from this update
export const isStale = (snapshot: Snapshot, id: RateId) => {
  const quote = snapshot.quotes[id];
  return quote !== undefined && quote.updatedDate !== snapshot.updatedDate;
};

export const freshValueOf = (snapshot: Snapshot, id: RateId) => {
  const quote = snapshot.quotes[id];
  if (!quote || isStale(snapshot, id)) return undefined;

  return quote.value;
};

// avosend is the only source that charges a fee on top of its rate
export const feeId: RateId = "rubPerUsd.avosend";

export const feeOf = (snapshot: Snapshot) => {
  const fee = snapshot.fees["avosend"];
  if (!fee || (fee.fix === 0 && fee.percent === 0)) return null;

  return fee;
};

export const feeText = (fee: Fee) =>
  `${fee.fix}${rub}${fee.percent > 0 ? ` + ${fee.percent}%` : ""}`;

export const group = (value: string) => {
  const [integer = "", fraction] = value.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, nbsp);

  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
};

export const amount = (value: number) => value.toFixed(2);

export const formatSum = (value: number) =>
  group(Number.isInteger(value) ? String(value) : value.toFixed(2));

export const age = (ms: number) => {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
};

export const rateCell = (snapshot: Snapshot, id: RateId) => {
  const value = valueOf(snapshot, id);
  if (value === undefined) return missing;

  return value.toFixed(rateDecimals[unitOf(id)]);
};

export const deltaCell = (snapshot: Snapshot, id: RateId) => {
  const quote = snapshot.quotes[id];
  if (!quote) return noTrend;
  if (isStale(snapshot, id)) return staleMark;

  const delta = dayDelta(
    snapshot.history,
    id,
    quote.value,
    snapshot.updatedDate
  );
  if (delta === null) return noTrend;

  const value = delta.toFixed(deltaDecimals[unitOf(id)]);
  // a move that rounds to zero is no move: "+0.00" in red would say otherwise
  if (Number(value) === 0) return noTrend;

  return delta > 0 ? `+${value}` : value;
};

export const averageCell = (snapshot: Snapshot, id: RateId) => {
  const value = weekAverage(snapshot.history, id, snapshot.updatedDate);
  if (value === null) return noTrend;

  return value.toFixed(rateDecimals[unitOf(id)]);
};

// a rising rouble price is bad news, a rising lari price is good news; a cell
// with no sign at all — "n/a", "—", "old" — welcomes nothing
export const isWelcome = (id: RateId, delta: string) =>
  match(delta)
    .with(P.string.startsWith("+"), () => unitOf(id) === "gelPerUsd")
    .with(P.string.startsWith("-"), () => unitOf(id) !== "gelPerUsd")
    .otherwise(() => null);
