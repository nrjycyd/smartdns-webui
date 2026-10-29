'use client';

import * as React from 'react';
import { ClassNames, type CSSObject } from '@emotion/react';
import { alpha, darken, lighten, useTheme } from '@mui/material/styles';
import Skeleton from '@mui/material/Skeleton';
import { MRT_TableBodyCellValue, type MRT_TableInstance, type MRT_Cell, type MRT_Row, type MRT_RowData } from 'material-react-table';
import { SharedTableHints } from './shared-table-tooltip';
import { SharedCopyButton, SharedCopyHints, copyButtonStyles } from './shared-copy-button';

import { queryLogAlignment } from '@/components/dashboard/layout/query-log-layout';

// Presentation follows MRT 3's MIT-licensed row/cell styles. Compile each column's
// identical styles once, rather than resolving MUI sx separately for every cell.
const overlay = { content: '""', height: '100%', left: 0, position: 'absolute', top: 0, width: '100%', zIndex: -1 } as const;

function LoadingCell<TData extends MRT_RowData>({ cell }: { cell: MRT_Cell<TData> }): React.JSX.Element {
  const [width, setWidth] = React.useState(100);
  const { column } = cell;
  React.useEffect(() => {
    const size = column.getSize();
    const measured = column.columnDef.columnDefType === 'display' ? size / 2 : Math.round(Math.random() * (size - size / 3) + size / 3);
    setWidth(previous => previous === 100 ? measured : previous);
  }, [column]);
  return <Skeleton animation="wave" height={20} width={width} />;
}

function TableRowContent<TData extends MRT_RowData>({ row, rowIndex, table, rowClass, cellClasses, actionId, outline, copyClass, loading }: {
  row: MRT_Row<TData>; rowIndex: number; table: MRT_TableInstance<TData>; rowClass: string; cellClasses: string; actionId?: string; outline: string; copyClass: string; loading: boolean;
}) {
  const classes = cellClasses.split(' ');
  const { actionCellRef } = table.refs;
  return <tr data-index={rowIndex} className={`MuiTableRow-root ${rowClass}`}>
    {row.getVisibleCells().map((cell, columnIndex) => {
      const args = { cell, column: cell.column, row, table };
      const all = table.options.muiTableBodyCellProps;
      const own = cell.column.columnDef.muiTableBodyCellProps;
      const props = { ...(typeof all === 'function' ? all(args) : all), ...(typeof own === 'function' ? own(args) : own) };
      const display = cell.column.columnDef.columnDefType === 'display';
      const copy = !loading && window.isSecureContext && cell.column.columnDef.enableClickToCopy !== false && !display;
      const value = loading ? <LoadingCell cell={cell} /> : <MRT_TableBodyCellValue cell={cell} table={table} staticColumnIndex={columnIndex} staticRowIndex={rowIndex} />;
      return <td key={cell.id} data-index={columnIndex} data-pinned={cell.column.getIsPinned() ? true : undefined}
        data-query-column={cell.column.id} data-query-align={queryLogAlignment(cell.column.id)}
        className={`MuiTableCell-root MuiTableCell-body MuiTableCell-sizeMedium ${classes[columnIndex]}`}
        title={props.title} style={actionId === cell.id ? { outline } : undefined}
        onContextMenu={event => { event.preventDefault(); table.setActionCell(cell); actionCellRef.current = event.currentTarget; }}
      >{copy ? <SharedCopyButton className={copyClass} cell={cell} table={table}>{value}</SharedCopyButton> : value}</td>;
    })}
  </tr>;
}
const OptimizedTableRow = React.memo(TableRowContent) as typeof TableRowContent;

