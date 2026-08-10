import {
  amount,
  averageCell,
  deltaCell,
  feeChip,
  feeOf,
  feeText,
  formatSum,
  freshValueOf,
  gel,
  group,
  isStale,
  missing,
  rateCell,
  rub,
  usd,
  valueOf,
  age,
} from "./format";
import { match } from "ts-pattern";
import { ranked, type Ranked } from "./order";
import {
  direct,
  exchanges,
  feeModeOf,
  providerOf,
  transfers,
  type Entry,
  type Snapshot,
} from "./rates";
import { render, type Row, type Table } from "./table";

export type Mode = "sendRub" | "needRubForGel" | "needRubForUsd" | "usdGel";

export const cold = "Rates are not loaded yet. Try again later.";

const feeMark = "*";

// the same profit order the card is read in; a text table differs only in
// where the reference rate sits — under the providers rather than above them,
// because a grid is read downwards and the yardstick closes the block
const transferOrder = (snapshot: Snapshot) => ranked(snapshot, transfers, "min");
const exchangeOrder = (snapshot: Snapshot) => ranked(snapshot, exchanges, "max");

const rowsOf = ({ providers, references }: Ranked) => [
  ...providers,
  ...references,
];

// every row of both legs, in the order they are shown
const sources = (snapshot: Snapshot) => [
  ...rowsOf(transferOrder(snapshot)),
  ...rowsOf(exchangeOrder(snapshot)),
];

const label = (entry: Entry, snapshot: Snapshot) =>
  feeChip(snapshot, entry.id) ? `${entry.short}${feeMark}` : entry.short;

// one line per source that charges a fee. Only a fee billed on top can be
// missing from the numbers above, so only it takes the suffix — a folded one
// says so instead, or a reader would subtract it a second time by hand
const feeNote = (snapshot: Snapshot, suffix: string) =>
  transferOrder(snapshot).providers.flatMap((entry) => {
    const fee = feeOf(snapshot, entry.id);
    if (!fee) return [];

    return match(feeModeOf[providerOf[entry.id]])
      .with("none", () => [])
      .with("onTop", () => [
        `${feeMark} ${entry.short} fee ${feeText(fee)}${suffix}`,
      ])
      .with("inRate", () => [
        `${feeMark} ${entry.short} fee ${feeText(fee)} (included in rate)`,
      ])
      .exhaustive();
  });

// why a rate is missing or old; no failure at all means the source answered
// but had nothing for this particular rate
const noteOf = (snapshot: Snapshot, entry: Entry) => {
  const quote = snapshot.quotes[entry.id];
  const failure = snapshot.failures[providerOf[entry.id]];

  if (!quote) {
    return match(failure)
      .with("session", () => "no data (no antifraud session)")
      .with("unavailable", () => "no data (provider unavailable)")
      .with("shape", () => "no data (source changed shape)")
      .with(undefined, () => "no data")
      .exhaustive();
  }
  if (!isStale(snapshot, entry.id)) return null;

  const from = `rate from ${age(snapshot.updatedDate - quote.updatedDate)} ago`;
  return match(failure)
    .with("session", () => `no antifraud session, ${from}`)
    .with("unavailable", () => `provider unavailable, ${from}`)
    .with("shape", () => `source changed shape, ${from}`)
    .with(undefined, () => from)
    .exhaustive();
};

// one line per source and reason: a dead kursi takes down four rates at once
const notes = (snapshot: Snapshot, entries: Entry[]) => {
  const grouped = new Map<string, { note: string; labels: string[] }>();

  entries.forEach((entry) => {
    const note = noteOf(snapshot, entry);
    if (!note) return;

    const key = `${providerOf[entry.id]}|${note}`;
    const found = grouped.get(key);
    if (!found) {
      grouped.set(key, { note, labels: [entry.short] });
      return;
    }
    if (!found.labels.includes(entry.short)) found.labels.push(entry.short);
  });

  return [...grouped.values()].map(
    ({ note, labels }) => `${labels.join(", ")} — ${note}`
  );
};

type Candidate = { label: string; value: number };

const bestOf = (candidates: Candidate[], direction: "min" | "max") => {
  const [first, ...rest] = candidates;
  if (!first) return null;

  const better = match(direction)
    .with("min", () => (value: number, best: number) => value < best)
    .with("max", () => (value: number, best: number) => value > best)
    .exhaustive();

  return rest.reduce(
    (best, candidate) =>
      better(candidate.value, best.value) ? candidate : best,
    first
  );
};

