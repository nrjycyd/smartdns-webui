'use client';

import * as React from 'react';
import Tooltip from '@mui/material/Tooltip';
import type { MRT_ColumnDef, MRT_RowData } from 'material-react-table';

interface CopyLabels { clickToCopy: string; copiedToClipboard: string; copyFailed: string }

function TableCopyButton({ value, title, labels, children }: { value: unknown; title?: string; labels: CopyLabels; children: React.ReactNode }): React.JSX.Element {
  const [status, setStatus] = React.useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => { clearTimeout(timer.current); }, []);
  return <Tooltip disableInteractive enterDelay={1000} enterNextDelay={1000} placement="top"
    title={status === 'failed' ? labels.copyFailed : title ?? (status === 'copied' ? labels.copiedToClipboard : labels.clickToCopy)}>
    <button type="button" className="table-copy-button MuiButton-root" onClick={async event => {
      event.stopPropagation();
      try { await navigator.clipboard.writeText(String(value)); setStatus('copied'); }
      catch { setStatus('failed'); }
      clearTimeout(timer.current);
      timer.current = setTimeout(() => { setStatus('idle'); }, 4000);
    }}>{children}</button>
  </Tooltip>;
}

// Preserve raw-value copying and custom cell content without a styled Button per cell.
export function withCopyCells<T extends MRT_RowData>(columns: MRT_ColumnDef<T>[], labels: CopyLabels): MRT_ColumnDef<T>[] {
  if (!globalThis.isSecureContext) return columns;
  return columns.map(column => {
    if (column.enableClickToCopy === false) return column;
    const Cell = column.Cell;
    return { ...column, enableClickToCopy: false, Cell: props => {
      const copyProps = typeof column.muiCopyButtonProps === 'function'
        ? column.muiCopyButtonProps({ cell: props.cell, column: props.cell.column, row: props.row, table: props.table })
        : column.muiCopyButtonProps;
      return <TableCopyButton value={props.cell.getValue()} title={copyProps?.title} labels={labels}>
        {Cell ? Cell(props) : props.renderedCellValue}
      </TableCopyButton>;
    } };
  });
}
