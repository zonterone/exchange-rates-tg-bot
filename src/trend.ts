import { isMatching, P } from "ts-pattern";
import { isRateId, isValidRate, type HistoryPoint, type RateId } from "./rates";

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const week = 7 * day;

// how far around "24 hours ago" we look for points to average
const window = hour;
const historyMaxAge = 8 * day;
// days of the week that have to carry a quote before the week is worth reading,
// and how far back one of them has to sit
const minWeekDays = 5;

const pointsOf = (history: HistoryPoint[], id: RateId) =>
  history.filter((point) => point.key === id);

const average = (values: number[]) => {
  if (values.length === 0) return null;

  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
};

// the stored history is a boundary like a provider response: whether a point
// still has the shape of one is a pattern, not a chain of typeof checks
const isPoint = isMatching({
  key: P.when(isRateId),
  value: P.number,
  updatedDate: P.number,
});

export const pruneHistory = (
  history: unknown,
  asOf: number
): HistoryPoint[] => {
  if (!Array.isArray(history)) return [];

  const points: unknown[] = history;
  return points.flatMap((point) =>
    isPoint(point) &&
    isValidRate(point.key, point.value) &&
    point.updatedDate <= asOf &&
    asOf - point.updatedDate <= historyMaxAge
      ? [point]
      : []
  );
};

export const dayDelta = (
  history: HistoryPoint[],
  id: RateId,
  current: number,
  asOf: number
) => {
  const previous = average(
    pointsOf(history, id)
      .filter((point) => {
        return (
          point.updatedDate >= asOf - day - window &&
          point.updatedDate <= asOf - day + window
        );
      })
      .map((point) => point.value)
  );
  if (previous === null) return null;

  return current - previous;
};

// how far the rate sits from the week behind it: measured against the weekly
// average rather than a single point seven days back, so one outlier cannot
// invent a move the week never made. The week is averaged a day at a time —
// a source that flaps leaves whole stretches of history empty, and a plain
// mean would then weigh the hours it answered in against the days it did not
export const weekDelta = (
  history: HistoryPoint[],
  id: RateId,
  current: number,
  asOf: number
) => {
  const points = pointsOf(history, id);
  const daily = Array.from({ length: week / day }, (_, index) =>
    average(
      points
        .filter((point) => {
          const age = asOf - point.updatedDate;
          return age >= index * day && age < (index + 1) * day;
        })
        .map((point) => point.value)
    )
  ).flatMap((value, index) => (value === null ? [] : [{ index, value }]));

  if (daily.length < minWeekDays) return null;
  // an average over the last few days is not a weekly average
  if (!daily.some((point) => point.index >= minWeekDays)) return null;

  const weekly =
    daily.reduce((total, point) => total + point.value, 0) / daily.length;

  return current - weekly;
};