// only fresh rates can win — a carried over value is not something to act on
const chainCandidates = (
  snapshot: Snapshot,
  convert: (chain: number) => number
) =>
  transferOrder(snapshot).providers.flatMap((transfer) => {
    const rubPerUsd = freshValueOf(snapshot, transfer.id);
    if (rubPerUsd === undefined) return [];

    return exchangeOrder(snapshot).providers.flatMap((exchange) => {
      const gelPerUsd = freshValueOf(snapshot, exchange.id);
      if (gelPerUsd === undefined) return [];

      return [
        {
          label: `${transfer.short} → ${exchange.short}`,
          value: convert(rubPerUsd / gelPerUsd),
        },
      ];
    });
  });

const legCandidates = (
  snapshot: Snapshot,
  entries: Entry[],
  convert: (rate: number) => number
) =>
  entries.flatMap((entry) => {
    const rate = freshValueOf(snapshot, entry.id);
    if (rate === undefined) return [];

    return [{ label: entry.short, value: convert(rate) }];
  });

const bestLine = (
  candidates: Candidate[],
  direction: "min" | "max",
  format: (value: number) => string
) => {
  const best = bestOf(candidates, direction);
  if (!best) return [];

  return [`Best: ${best.label} — ${format(best.value)}`];
};

// the direct rate skips the dollar, so it belongs next to the chain, not in it
const directLine = (snapshot: Snapshot) => {
  const rate = valueOf(snapshot, direct.id);
  if (rate === undefined) return [];

  return [`${direct.short} direct — ${amount(rate)}${rub} per 1${gel}`];
};

const chainRow = (
  snapshot: Snapshot,
  transfer: Entry,
  convert: (chain: number) => number
): Row => ({
  label: label(transfer, snapshot),
  cells: exchangeOrder(snapshot).providers.map((exchange) => {
    const rubPerUsd = valueOf(snapshot, transfer.id);
    const gelPerUsd = valueOf(snapshot, exchange.id);
    if (rubPerUsd === undefined || gelPerUsd === undefined) return missing;

    return amount(convert(rubPerUsd / gelPerUsd));
  }),
});

const legRow = (
  snapshot: Snapshot,
  entry: Entry,
  convert: (rate: number) => number
): Row => {
  const rate = valueOf(snapshot, entry.id);

  return {
    label: label(entry, snapshot),
    cells: [rate === undefined ? missing : amount(convert(rate))],
  };
};

// every message ends the same way, whether it carries a card or a table
const footer = (snapshot: Snapshot, now: number) => {
  const passed = now - snapshot.updatedDate;
  const updated =
    passed < 60000 ? "Updated just now" : `Updated ${age(passed)} ago`;

  return ["", updated, "Rates are usually updated every 30 minutes"];
};

// a message never opens with the blank line that separates its footer
const message = (parts: (string | string[])[]) =>
  parts.flat().join("\n").replace(/^\n+/, "");

// the card itself carries no timestamp, so freshness lives in its caption
export const ratesCaption = (snapshot: Snapshot, now = Date.now()) =>
  message([
    notes(snapshot, [...sources(snapshot), direct]),
    footer(snapshot, now),
    "",
    "Send me a sum to calculate",
  ]);

export const ratesMessage = (snapshot: Snapshot, now = Date.now()) => {
  const transferRank = transferOrder(snapshot);
  const exchangeRank = exchangeOrder(snapshot);

  const trendRow = (entry: Entry): Row => ({
    label: label(entry, snapshot),
    cells: [
      rateCell(snapshot, entry.id),
      deltaCell(snapshot, entry.id),
      averageCell(snapshot, entry.id),
    ],
  });

  const tables: Table[] = [
    {
      title: `${rub} → ${usd}  ${rub}/1${usd} · lower better`,
      headers: ["now", "24h", "7d"],
      rows: rowsOf(transferRank).map(trendRow),
    },
    {
      title: `${usd} → ${gel}  ${gel}/1${usd} · higher better`,
      headers: ["now", "24h", "7d"],
      rows: rowsOf(exchangeRank).map(trendRow),
    },
    {
      title: `${rub} → ${gel}  ${rub}/1${gel} · via ${usd} · lower better`,
      headers: exchangeRank.providers.map((exchange) => exchange.short),
      rows: transferRank.providers.map((transfer) => {
        return chainRow(snapshot, transfer, (chain) => chain);
      }),
    },
  ];

  return message([
    `<pre>${render(tables)}</pre>`,
    feeNote(snapshot, ""),
    notes(snapshot, [...sources(snapshot), direct]),
    directLine(snapshot),
    bestLine(
      chainCandidates(snapshot, (chain) => chain),
      "min",
      (value) => `${amount(value)}${rub} per 1${gel}`
    ),
    footer(snapshot, now),
    "",
    "Send me a sum to calculate",
  ]);
};

