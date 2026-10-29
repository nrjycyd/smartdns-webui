'use client';

import * as React from 'react';
import { COPY_BUTTON_INLINE_PADDING, createColumnWidthTarget, fitColumnWidths, measureColumnContent, queryLogContentWidth, singleLineCellSx, singleLineCopySx, singleLineHeaderSx } from './column-widths';
import type { TableColumnLayout } from './column-widths';
import { useTableWidth } from './table-width-provider';
import type { TableDensity } from './table-density-provider';
import { mergeQueryLogWidths, queryLogColumnTarget, queryLogPadding } from './query-log-layout';

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

function saveMeasuredWidth(cache: Map<string, number>, key: string, width: number, limit = 128): number {
  if (cache.size >= limit) cache.clear();
  cache.set(key, width);
  return width;
}

// Content widths are reusable only under the same actual browser typography.
function typographyKey(node: Element): string {
  const style = getComputedStyle(node);
  return JSON.stringify([
    ...(['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'fontVariant', 'fontVariantNumeric', 'fontFeatureSettings', 'fontVariationSettings', 'fontOpticalSizing', 'fontKerning', 'fontVariantLigatures', 'fontSynthesis', 'letterSpacing', 'wordSpacing', 'textTransform', 'direction', 'writingMode', 'textOrientation', 'zoom', 'textRendering'] as const).map(property => style[property]),
    window.devicePixelRatio, document.fonts?.status,
  ]);
}

export function useAdaptiveColumns<T extends object>({ layout: pageLayout, columns, data, visibility, density, manualSizing, text, referenceText, actions = false, optionalColumn, filtering = true, sorting = false, columnActions = true, resetKey = '', sizingReady = true }: {
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
  resetKey?: string;
  sizingReady?: boolean;
}) {
  const { mode } = useTableWidth();
  const automatic = mode === 'auto';
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [measurement, setMeasurement] = React.useState({ width: 0, timestampWidth: 0, clientWidth: 0, numericWidths: {} as Record<string, number>, font: '14px sans-serif', weight: '400', spacing: 0, rem: 16, copyPadding: 0, headerDensity: density, sizingReady: false, headers: {} as Record<string, number>, revision: 0 });
  const [retained, setRetained] = React.useState({ key: '', widths: {} as Record<string, number> });
  const probeCache = React.useRef({ numeric: new Map<string, number>(), timestamp: new Map<string, number>() });
  const sizingKey = JSON.stringify([resetKey, density, visibility, measurement.font, measurement.weight, measurement.spacing, measurement.rem, measurement.revision]);

  const measureText = React.useMemo(() => {
    const context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
    const cache = new Map<string, number>();
    return (value: string, bold = false) => {
      if (!context) return Math.min(value.length, 256) * 8;
      const sample = value.slice(0, 256);
      const key = JSON.stringify([sample, bold, measurement.revision, automatic]);
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      context.font = `${bold ? 600 : measurement.weight} ${measurement.font}`;
      return saveMeasuredWidth(cache, key, context.measureText(sample).width + Math.max(0, sample.length - 1) * measurement.spacing, 2048);
    };
  }, [measurement.font, measurement.weight, measurement.spacing, measurement.revision, automatic]);

  const layout = React.useMemo(() => {
    if (!automatic || measurement.width === 0) return { columnSizing: manualSizing, columnVisibility: visibility, minimums: undefined };
    const measure = measureText;
    const padding = measurement.rem * (density === 'compact' ? 1 : density === 'comfortable' ? 2 : 3);
    const targets = columns.flatMap((column) => {
      const id = column.id ?? column.accessorKey;
      if (!id || visibility[id] === false) return [];
      const cellPadding = pageLayout === 'query-log' ? queryLogPadding(density, measurement.rem) * 2 : padding;
      const contentAllowance = cellPadding + measurement.copyPadding + 4 + (pageLayout === 'clients' && id === 'hostname' ? 36 : 0);
      const samples = referenceText?.[id] ?? (pageLayout === 'query-log' && id === 'query_time' ? data : data.slice(0, 80)).map((row) => text ? text(row, id) : String(row[id as keyof T] ?? ''));
      let content = measureColumnContent(id, samples, measure, pageLayout !== 'query-log' || referenceText?.[id] !== undefined);
      if (id === 'domain_type') content = Math.max(content, measure('AAAA'), measure('HTTPS'));
      if (id === 'ping_time' && pageLayout !== 'query-log') content = Math.max(content, measure('999.9 ms'));
      let floor = Math.max(80, Math.min(300, Math.ceil(content + contentAllowance)));
      if (pageLayout === 'query-log' && id !== 'domain') {
        floor = queryLogContentWidth(id, content, cellPadding, measurement.copyPadding);
        if (id === 'timestamp' && measurement.timestampWidth > 0) floor = measurement.timestampWidth;
        if (id === 'client' && measurement.clientWidth > 0) floor = Math.min(280, measurement.clientWidth);
        if (measurement.numericWidths[id] !== undefined) floor = measurement.numericWidths[id];
      } else switch (id) {
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
            floor = Math.max(170, Math.ceil(content + contentAllowance));
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
      const target = createColumnWidthTarget(pageLayout, id, min, pageLayout === 'query-log' && id === 'domain' ? 360 : content + contentAllowance + 16, column.maxSize);
      return [pageLayout === 'query-log' ? queryLogColumnTarget(target, measurement.rem, retained.key === sizingKey ? retained.widths[id] : 0) : target];
    });
    const actionWidth = pageLayout === 'query-log'
      ? Math.ceil(Math.max(48 + queryLogPadding(density, measurement.rem) * 2, measurement.headers['mrt-row-actions'] ?? 0) / 8) * 8
      : density === 'compact' ? 72 : 90;
    if (actions && visibility['mrt-row-actions'] !== false) targets.push({ id: 'mrt-row-actions', min: actionWidth, max: actionWidth, preferred: actionWidth, weight: 0 });
    const preferred = targets.reduce((sum, column) => sum + Math.min(column.max, column.preferred), 0);
    const hiddenColumn = optionalColumn && targets.some((column) => column.id === optionalColumn) && preferred > measurement.width ? optionalColumn : undefined;
    return {
      columnSizing: fitColumnWidths(hiddenColumn ? targets.filter((column) => column.id !== hiddenColumn) : targets, measurement.width),
      columnVisibility: hiddenColumn ? { ...visibility, [hiddenColumn]: false } : visibility,
      minimums: Object.fromEntries(targets.filter((target) => target.id !== 'domain').map((target) => [target.id, target.min])),
    };
  }, [automatic, pageLayout, columns, data, visibility, density, manualSizing, measurement, measureText, text, referenceText, actions, optionalColumn, filtering, sorting, columnActions, retained, sizingKey]);

  React.useLayoutEffect(() => {
    const element = containerRef.current;
    if (!automatic) {
      // Fonts can finish loading while manual widths are active and this
      // effect has no listener. Start fresh when automatic sizing resumes.
      probeCache.current.numeric.clear();
      probeCache.current.timestamp.clear();
      return;
    }
    if (!element) return;
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
      const horizontalInset = (node: HTMLElement) => {
        const nodeStyle = getComputedStyle(node);
        // Use target cell padding while the density transition is in progress.
        const inset = pageLayout === 'query-log' && node.tagName === 'TD' ? queryLogPadding(density, rem) * 2
          : (Number.parseFloat(nodeStyle.paddingLeft) || 0) + (Number.parseFloat(nodeStyle.paddingRight) || 0);
        return inset + (Number.parseFloat(nodeStyle.borderLeftWidth) || 0) + (Number.parseFloat(nodeStyle.borderRightWidth) || 0);
      };
      const numericWidths: Record<string, number> = {};
      if (pageLayout === 'query-log') {
        const probes: { id: string; key: string; node: HTMLSpanElement }[] = [];
        try {
          for (const id of ['id', 'ping_time', 'query_time', 'reply_code']) {
            const cell = element.querySelector<HTMLElement>(`tbody [data-query-column="${id}"]`);
            if (!cell) continue;
            const leaf = cell.querySelector<HTMLElement>('.MuiButton-root') ?? cell;
            const samples = id === 'ping_time' ? (referenceText?.[id] ?? ['99.9 ms'])
              : [...(referenceText?.[id] ?? []), ...data.map((row) => text ? text(row, id) : String(row[id as keyof T] ?? ''))];
            const key = JSON.stringify([typographyKey(leaf), samples]);
            const cached = probeCache.current.numeric.get(key);
            if (cached !== undefined) {
              numericWidths[id] = Math.ceil(cached + queryLogPadding(density, rem) * 2 + 4);
              continue;
            }
            const probe = document.createElement('span');
            probe.style.cssText = 'position:fixed;visibility:hidden;display:inline-block;width:max-content;white-space:pre;font:inherit;font-variant-numeric:inherit;font-feature-settings:inherit;letter-spacing:inherit;padding:0;border:0;height:0;overflow:hidden;pointer-events:none;';
            leaf.append(probe);
            // Preformatted lines retain exact browser typography but need only one layout read.
            probe.textContent = samples.join('\n');
            probes.push({ id, key, node: probe });
          }
          // Finish DOM writes before reading geometry to avoid one layout per column.
          for (const { id, key, node } of probes) numericWidths[id] = Math.ceil(saveMeasuredWidth(probeCache.current.numeric, key, node.getBoundingClientRect().width) + queryLogPadding(density, rem) * 2 + 4);
        } finally { for (const { node } of probes) node.remove(); }
      }
      // Names arrive asynchronously, and a hidden icon needs no decoration budget.
      // Measure full label text independently of the cell's current clipped width.
      let clientWidth: number | undefined;
      if (pageLayout === 'query-log' && context) {
        for (const button of element.querySelectorAll<HTMLElement>('tbody [data-query-client]')) {
          const label = button.querySelector<HTMLElement>('[data-query-client-text]');
          if (!label) continue;
          const labelStyle = getComputedStyle(label);
          const value = label.textContent ?? '';
          context.font = `${labelStyle.fontWeight} ${labelStyle.fontSize} ${labelStyle.fontFamily}`;
          const labelWidth = context.measureText(value).width + Math.max(0, value.length - 1) * (Number.parseFloat(labelStyle.letterSpacing) || 0);
          const parts = [...button.querySelectorAll<HTMLElement>(':scope > [data-client-device-icon], :scope > [data-query-client-text], :scope > [data-query-client-unknown]')];
          const buttonStyle = getComputedStyle(button);
          const decorations = parts.filter((part) => part !== label).reduce((sum, part) => sum + outerWidth(part), 0);
          const gaps = Math.max(0, parts.length - 1) * (Number.parseFloat(buttonStyle.columnGap) || 0);
          let inset = 0;
          for (let node: HTMLElement | null = button; node; node = node.parentElement) {
            inset += horizontalInset(node);
            if (node.tagName === 'TD') break;
          }
          clientWidth = Math.max(clientWidth ?? 0, Math.ceil(labelWidth + decorations + gaps + inset + 4));
        }
      }
      // Measure inside the actual time cell: another column's button typography
      // and Canvas font defaults do not necessarily match Safari's rendered text.
      let timestampWidth: number | undefined;
      const timestamp = element.querySelector<HTMLElement>('[data-query-timestamp]');
      if (pageLayout === 'query-log' && timestamp && referenceText?.timestamp) {
        const key = JSON.stringify([typographyKey(timestamp), referenceText.timestamp]);
        let contentWidth = probeCache.current.timestamp.get(key);
        if (contentWidth === undefined) {
          const probe = document.createElement('span');
          probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;display:inline-block;width:max-content;max-width:none;white-space:pre;padding:0;margin:0;border:0;font:inherit;letter-spacing:inherit;word-spacing:inherit;font-feature-settings:inherit;font-variation-settings:inherit;';
          timestamp.append(probe);
          try {
            // Keep browser typography while batching the conservative digit/kerning probes.
            const values = new Set([...'0123456789', ...referenceText.timestamp.flatMap(value => [...value])]);
            for (const value of referenceText.timestamp) for (const digit of '0123456789') values.add(value.replaceAll(/\d/g, digit));
            const probes = [...values].map(value => {
              const node = document.createElement('span');
              node.style.display = 'block';
              node.style.width = 'max-content';
              node.textContent = value;
              probe.append(node);
              return { value, node };
            });
            const widths = new Map(probes.map(({ value, node }) => [value, node.getBoundingClientRect().width]));
            contentWidth = saveMeasuredWidth(probeCache.current.timestamp, key, measureColumnContent('timestamp', referenceText.timestamp, value => widths.get(value) ?? 0));
          } finally { probe.remove(); }
        }
        let inset = 0;
        for (let node: HTMLElement | null = timestamp; node; node = node.parentElement) {
          inset += horizontalInset(node);
          if (node.tagName === 'TD') break;
        }
        timestampWidth = Math.ceil(contentWidth + inset + 4);
      }
      const headers: Record<string, number> = {};
      for (const th of element.querySelectorAll<HTMLTableCellElement>('thead th')) {
        const wrapper = th.querySelector('.Mui-TableHeadCell-Content-Wrapper');
        if (!wrapper?.textContent || !context) continue;
        const headerStyle = getComputedStyle(wrapper);
        const cellStyle = getComputedStyle(th);
        context.font = `${headerStyle.fontWeight} ${headerStyle.fontSize} ${headerStyle.fontFamily}`;
        const title = wrapper.textContent;
        const spacing = Number.parseFloat(headerStyle.letterSpacing) || 0;
        const controls = [...(wrapper.parentElement?.children ?? [])].filter((child) => child !== wrapper).reduce((sum, child) => sum + outerWidth(child), 0);
        const actions = th.querySelector('.Mui-TableHeadCell-Content-Actions');
        // Measure default header padding separately from body spacing.
        const headerPadding = (Number.parseFloat(cellStyle.paddingLeft) || 0) + (Number.parseFloat(cellStyle.paddingRight) || 0);
        const controlBudget = controls;
        headers[title] = Math.ceil(context.measureText(title).width + Math.max(0, title.length - 1) * spacing + controlBudget + (actions ? outerWidth(actions) : 0) + headerPadding + 8);
        if (th.dataset.widthColumn === 'mrt-row-actions') headers['mrt-row-actions'] = headers[title];
      }
      const identitiesMeasured = sizingReady && !element.querySelector('[data-query-client-pending]');
      setMeasurement((previous) => {
        // Clipped or temporarily hidden controls must not shrink a measured header.
        const nextHeaders = previous.headerDensity === density && previous.rem === rem ? { ...previous.headers } : {};
        for (const [title, width] of Object.entries(headers)) nextHeaders[title] = Math.max(nextHeaders[title] ?? 0, width);
        // An empty/loading body must not temporarily replace body metrics with header typography.
        const body = data.length > 0 ? { font, weight, spacing, copyPadding } : { font: previous.font, weight: previous.weight, spacing: previous.spacing, copyPadding: previous.copyPadding };
        const nextTimestampWidth = timestampWidth ?? previous.timestampWidth;
        const nextClientWidth = clientWidth ?? previous.clientWidth;
        if (previous.sizingReady === identitiesMeasured && JSON.stringify(previous.numericWidths) === JSON.stringify(numericWidths) && previous.clientWidth === nextClientWidth && previous.timestampWidth === nextTimestampWidth && previous.width === width && previous.font === body.font && previous.weight === body.weight && previous.spacing === body.spacing && previous.rem === rem && previous.copyPadding === body.copyPadding && previous.headerDensity === density && JSON.stringify(previous.headers) === JSON.stringify(nextHeaders)) return previous;
        return { ...previous, numericWidths, clientWidth: nextClientWidth, timestampWidth: nextTimestampWidth, width, ...body, rem, headerDensity: density, sizingReady: identitiesMeasured, headers: nextHeaders };
      });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const fontsLoaded = () => {
      probeCache.current.numeric.clear();
      probeCache.current.timestamp.clear();
      measure();
      setMeasurement((previous) => ({ ...previous, revision: previous.revision + 1 }));
    };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    const clientObserver = pageLayout === 'query-log' ? new MutationObserver((records) => {
      if (records.some((record) => {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        return target?.closest('[data-query-client]') || [...record.addedNodes].some((node) => node instanceof Element && (node.matches('[data-query-client]') || node.querySelector('[data-query-client]')));
      })) schedule();
    }) : undefined;
    clientObserver?.observe(element, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['data-query-client-pending'] });
    document.fonts?.addEventListener('loadingdone', fontsLoaded);
    return () => { observer.disconnect(); clientObserver?.disconnect(); cancelAnimationFrame(frame); document.fonts?.removeEventListener('loadingdone', fontsLoaded); };
  }, [automatic, columns, density, layout.columnVisibility, data, pageLayout, referenceText, text, sizingReady]);

  React.useEffect(() => {
    if (pageLayout !== 'query-log') return;
    if (!automatic) { setRetained({ key: '', widths: {} }); return; }
    if (!sizingReady || !measurement.sizingReady || !layout.minimums) return;
    // Query-cache notifications can precede the cells' DOM commit. Let the
    // mutation observer measure resolved labels before retaining their widths.
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
      setRetained((previous) => {
        const widths = mergeQueryLogWidths(previous.key === sizingKey ? previous.widths : {}, layout.minimums!);
        return previous.key === sizingKey && JSON.stringify(previous.widths) === JSON.stringify(widths) ? previous : { key: sizingKey, widths };
      });
    }); });
    return () => { cancelAnimationFrame(frame); };
  }, [automatic, pageLayout, sizingReady, measurement.sizingReady, sizingKey, layout.minimums]);

  return { automatic, containerRef, ...layout, cellSx: singleLineCellSx, copySx: singleLineCopySx, headerSx: singleLineHeaderSx };
}
