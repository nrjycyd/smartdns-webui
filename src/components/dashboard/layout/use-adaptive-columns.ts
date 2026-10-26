'use client';

import * as React from 'react';
import { fitColumnWidths, singleLineCellSx, singleLineCopySx, singleLineHeaderSx } from './column-widths';
import { useTableWidth } from './table-width-provider';
import type { TableDensity } from './table-density-provider';

interface Column {
  id?: string;
  accessorKey?: string;
  header: string;
  minSize?: number;
  maxSize?: number;
}

export function useAdaptiveColumns<T extends object>({ columns, data, visibility, density, manualSizing, text, actions = false, optionalColumn }: {
  columns: readonly Column[];
  data: readonly T[];
  visibility: Record<string, boolean>;
  density: TableDensity;
  manualSizing: Record<string, number>;
  text?: (row: T, id: string) => string;
  actions?: boolean;
  optionalColumn?: string;
}) {
  const { mode } = useTableWidth();
  const automatic = mode === 'auto';
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [measurement, setMeasurement] = React.useState({ width: 0, font: '14px sans-serif', revision: 0 });

  React.useLayoutEffect(() => {
    const element = containerRef.current;
    if (!automatic || !element) return;
    let frame = 0;
    const measure = () => {
      const style = getComputedStyle(element.querySelector('td') ?? element.querySelector('th') ?? element);
      const width = Math.floor(element.clientWidth);
      const font = `${style.fontSize} ${style.fontFamily}`;
      setMeasurement((previous) => previous.width === width && previous.font === font ? previous : { ...previous, width, font });
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
      context.font = `${bold ? 600 : 400} ${measurement.font}`;
      return context.measureText(value.slice(0, 256)).width;
    };
    const padding = density === 'compact' ? 16 : density === 'comfortable' ? 32 : 48;
    const targets = columns.flatMap((column) => {
      const id = column.id ?? column.accessorKey;
      if (!id || visibility[id] === false) return [];
      const wide = /domain|client|host|^ip$/.test(id) && id !== 'domain_group';
      let content = 0;
      for (const row of data.slice(0, 80)) content = Math.max(content, measure(text ? text(row, id) : String(row[id as keyof T] ?? '')));
      let floor = Math.max(80, Math.min(300, Math.ceil(content + padding + 8)));
      switch (id) {
        case 'domain': { floor = Math.max(180, Math.min(360, Math.ceil(content + padding + 8))); break;
        }
        case 'host':
        case 'hostname': { floor = Math.max(160, Math.min(360, Math.ceil(content + padding + 8))); break;
        }
        case 'mac': { floor = Math.max(150, Math.ceil(content + padding + 8)); break;
        }
        case 'domain_group': { floor = Math.max(110, Math.min(240, Math.ceil(content + padding + 24))); break;
        }
        default: {
          if (/timestamp/.test(id)) floor = Math.max(170, Math.ceil(content + padding + 8));
          else if (/^ip$|^client$|_ip$/.test(id)) floor = Math.max(140, Math.min(330, Math.ceil(content + padding + 8)));
        }
      }
      const min = Math.ceil(Math.max(column.minSize ?? 0, floor, measure(column.header, true) + padding + 32));
      const max = Math.max(min, column.maxSize ?? (wide ? 560 : 300));
      return [{ id, min, max, preferred: Math.max(min, content + padding + 24), weight: wide ? 3 : 1 }];
    });
    const actionWidth = density === 'compact' ? 72 : 90;
    if (actions && visibility['mrt-row-actions'] !== false) targets.push({ id: 'mrt-row-actions', min: actionWidth, max: actionWidth, preferred: actionWidth, weight: 0 });
    const preferred = targets.reduce((sum, column) => sum + Math.min(column.max, column.preferred), 0);
    const hiddenColumn = optionalColumn && targets.some((column) => column.id === optionalColumn) && preferred > measurement.width ? optionalColumn : undefined;
    return {
      columnSizing: fitColumnWidths(hiddenColumn ? targets.filter((column) => column.id !== hiddenColumn) : targets, measurement.width),
      columnVisibility: hiddenColumn ? { ...visibility, [hiddenColumn]: false } : visibility,
    };
  }, [automatic, columns, data, visibility, density, manualSizing, measurement, text, actions, optionalColumn]);

  return { automatic, containerRef, ...layout, cellSx: singleLineCellSx, copySx: singleLineCopySx, headerSx: singleLineHeaderSx };
}
