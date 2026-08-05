import { isMatching, P } from "ts-pattern";
import { isRateId, isValidRate, type HistoryPoint, type RateId } from "./rates";

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const week = 7 * day;

// how far around "24 hours ago" we look for points to average
const window = hour;
const historyMaxAge = 8 * day;
const minWeekPoints = 24;

const pointsOf = (history: HistoryPoint[], id: RateId) =>
  history.filter((point) => point.key === id);

const average = (points: HistoryPoint[]) => {
  if (points.length === 0) return null;

  const sum = points.reduce((total, point) => total + point.value, 0);
  return sum / points.length;
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
    pointsOf(history, id).filter((point) => {
      return (
        point.updatedDate >= asOf - day - window &&
        point.updatedDate <= asOf - day + window
      );
    })
  );
  if (previous === null) return null;

  return current - previous;
};

export const weekAverage = (
  history: HistoryPoint[],
  id: RateId,
  asOf: number
) => {
  const recent = pointsOf(history, id).filter((point) => {
    return point.updatedDate >= asOf - week && point.updatedDate <= asOf;
  });
  if (recent.length < minWeekPoints) return null;

  // an average over the last few hours is not a weekly average
  const spansWeek = recent.some((point) => point.updatedDate <= asOf - 6 * day);
  if (!spansWeek) return null;

  return average(recent);
};
