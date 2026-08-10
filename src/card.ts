import { match } from "ts-pattern";

import {
  amount,
  averageCell,
  deltaCell,
  feeChip,
  gel,
  isStale,
  isWelcome,
  missing,
  rateCell,
  rub,
  usd,
  valueOf,
} from "./format";
import { ranked, type Ranked } from "./order";
import {
  direct,
  exchanges,
  transfers,
  type Entry,
  type RateId,
  type Snapshot,
} from "./rates";

const theme = {
  card: "#1d212b",
  text: "#e9ecf1",
  muted: "#7f8899",
  line: "#2b303b",
  good: "#4ade80",
  bad: "#f87171",
  bestBg: "rgba(74,222,128,0.16)",
  chip: "#2b303b",
  staleBg: "rgba(248,113,113,0.16)",
};

export const fontFamily = "Noto Sans Mono";

// Noto Sans Mono advances 0.6em per glyph, so every width here is arithmetic
const advance = 0.6;
// half the cap height as a share of the font size, used to centre on a row
const halfCap = 0.35;

// the same padding on every side, and the card is square by construction
const pad = 16;
// distance of each column from the right edge; the gaps between them have to
// clear the widest cell (six digits of a lari rate) plus the best-rate plate
const columnGaps = [170, 85, 0];
// telegram fits the photo to the bubble width, so what a reader sees is the
// font size relative to the card width — and here width follows the height.
// Every pixel saved on the vertical rhythm makes the whole card read bigger
const nameSize = 17;
const rateSize = 19;
const trendSize = 16;
const titleSize = 19;
const hintSize = 12;
const chipSize = 11;
// air before a chip, and between two of them on the same row
const chipGap = 6;
// the best-rate plate bleeds this far past its number on either side, so the
// name column has to stop short of it and not just of the digits
const plateAir = 5;
const rowStep = 23;
const headerGap = 21;
const headerToRow = 24;
// air around a divider, counted in ink rather than baselines: above it a row
// ends on its baseline, below it the next heading only starts at its cap, so
// the two gaps look equal only when the lower one is a cap height taller
const dividerGap = 11;
const beforeDivider = dividerGap;
const afterDivider = Math.round(dividerGap + titleSize * halfCap * 2);

// the reference rate is pinned above the sorted providers: it is the yardstick
// the block is read against, so it leads the section without competing in it
const rowsOf = ({ providers, references }: Ranked) => [
  ...references,
  ...providers,
];

