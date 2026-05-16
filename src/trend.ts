import { currencySymbols, formatRate, isPositiveRate } from "./helpers";

export type RateKey =
  | "koronaRateGEL"
  | "koronaRateUSD"
  | "CBRRateUSD"
  | "CBRRateGEL";

export type RateSnapshot = Record<RateKey, number> & {
  updatedDate: number;
};

export type RateHistoryPoint = {
  key: RateKey;
  value: number;
  updatedDate: number;
};

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const trendPeriod = day;
const currentWindow = hour;
const previousWindow = hour;
const historyMaxAge = 8 * day;
const flatThreshold = 0.05;

const minWeeklyPoints = 24;

type Average = {
  value: number;
  updatedDate: number;
};

const average = (points: RateHistoryPoint[]) => {
  if (points.length === 0) return null;

  const sum = points.reduce((total, point) => total + point.value, 0);
  const time = points.reduce((total, point) => total + point.updatedDate, 0);
  return {
    value: sum / points.length,
    updatedDate: time / points.length,
  };
};

const getPoints = (
  history: RateHistoryPoint[] | undefined,
  key: RateKey
) =>
  (history ?? [])
    .filter((point) => point.key === key && isPositiveRate(point.value))
    .sort((a, b) => a.updatedDate - b.updatedDate);

const getWindowAverage = (
  points: RateHistoryPoint[],
  start: number,
  end: number
) =>
  average(
    points.filter((point) => {
      return point.updatedDate >= start && point.updatedDate <= end;
    })
  );

const formatHours = (value: number) => {
  const hours = Math.max(1, Math.round(value / hour));
  if (hours < 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
};

const getPreviousAverage = (
  points: RateHistoryPoint[],
  asOf: number
): (Average & { label: string }) | null => {
  const previous = getWindowAverage(
    points,
    asOf - trendPeriod - previousWindow,
    asOf - trendPeriod + previousWindow
  );

  if (previous) return { ...previous, label: "24h" };

  const older = points.filter((point) => {
    return point.updatedDate < asOf - currentWindow;
  });
  const first = older[0];
  if (!first) return null;

  const fallback = getWindowAverage(
    older,
    first.updatedDate,
    first.updatedDate + currentWindow
  );
  if (!fallback) return null;

  return {
    ...fallback,
    label: formatHours(asOf - fallback.updatedDate),
  };
};

const formatSignedRub = (value: number) => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}${currencySymbols.RUB}`;
};

const formatTrend = (
  history: RateHistoryPoint[] | undefined,
  key: RateKey,
  current: number,
  asOf: number
) => {
  const points = getPoints(history, key);
  const previous = getPreviousAverage(points, asOf);
  if (!previous) return "";

  const diff = current - previous.value;
  if (Math.abs(diff) < flatThreshold) return `≈ flat over ${previous.label}`;

  const direction = diff > 0 ? "↑" : "↓";
  return `${direction} ${formatSignedRub(diff)} over ${previous.label}`;
};

const formatAverage = (
  history: RateHistoryPoint[] | undefined,
  key: RateKey,
  current: number,
  asOf: number
) => {
  const points = getPoints(history, key).filter((point) => {
    return point.updatedDate >= asOf - 7 * day && point.updatedDate <= asOf;
  });
  if (points.length < minWeeklyPoints) return "";

  const hasWeek = points.some((point) => {
    return point.updatedDate <= asOf - 7 * day + currentWindow;
  });
  if (!hasWeek) return "";

  const weekly = average(points);
  if (!weekly) return "";

  const diff = current - weekly.value;
  if (Math.abs(diff) < flatThreshold) return "near 7d avg";
  if (diff > 0) {
    return `above 7d avg by ${diff.toFixed(2)}${currencySymbols.RUB}`;
  }

  return `below 7d avg by ${Math.abs(diff).toFixed(2)}${currencySymbols.RUB}`;
};

export const pruneRateHistory = (
  history: RateHistoryPoint[],
  asOf = Date.now()
) =>
  history.filter((point) => {
    return (
      asOf - point.updatedDate <= historyMaxAge &&
      point.updatedDate <= asOf &&
      isPositiveRate(point.value)
    );
  });

export const formatRateInsights = (
  history: RateHistoryPoint[] | undefined,
  key: RateKey,
  current: number,
  asOf: number
) => {
  const fresh = history?.some((point) => {
    return (
      point.key === key &&
      point.updatedDate === asOf &&
      point.value === current &&
      isPositiveRate(point.value)
    );
  });
  if (!fresh) return "";

  return [
    formatTrend(history, key, current, asOf),
    formatAverage(history, key, current, asOf),
  ]
    .filter(Boolean)
    .join(", ");
};

export const formatRateWithInsights = (
  value: number,
  history: RateHistoryPoint[] | undefined,
  key: RateKey,
  asOf: number
) => {
  if (!isPositiveRate(value)) return formatRate(value);

  const insights = formatRateInsights(history, key, value, asOf);
  if (!insights) return `${formatRate(value)}${currencySymbols.RUB}`;

  return `${formatRate(value)}${currencySymbols.RUB} ${insights}`;
};

export const formatRateInsightsSuffix = (
  history: RateHistoryPoint[] | undefined,
  key: RateKey,
  current: number,
  asOf: number
) => {
  if (!isPositiveRate(current)) return "";

  const insights = formatRateInsights(history, key, current, asOf);
  if (!insights) return "";

  return ` (rate ${insights})`;
};
