'use client';

import * as React from 'react';
import { COPY_BUTTON_INLINE_PADDING, createColumnWidthTarget, fitColumnWidths, isCompactQueryLogColumn, measureColumnContent, singleLineCellSx, singleLineCopySx, singleLineHeaderSx } from './column-widths';
import type { TableColumnLayout } from './column-widths';
import { useTableWidth } from './table-width-provider';
import type { TableDensity } from './table-density-provider';

interface Column {
  id?: string;
  accessorKey?: string;
  header: string;
  minSize?: number;
  maxSize?: number;
  enableColumnFilter?: boolean;
  enableSorting?: boolean;
  enableColumnActions?: boolean;
}

function outerWidth(node: Element): number {
  const style = getComputedStyle(node);
  return Math.max(node.getBoundingClientRect().width, node.scrollWidth) + (Number.parseFloat(style.marginLeft) || 0) + (Number.parseFloat(style.marginRight) || 0);
}

export function useAdaptiveColumns<T extends object>({ layout: pageLayout, columns, data, visibility, density, manualSizing, text, referenceText, actions = false, optionalColumn, filtering = true, sorting = false, columnActions = true }: {
  layout: TableColumnLayout;
  columns: readonly Column[];
  data: readonly T[];
  visibility: Record<string, boolean>;
  density: TableDensity;
  manualSizing: Record<string, number>;
  text?: (row: T, id: string) => string;
  referenceText?: Readonly<Record<string, readonly string[]>>;
  actions?: boolean;
  optionalColumn?: string;
  filtering?: boolean;
  sorting?: boolean;
  columnActions?: boolean;
}) {
  const { mode } = useTableWidth();
  const automatic = mode === 'auto';
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [measurement, setMeasurement] = React.useState({ width: 0, font: '14px sans-serif', weight: '400', spacing: 0, rem: 16, copyPadding: 0, headerDensity: density, headers: {} as Record<string, number>, revision: 0 });


  const layout = React.useMemo(() => {
    if (!automatic || measurement.width === 0) return { columnSizing: manualSizing, columnVisibility: visibility };
    const context = document.createElement('canvas').getContext('2d');
    const measure = (value: string, bold = false) => {
      if (!context) return Math.min(value.length, 256) * 8;
      context.font = `${bold ? 600 : measurement.weight} ${measurement.font}`;
      const sample = value.slice(0, 256);
      return context.measureText(sample).width + Math.max(0, sample.length - 1) * measurement.spacing;
    };
    const padding = measurement.rem * (density === 'compact' ? 1 : density === 'comfortable' ? 2 : 3);
    const targets = columns.flatMap((column) => {
      const id = column.id ?? column.accessorKey;
      if (!id || visibility[id] === false) return [];
      const cellPadding = pageLayout === 'query-log' && isCompactQueryLogColumn(id) ? padding / 2 : padding;
      const contentAllowance = cellPadding + measurement.copyPadding + 4;
      const samples = referenceText?.[id] ?? data.slice(0, 80).map((row) => text ? text(row, id) : String(row[id as keyof T] ?? ''));
      let content = measureColumnContent(id, samples, measure, pageLayout !== 'query-log' || referenceText?.[id] !== undefined);
      if (id === 'domain_type') content = Math.max(content, measure('AAAA'), measure('HTTPS'));
      if (id === 'ping_time') content = Math.max(content, measure('999.9 ms'));
      let floor = Math.max(80, Math.min(300, Math.ceil(content + contentAllowance)));
      switch (id) {
        case 'domain': { floor = pageLayout === 'query-log' ? 180 : Math.max(180, Math.min(360, Math.ceil(content + padding + 8))); break;
        }
        case 'host':
        case 'hostname': { floor = Math.max(160, Math.min(pageLayout === 'upstream-servers' ? 280 : 320, Math.ceil(content + contentAllowance))); break;
        }
        case 'mac': { floor = Math.max(150, Math.ceil(content + contentAllowance)); break;
        }
        case 'domain_group': { floor = Math.max(110, Math.min(240, Math.ceil(content + contentAllowance + 24))); break;
        }
        case 'is_cached': { floor = Math.max(56, Math.ceil(content + contentAllowance + 16)); break;
        }
        default: {
          if (/timestamp/.test(id)) {
            const timeReserve = pageLayout === 'query-log' ? measurement.rem : 0;
            const timeMinimum = pageLayout === 'query-log' ? 220 * measurement.rem / 16 : 170;
            floor = Math.max(timeMinimum, Math.ceil(content + contentAllowance + timeReserve));
          }
          else if (/^ip$|^client$|_ip$/.test(id)) {
            const limit = pageLayout === 'query-log' && referenceText?.[id] ? Number.POSITIVE_INFINITY : pageLayout === 'query-log' ? 220 : pageLayout === 'clients' ? 440 : 320;
            const compactClient = pageLayout === 'query-log' && id === 'client';
            const allowance = compactClient ? padding / 2 + 4 : contentAllowance;
            floor = Math.max(compactClient ? 80 : 140, Math.min(limit, Math.ceil(content + allowance)));
          }
        }
      }
      const controls = (filtering && column.enableColumnFilter !== false ? 20 : 0) + (sorting && column.enableSorting !== false ? 20 : 0) + (columnActions && column.enableColumnActions !== false ? 24 : 0);
      const min = Math.ceil(Math.max(column.minSize ?? 0, floor, measurement.headers[column.header] ?? (measure(column.header, true) + cellPadding + controls)));
      return [createColumnWidthTarget(pageLayout, id, min, pageLayout === 'query-log' && id === 'domain' ? 360 : content + contentAllowance + 16, column.maxSize)];
    });
    const actionWidth = density === 'compact' ? 72 : 90;
    if (actions && visibility['mrt-row-actions'] !== false) targets.push({ id: 'mrt-row-actions', min: actionWidth, max: actionWidth, preferred: actionWidth, weight: 0 });
    const preferred = targets.reduce((sum, column) => sum + Math.min(column.max, column.preferred), 0);
    const hiddenColumn = optionalColumn && targets.some((column) => column.id === optionalColumn) && preferred > measurement.width ? optionalColumn : undefined;
    return {
      columnSizing: fitColumnWidths(hiddenColumn ? targets.filter((column) => column.id !== hiddenColumn) : targets, measurement.width),
      columnVisibility: hiddenColumn ? { ...visibility, [hiddenColumn]: false } : visibility,
    };
  }, [automatic, pageLayout, columns, data, visibility, density, manualSizing, measurement, text, referenceText, actions, optionalColumn, filtering, sorting, columnActions]);

  React.useLayoutEffect(() => {
    const element = containerRef.current;
    if (!automatic || !element) return;
    let frame = 0;
    const measure = () => {
      const copyButton = element.querySelector('tbody td .MuiButton-root');
      const style = getComputedStyle(copyButton ?? element.querySelector('td') ?? element.querySelector('th') ?? element);
      const width = Math.floor(element.clientWidth);
      const font = `${style.fontSize} ${style.fontFamily}`;
      const weight = style.fontWeight;
      const spacing = Number.parseFloat(style.letterSpacing) || 0;
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const copyPadding = copyButton ? (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0) : window.isSecureContext ? COPY_BUTTON_INLINE_PADDING * 2 : 0;
      const context = document.createElement('canvas').getContext('2d');
      const headers: Record<string, number> = {};
      for (const th of element.querySelectorAll('thead th')) {
        const wrapper = th.querySelector('.Mui-TableHeadCell-Content-Wrapper');
        if (!wrapper?.textContent || !context) continue;
        const headerStyle = getComputedStyle(wrapper);
        const cellStyle = getComputedStyle(th);
        context.font = `${headerStyle.fontWeight} ${headerStyle.fontSize} ${headerStyle.fontFamily}`;
        const title = wrapper.textContent;
        const spacing = Number.parseFloat(headerStyle.letterSpacing) || 0;
        const controls = [...(wrapper.parentElement?.children ?? [])].filter((child) => child !== wrapper).reduce((sum, child) => sum + outerWidth(child), 0);
        const actions = th.querySelector('.Mui-TableHeadCell-Content-Actions');
        headers[title] = Math.ceil(context.measureText(title).width + Math.max(0, title.length - 1) * spacing + controls + (actions ? outerWidth(actions) : 0) + (Number.parseFloat(cellStyle.paddingLeft) || 0) + (Number.parseFloat(cellStyle.paddingRight) || 0) + 8);
      }
      setMeasurement((previous) => {
        // Clipped or temporarily hidden controls must not shrink a measured header.
        const nextHeaders = previous.headerDensity === density && previous.rem === rem ? { ...previous.headers } : {};
        for (const [title, width] of Object.entries(headers)) nextHeaders[title] = Math.max(nextHeaders[title] ?? 0, width);
        // An empty/loading body must not temporarily replace body metrics with header typography.
        const body = data.length > 0 ? { font, weight, spacing, copyPadding } : { font: previous.font, weight: previous.weight, spacing: previous.spacing, copyPadding: previous.copyPadding };
        if (previous.width === width && previous.font === body.font && previous.weight === body.weight && previous.spacing === body.spacing && previous.rem === rem && previous.copyPadding === body.copyPadding && previous.headerDensity === density && JSON.stringify(previous.headers) === JSON.stringify(nextHeaders)) return previous;
        return { ...previous, width, ...body, rem, headerDensity: density, headers: nextHeaders };
      });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const fontsLoaded = () => { measure(); setMeasurement((previous) => ({ ...previous, revision: previous.revision + 1 })); };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    document.fonts?.addEventListener('loadingdone', fontsLoaded);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); document.fonts?.removeEventListener('loadingdone', fontsLoaded); };
  }, [automatic, columns, density, layout.columnVisibility, data.length]);

  return { automatic, containerRef, ...layout, cellSx: singleLineCellSx, copySx: singleLineCopySx, headerSx: singleLineHeaderSx };
}
