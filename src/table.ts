export type Row = { label: string; cells: string[] };

export type Table = { title: string; headers: string[]; rows: Row[] };

const minLabelWidth = 6;
const minCellWidth = 7;

// all tables of one message share the grid, so the columns line up vertically
export const render = (tables: Table[]) => {
  const labels = tables.flatMap((table) => {
    return table.rows.map((row) => row.label.length + 1);
  });
  const cells = tables.flatMap((table) => {
    return [...table.headers, ...table.rows.flatMap((row) => row.cells)].map(
      (cell) => cell.length + 1
    );
  });

  const labelWidth = Math.max(minLabelWidth, ...labels);
  const cellWidth = Math.max(minCellWidth, ...cells);

  const line = (label: string, cells: string[]) =>
    [
      label.padEnd(labelWidth),
      ...cells.map((cell) => cell.padStart(cellWidth)),
    ]
      .join("")
      .trimEnd();

  return tables
    .map((table) => {
      const title = table.title === "" ? [] : [table.title];
      const header =
        table.headers.length === 0 ? [] : [line("", table.headers)];
      const rows = table.rows.map((row) => line(row.label, row.cells));
      return [...title, ...header, ...rows].join("\n");
    })
    .join("\n\n");
};
