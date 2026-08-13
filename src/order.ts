import { match } from "ts-pattern";

import { freshValueOf } from "./format";
import { isPaused, type Entry, type RateId, type Snapshot } from "./rates";

// a stale quote ranks below every fresh one: it cannot win, so it never leads
const byRate = (
  snapshot: Snapshot,
  entries: Entry[],
  direction: "min" | "max"
) =>
  [...entries].sort((left, right) => {
    const first = freshValueOf(snapshot, left.id);
    const second = freshValueOf(snapshot, right.id);

    if (first === undefined || second === undefined) {
      if (first === second) return left.label.localeCompare(right.label);
      return first === undefined ? 1 : -1;
    }
    if (first === second) return left.label.localeCompare(right.label);

    return match(direction)
      .with("min", () => first - second)
      .with("max", () => second - first)
      .exhaustive();
  });

export type Ranked = ReturnType<typeof ranked>;

// the one order every list of sources is read in, card and text table alike.
// It also decides the winner, so the highlight is always on the leading row —
// and a reference rate is handed back apart from it, because it competes for
// nothing and each renderer puts it somewhere else
export const ranked = (
  snapshot: Snapshot,
  entries: Entry[],
  direction: "min" | "max"
) => {
  // the one place a paused source drops out of the presentation, so no
  // renderer, note or best line can carry it back in on its own
  const shown = entries.filter((entry) => !isPaused(entry.id));
  const providers = byRate(
    snapshot,
    shown.filter((entry) => !entry.reference),
    direction
  );
  const [top] = providers;

  return {
    providers,
    references: shown.filter((entry) => entry.reference),
    best: (top && freshValueOf(snapshot, top.id) !== undefined
      ? top.id
      : null) as RateId | null,
  };
};
