'use client';

import * as React from 'react';
import { fitColumnWidths, measureColumnContent, singleLineCellSx, singleLineCopySx, singleLineHeaderSx } from './column-widths';
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

export function useAdaptiveColumns<T extends object>({ columns, data, visibility, density, manualSizing, text, actions = false, optionalColumn, filtering = true, sorting = false, columnActions = true }: {
  columns: readonly Column[];
  data: readonly T[];
  visibility: Record<string, boolean>;
  density: TableDensity;
  manualSizing: Record<string, number>;
  text?: (row: T, id: string) => string;
  actions?: boolean;
  optionalColumn?: string;
  filtering?: boolean;
  sorting?: boolean;
  columnActions?: boolean;
}) {
  const { mode } = useTableWidth();
  const automatic = mode === 'auto';
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [measurement, setMeasurement] = React.useState({ width: 0, font: '14px sans-serif', weight: '400', spacing: 0, rem: 16, copyPadding: 0, revision: 0 });

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
      const copyPadding = copyButton ? (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0) : window.isSecureContext ? 24 : 0;
      setMeasurement((previous) => previous.width === width && previous.font === font && previous.weight === weight && previous.spacing === spacing && previous.rem === rem && previous.copyPadding === copyPadding ? previous : { ...previous, width, font, weight, spacing, rem, copyPadding });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const fontsLoaded = () => { measure(); setMeasurement((previous) => ({ ...previous, revision: previous.revision + 1 })); };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    document.fonts?.addEventListener('loadingdone', fontsLoaded);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); document.fonts?.removeEventListener('loadingdone', fontsLoaded); };
  }, [automatic]);

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
    const contentAllowance = padding + measurement.copyPadding + 4;
    const targets = columns.flatMap((column) => {
      const id = column.id ?? column.accessorKey;
      if (!id || visibility[id] === false) return [];
      const wide = /domain|client|host|^ip$/.test(id) && id !== 'domain_group';
      const samples = data.slice(0, 80).map((row) => text ? text(row, id) : String(row[id as keyof T] ?? ''));
      let content = measureColumnContent(id, samples, measure);
      if (id === 'domain_type') content = Math.max(content, measure('AAAA'), measure('HTTPS'));
      if (id === 'ping_time') content = Math.max(content, measure('999.9 ms'));
      let floor = Math.max(80, Math.min(300, Math.ceil(content + contentAllowance)));
      switch (id) {
        case 'domain': { floor = Math.max(180, Math.min(360, Math.ceil(content + padding + 8))); break;
        }
        case 'host':
        case 'hostname': { floor = Math.max(160, Math.min(360, Math.ceil(content + padding + 8))); break;
        }
        case 'mac': { floor = Math.max(150, Math.ceil(content + contentAllowance)); break;
        }
        case 'domain_group': { floor = Math.max(110, Math.min(240, Math.ceil(content + contentAllowance + 24))); break;
        }
        case 'is_cached': { floor = Math.max(56, Math.ceil(content + contentAllowance + 16)); break;
        }
        default: {
          if (/timestamp/.test(id)) floor = Math.max(170, Math.ceil(content + contentAllowance));
          else if (/^ip$|^client$|_ip$/.test(id)) floor = Math.max(140, Math.min(220, Math.ceil(content + contentAllowance)));
        }
      }
      const controls = (filtering && column.enableColumnFilter !== false ? 20 : 0) + (sorting && column.enableSorting !== false ? 20 : 0) + (columnActions && column.enableColumnActions !== false ? 24 : 0);
      const min = Math.ceil(Math.max(column.minSize ?? 0, floor, measure(column.header, true) + padding + controls));
      const tight = id === 'is_cached' || id === 'query_time';
      const max = tight ? min : Math.max(min, column.maxSize ?? (wide ? 560 : 300));
      return [{ id, min, max, preferred: tight ? min : Math.max(min, content + contentAllowance + 16), weight: tight ? 0 : wide ? 3 : 1 }];
    });
    const actionWidth = density === 'compact' ? 72 : 90;
    if (actions && visibility['mrt-row-actions'] !== false) targets.push({ id: 'mrt-row-actions', min: actionWidth, max: actionWidth, preferred: actionWidth, weight: 0 });
    const preferred = targets.reduce((sum, column) => sum + Math.min(column.max, column.preferred), 0);
    const hiddenColumn = optionalColumn && targets.some((column) => column.id === optionalColumn) && preferred > measurement.width ? optionalColumn : undefined;
    return {
      columnSizing: fitColumnWidths(hiddenColumn ? targets.filter((column) => column.id !== hiddenColumn) : targets, measurement.width),
      columnVisibility: hiddenColumn ? { ...visibility, [hiddenColumn]: false } : visibility,
    };
  }, [automatic, columns, data, visibility, density, manualSizing, measurement, text, actions, optionalColumn, filtering, sorting, columnActions]);

  return { automatic, containerRef, ...layout, cellSx: singleLineCellSx, copySx: singleLineCopySx, headerSx: singleLineHeaderSx };
}
