import { match, P } from "ts-pattern";

import {
  feeModeOf,
  providerOf,
  unitOf,
  type Fee,
  type RateId,
  type Snapshot,
  type Unit,
} from "./rates";
import { dayDelta, weekDelta } from "./trend";

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

// a fee belongs to the source, so it is the row of the rate that source quotes
// which carries it
export const feeOf = (snapshot: Snapshot, id: RateId) => {
  const fee = snapshot.fees[providerOf[id]];
  if (!fee || (fee.fix === 0 && fee.percent === 0)) return null;

  return fee;
};

export const feeText = (fee: Fee) =>
  [fee.fix > 0 ? `${fee.fix}${rub}` : "", fee.percent > 0 ? `${fee.percent}%` : ""]
    .filter(Boolean)
    .join(" + ");

// what the card chip says, and what decides whether a text row is marked at
// all: a fee on top is still to be paid, a fee in the rate is already counted
export const feeChip = (snapshot: Snapshot, id: RateId) => {
  const fee = feeOf(snapshot, id);
  if (!fee) return null;

  return match(feeModeOf[providerOf[id]])
    .with("none", () => null)
    .with("onTop", () => `fee ${feeText(fee)}`)
    .with("inRate", () => `incl ${feeText(fee)}`)
    .exhaustive();
};

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

// a delta is a difference of two rates, so it is read at the precision the
// rate is quoted at — a coarser one would hide a move the rate itself shows
const signed = (id: RateId, delta: number | null) => {
  if (delta === null) return noTrend;

  const decimals = rateDecimals[unitOf(id)];
  const value = delta.toFixed(decimals);
  // a move that rounds to zero held: it loses the sign and the colour, but not
  // the cell — "—" would claim there was nothing to compare against
  if (Number(value) === 0) return (0).toFixed(decimals);

  return delta > 0 ? `+${value}` : value;
};

export const deltaCell = (snapshot: Snapshot, id: RateId) => {
  const quote = snapshot.quotes[id];
  if (!quote) return noTrend;
  if (isStale(snapshot, id)) return staleMark;

  return signed(
    id,
    dayDelta(snapshot.history, id, quote.value, snapshot.updatedDate)
  );
};

// the week is read from the same quote the day is, stale or not: how far the
// number sits from its week holds whether or not this cycle refreshed it, and
// the exp chip beside the name already says which. It is read as of the moment
// the quote is from, though — a source that stopped answering stopped adding
// history too, so a window ending now would measure it against days it was
// never quoted in
export const weekCell = (snapshot: Snapshot, id: RateId) => {
  const quote = snapshot.quotes[id];
  if (!quote) return noTrend;

  return signed(
    id,
    weekDelta(snapshot.history, id, quote.value, quote.updatedDate)
  );
};

// a rising rouble price is bad news, a rising lari price is good news; a cell
// with no sign at all — "n/a", "—", "old" — welcomes nothing
export const isWelcome = (id: RateId, delta: string) =>
  match(delta)
    .with(P.string.startsWith("+"), () => unitOf(id) === "gelPerUsd")
    .with(P.string.startsWith("-"), () => unitOf(id) !== "gelPerUsd")
    .otherwise(() => null);
