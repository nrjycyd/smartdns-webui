export interface ColumnWidthTarget {
  id: string;
  min: number;
  preferred: number;
  max: number;
  weight: number;
}

export const singleLineCellSx = {
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  '& > span': { minWidth: 0, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
} as const;

export const singleLineCopySx = {
  minWidth: 0, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  '& > span': { minWidth: 0, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
} as const;

export const singleLineHeaderSx = { '& .Mui-TableHeadCell-Content-Wrapper': { whiteSpace: 'nowrap' } } as const;

export function fitColumnWidths(columns: readonly ColumnWidthTarget[], available: number): Record<string, number> {
  if (columns.length === 0) return {};
  const minimum = columns.reduce((sum, column) => sum + column.min, 0);
  const widths = columns.map((column) => Math.max(column.min, Math.min(column.max, column.preferred)));
  const preferred = widths.reduce((sum, width) => sum + width, 0);
  const budget = Math.max(minimum, Math.floor(available));

  if (budget < preferred) {
    const ratio = (budget - minimum) / (preferred - minimum);
    for (const [index, column] of columns.entries()) widths[index] = column.min + (widths[index] - column.min) * ratio;
  } else {
    let remaining = budget - preferred;
    let active = columns.map((column, index) => index).filter((index) => columns[index].weight > 0 && widths[index] < columns[index].max);
    while (remaining > 0.01 && active.length > 0) {
      const weight = active.reduce((sum, index) => sum + columns[index].weight, 0);
      let used = 0;
      for (const index of active) {
        const extra = Math.min(columns[index].max - widths[index], remaining * columns[index].weight / weight);
        widths[index] += extra;
        used += extra;
      }
      remaining -= used;
      active = active.filter((index) => widths[index] < columns[index].max - 0.01);
    }
  }

  const rounded = widths.map((width) => Math.floor(width));
  let remainder = Math.min(budget, Math.round(widths.reduce((sum, width) => sum + width, 0))) - rounded.reduce((sum, width) => sum + width, 0);
  const order = columns.map((_, index) => index).toSorted((a, b) => (widths[b] - rounded[b]) - (widths[a] - rounded[a]));
  for (const index of order) {
    if (remainder > 0 && rounded[index] < columns[index].max) { rounded[index]++; remainder--; }
  }
  return Object.fromEntries(columns.map((column, index) => [column.id, rounded[index]]));
}