const width = (value: string, size: number) => value.length * size * advance;

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// the card depends on the snapshot alone, which is what makes it cacheable
export const ratesCard = (snapshot: Snapshot) => {
  const out: string[] = [];

  const transferRank = ranked(snapshot, transfers, "min");
  const exchangeRank = ranked(snapshot, exchanges, "max");
  const transferSection = rowsOf(transferRank);
  const exchangeSection = rowsOf(exchangeRank);

  // the layout is arithmetic, and the height it lands on becomes the width
  const rowY = (top: number, index: number) =>
    top + headerGap + headerToRow + index * rowStep;
  const bottomOf = (top: number, rows: number) => rowY(top, rows - 1);

  // the first ink is the cap of the section title, not its baseline
  const firstTop = Math.round(pad + titleSize * halfCap * 2);
  const firstLine =
    bottomOf(firstTop, transferSection.length) + beforeDivider;
  const secondTop = firstLine + afterDivider;
  const secondLine =
    bottomOf(secondTop, exchangeSection.length) + beforeDivider;
  const chainTop = secondLine + afterDivider;
  // the direct rate is no chain, so it takes a row of its own between the
  // heading and the matrix — same trend columns, no headings above them
  const directY = chainTop + headerToRow;
  const matrixTop = directY;
  const size =
    bottomOf(matrixTop, transferRank.providers.length) + pad;

  const cols = columnGaps.map((gap) => size - pad - gap);
  const col = (index: number) => cols[index] ?? 0;

  // one weight everywhere: size and colour carry the hierarchy on their own
  const text = (
    x: number,
    y: number,
    value: string,
    options: {
      anchor?: "start" | "middle" | "end";
      fill?: string;
      size?: number;
    } = {}
  ) => {
    const { anchor = "start", fill = theme.text, size = nameSize } = options;
    out.push(
      `<text x="${x}" y="${y}" fill="${fill}" font-family="${fontFamily}" font-size="${size}" text-anchor="${anchor}">${esc(
        value
      )}</text>`
    );
  };

  const middle = (y: number) => y - nameSize * halfCap;

  const chipWidth = (value: string) => width(value, chipSize) + 12;

  // a warning chip is the only one allowed to pull the eye
  const chip = (x: number, y: number, value: string, warn: boolean) => {
    const height = 17;
    const center = middle(y);

    out.push(
      `<rect x="${x}" y="${center - height / 2}" rx="9" ry="9" width="${chipWidth(
        value
      )}" height="${height}" fill="${warn ? theme.staleBg : theme.chip}"/>`
    );
    text(x + chipWidth(value) / 2, center + chipSize * halfCap, value, {
      anchor: "middle",
      size: chipSize,
      fill: warn ? theme.bad : theme.muted,
    });

    return x + chipWidth(value);
  };

  const plate = (right: number, y: number, value: string) => {
    const height = 21;
    const center = middle(y);

    out.push(
      `<rect x="${right - width(value, rateSize) - plateAir}" y="${
        center - height / 2
      }" rx="7" ry="7" width="${
        width(value, rateSize) + plateAir * 2
      }" height="${height}" fill="${theme.bestBg}"/>`
    );
  };

  // the heading names the direction, the table starts on its own line below
  const heading = (y: number, title: string, hint: string) => {
    text(pad, y, title, { size: titleSize });
    text(pad + width(title, titleSize) + 12, y, hint, {
      size: hintSize,
      fill: theme.muted,
    });
  };

  const columnsRow = (y: number, columns: string[]) => {
    text(pad, y, "Provider", { size: hintSize - 1, fill: theme.muted });
    columns.forEach((column, index) => {
      text(col(index), y, column, {
        anchor: "end",
        size: hintSize - 1,
        fill: theme.muted,
      });
    });
  };

  const header = (y: number, title: string, hint: string, columns: string[]) => {
    heading(y, title, hint);
    columnsRow(y + headerGap, columns);
  };

  // exp says the number is not from this update and comes first because it is
  // the only chip that changes how far the number can be trusted; direct is a
  // rate that skips the chain; fee names a cost the rate leaves out, incl one
  // it already carries
  const chipsOf = (entry: Entry) => {
    const fee = feeChip(snapshot, entry.id);

    return [
      ...(isStale(snapshot, entry.id) ? [{ text: "exp", warn: true }] : []),
      ...(entry.id === direct.id ? [{ text: "direct", warn: false }] : []),
      ...(fee ? [{ text: fee, warn: false }] : []),
    ];
  };

  // the name column ends where the row's own number begins, and a chip that
  // would cross that line is dropped rather than drawn over the rate — which
  // is why the warning is ordered first and survives the squeeze
  const label = (y: number, entry: Entry, limit: number) => {
    text(pad, y, entry.label, {
      fill: entry.reference ? theme.muted : theme.text,
    });

    chipsOf(entry).reduce((x, item) => {
      const start = x + chipGap;
      if (start + chipWidth(item.text) > limit) return x;

      return chip(start, y, item.text, item.warn);
    }, pad + width(entry.label, nameSize));
  };

  // where the row's own number starts, plate included — a chip may reach it
  // but not cross it
  const roomFor = (value: string) =>
    col(0) - width(value, rateSize) - plateAir;

  const rateRow = (y: number, entry: Entry, best: RateId | null) => {
    const fill = entry.reference ? theme.muted : theme.text;
    const rate = rateCell(snapshot, entry.id);
    label(y, entry, roomFor(rate));

    const isBest = entry.id === best;
    if (isBest) plate(col(0), y, rate);

    text(col(0), y, rate, {
      anchor: "end",
      size: rateSize,
      fill: isBest ? theme.good : fill,
    });

    const delta = deltaCell(snapshot, entry.id);
    // a reference rate is nobody's news, so its move stays grey
    const welcome = entry.reference ? null : isWelcome(entry.id, delta);
    text(col(1), y, delta, {
      anchor: "end",
      size: trendSize,
      fill: match(welcome)
        .with(null, () => theme.muted)
        .with(true, () => theme.good)
        .with(false, () => theme.bad)
        .exhaustive(),
    });
    text(col(2), y, averageCell(snapshot, entry.id), {
      anchor: "end",
      size: trendSize,
      fill: theme.muted,
    });
  };

  const chainRow = (
    y: number,
    entry: Entry,
    columns: Entry[],
    best: { transfer: RateId | null; exchange: RateId | null }
  ) => {
    const cells = columns.map((column) => {
      const rubPerUsd = valueOf(snapshot, entry.id);
      const gelPerUsd = valueOf(snapshot, column.id);

      return rubPerUsd === undefined || gelPerUsd === undefined
        ? missing
        : amount(rubPerUsd / gelPerUsd);
    });

    // the leftmost cell is the one the name column can run into
    label(y, entry, roomFor(cells[0] ?? missing));

    columns.forEach((column, index) => {
      const value = cells[index] ?? missing;
      const isBest = entry.id === best.transfer && column.id === best.exchange;
      const fill = value === missing ? theme.muted : theme.text;

      if (isBest) plate(col(index), y, value);
      text(col(index), y, value, {
        anchor: "end",
        size: rateSize,
        fill: isBest ? theme.good : fill,
      });
    });
  };

  const divider = (y: number) =>
    out.push(
      `<line x1="${pad}" y1="${y}" x2="${size - pad}" y2="${y}" stroke="${theme.line}" stroke-width="1"/>`
    );

  out.push(`<rect width="${size}" height="${size}" fill="${theme.card}"/>`);

  header(firstTop, `${rub} → ${usd}`, `${rub} per 1${usd} · lower better`, [
    "Now",
    "24h",
    "7d",
  ]);
  transferSection.forEach((entry, index) =>
    rateRow(rowY(firstTop, index), entry, transferRank.best)
  );
  divider(firstLine);

  header(secondTop, `${usd} → ${gel}`, `${gel} per 1${usd} · higher better`, [
    "Now",
    "24h",
    "7d",
  ]);
  exchangeSection.forEach((entry, index) =>
    rateRow(rowY(secondTop, index), entry, exchangeRank.best)
  );
  divider(secondLine);

  heading(chainTop, `${rub} → ${gel}`, `${rub} per 1${gel} · via $ · lower better`);
  // the direct rate reads like a row of the sections above — rate, 24h, 7d —
  // and the matrix headings belong to the chained rows below it
  rateRow(directY, direct, null);
  columnsRow(
    matrixTop + headerGap,
    exchangeRank.providers.map((column) => column.short)
  );
  transferRank.providers.forEach((entry, index) =>
    chainRow(rowY(matrixTop, index), entry, exchangeRank.providers, {
      transfer: transferRank.best,
      exchange: exchangeRank.best,
    })
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
    ...out,
    "</svg>",
  ].join("\n");
};