export function OptimizedTableBody<TData extends MRT_RowData>({ table, layout = 'query-log' }: { table: MRT_TableInstance<TData>; layout?: 'query-log' | 'clients' }): React.JSX.Element {
  const theme = useTheme();
  const state = table.getState();
  const rows = table.getRowModel().rows;
  const columns = rows[0]?.getVisibleCells().map(cell => cell.column) ?? [];
  const background = table.options.mrtTheme.baseBackgroundColor;
  const hover = alpha(theme.palette.mode === 'dark' ? lighten(background, 0.3) : darken(background, 0.3), 0.3);
  const pinnedBackground = alpha(darken(background, theme.palette.mode === 'dark' ? 0.05 : 0.01), 0.97);
  const propsFor = (cell: MRT_Cell<TData>) => {
    const args = { cell, column: cell.column, row: cell.row, table };
    const all = table.options.muiTableBodyCellProps;
    const own = cell.column.columnDef.muiTableBodyCellProps;
    return { ...(typeof all === 'function' ? all(args) : all), ...(typeof own === 'function' ? own(args) : own) };
  };
  return <SharedTableHints><SharedCopyHints><ClassNames>{({ css }) => {
    const rowClass = css({ color: 'inherit', verticalAlign: 'middle', outline: 0, backgroundColor: `${background} !important`, boxSizing: 'border-box', display: 'flex', opacity: 1, position: 'relative', transition: 'all 150ms ease-in-out', width: '100%', zIndex: 0, '&:hover td:after': { backgroundColor: hover, ...overlay } });
    const classes = columns.map((column, index) => {
      const cell = rows[0]?.getVisibleCells()[index];
      const props = cell ? propsFor(cell) : {};
      const display = column.columnDef.columnDefType === 'display';
      const pin = column.getIsPinned();
      const variable = column.id.replaceAll(/[^a-zA-Z0-9]/g, '_');
      const resizing = state.columnSizingInfo.isResizingColumn === column.id;
      const shadow = pin === 'left' && column.getIsLastColumn(pin) ? `-4px 0 4px -4px ${alpha(theme.palette.grey[700], 0.5)} inset` : pin === 'right' && column.getIsFirstColumn(pin) ? `4px 0 4px -4px ${alpha(theme.palette.grey[700], 0.5)} inset` : undefined;
      const padding = state.density === 'compact' ? display ? '0 0.5rem' : '0.5rem' : state.density === 'comfortable' ? display ? '0.5rem 0.75rem' : '1rem' : display ? '1rem 1.25rem' : '1.5rem';
      const sx = theme.unstable_sx(props.sx ?? {}) as CSSObject;
      return css({
        ...theme.typography.body2 as CSSObject,
        verticalAlign: 'inherit', textAlign: 'left', borderBottom: 'var(--TableCell-borderWidth, 1px) solid var(--mui-palette-TableCell-border)', color: (theme.vars ?? theme).palette.text.primary,
        alignItems: 'center', cursor: 'context-menu', outlineOffset: '-1px', overflow: 'hidden', padding,
        textOverflow: display ? undefined : 'ellipsis', whiteSpace: state.density === 'compact' ? 'nowrap' : 'normal',
        backgroundColor: 'inherit', backgroundImage: 'inherit', display: 'flex', justifyContent: props.align,
        opacity: pin ? 0.97 : 1, position: pin ? 'sticky' : 'relative', transition: 'padding 150ms ease-in-out',
        zIndex: resizing ? 2 : pin ? 1 : 0, left: pin === 'left' ? column.getStart('left') : undefined, right: pin === 'right' ? column.getAfter('right') : undefined,
        '&:focus-visible': { outline: `2px solid ${table.options.mrtTheme.cellNavigationOutlineColor}`, outlineOffset: '-2px' },
        '&:hover': { textOverflow: 'clip' },
        ...(pin ? { '&:before': { backgroundColor: pinnedBackground, boxShadow: shadow, ...overlay } } : {}),
        minWidth: `max(calc(var(--col-${variable}-size) * 1px), ${column.columnDef.minSize ?? 30}px)`, width: `calc(var(--col-${variable}-size) * 1px)`, flex: `${Number(column.columnDef.grow || 0)} 0 auto`,
        ...sx,
        ...(resizing ? { [table.options.columnResizeDirection === 'ltr' ? 'borderRight' : 'borderLeft']: `${table.options.columnResizeMode === 'onChange' ? '2px solid' : '2px dashed'} ${table.options.mrtTheme.draggingBorderColor} !important` } : {}),
      });
    });
    const copyClass = css(copyButtonStyles(theme, layout === 'query-log') as CSSObject);
    return <>{rows.map((row, rowIndex) => <OptimizedTableRow key={row.id} row={row} rowIndex={rowIndex} table={table} rowClass={rowClass} copyClass={copyClass} cellClasses={classes.join(' ')} actionId={state.actionCell?.id} outline={`1px solid ${theme.palette.grey[500]}`} loading={Boolean(state.isLoading || state.showSkeletons)} />)}</>;
  }}</ClassNames></SharedCopyHints></SharedTableHints>;
}