// every mode-dependent choice is made here, so a new mode breaks the build
const modeMessage = (
  mode: Mode,
  sum: number,
  snapshot: Snapshot
): {
  header: string;
  tables: Table[];
  captions: string[];
  shown: Entry[];
  fee: string[];
  best: string[];
} => {
  const transferRank = transferOrder(snapshot);
  const exchangeRank = exchangeOrder(snapshot);
  const columns = exchangeRank.providers.map((exchange) => exchange.short);

  return match(mode)
    .with("sendRub", () => ({
      header: `Send ${formatSum(sum)}${rub}`,
      tables: [
        {
          title: `get ${usd}`,
          headers: [],
          rows: transferRank.providers.map((transfer) => {
            return legRow(snapshot, transfer, (rate) => sum / rate);
          }),
        },
        {
          title: `get ${gel} (via ${usd})`,
          headers: columns,
          rows: transferRank.providers.map((transfer) => {
            return chainRow(snapshot, transfer, (chain) => sum / chain);
          }),
        },
      ],
      captions: [],
      shown: sources(snapshot),
      fee: feeNote(snapshot, " (not included)"),
      best: bestLine(
        chainCandidates(snapshot, (chain) => sum / chain),
        "max",
        (value) => `${group(amount(value))}${gel}`
      ),
    }))
    .with("needRubForGel", () => ({
      header: `Need ${rub} for ${formatSum(sum)}${gel}`,
      tables: [
        {
          title: `need ${rub} (via ${usd})`,
          headers: columns,
          rows: transferRank.providers.map((transfer) => {
            return chainRow(snapshot, transfer, (chain) => sum * chain);
          }),
        },
      ],
      captions: [],
      shown: sources(snapshot),
      fee: feeNote(snapshot, " (not included)"),
      best: bestLine(
        chainCandidates(snapshot, (chain) => sum * chain),
        "min",
        (value) => `${group(amount(value))}${rub}`
      ),
    }))
    .with("needRubForUsd", () => ({
      header: `Need ${rub} for ${formatSum(sum)}${usd}`,
      tables: [
        {
          title: `need ${rub}`,
          headers: [],
          rows: transferRank.providers.map((transfer) => {
            return legRow(snapshot, transfer, (rate) => sum * rate);
          }),
        },
      ],
      captions: [],
      shown: rowsOf(transferRank),
      fee: feeNote(snapshot, " (not included)"),
      best: bestLine(
        legCandidates(snapshot, transferRank.providers, (rate) => sum * rate),
        "min",
        (value) => `${group(amount(value))}${rub}`
      ),
    }))
    .with("usdGel", () => ({
      header: `${usd} ⇄ ${gel} for ${formatSum(sum)}`,
      tables: [
        {
          title: "",
          headers: [`get ${gel}`, `need ${usd}`],
          rows: exchangeRank.providers.map((exchange) => {
            const rate = valueOf(snapshot, exchange.id);
            return {
              label: exchange.short,
              cells:
                rate === undefined
                  ? [missing, missing]
                  : [amount(sum * rate), amount(sum / rate)],
            };
          }),
        },
      ],
      captions: [
        `get ${gel} — from ${formatSum(sum)}${usd}`,
        `need ${usd} — for ${formatSum(sum)}${gel}`,
      ],
      shown: rowsOf(exchangeRank),
      fee: [],
      best: bestLine(
        legCandidates(snapshot, exchangeRank.providers, (rate) => sum * rate),
        "max",
        (value) => `${group(amount(value))}${gel}`
      ),
    }))
    .exhaustive();
};

export const amountMessage = (
  mode: Mode,
  sum: number,
  snapshot: Snapshot,
  now = Date.now()
) => {
  const { header, tables, captions, shown, fee, best } = modeMessage(
    mode,
    sum,
    snapshot
  );

  return message([
    header,
    `<pre>${render(tables)}</pre>`,
    captions,
    fee,
    notes(snapshot, shown),
    best,
    footer(snapshot, now),
  ]);
};
