'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import ButtonBase from '@mui/material/ButtonBase';
import Tooltip from '@mui/material/Tooltip';
import { MRT_CopyButton, type MRT_Cell, type MRT_TableInstance, type MRT_RowData } from 'material-react-table';

import { singleLineCopySx } from '@/components/dashboard/layout/column-widths';
import type { CSSObject } from '@emotion/react';
import type { Theme } from '@mui/material/styles';
import { useTableTouchOnly } from './table-input-mode';

interface CopyHints {
  enter: (target: HTMLButtonElement, id: string, title: string, delay?: number) => void;
  leave: (delay?: number) => void;
  copied: (target: HTMLButtonElement, id: string, title: string) => void;
}
const CopyHintContext = React.createContext<CopyHints | null>(null);

export function SharedCopyHints({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [hint, setHint] = React.useState<{ target: HTMLButtonElement; id: string; title: string; touch?: boolean } | null>(null);
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = React.useRef<{ target: HTMLButtonElement; id: string; title: string; touch?: boolean } | null>(null);
  const ignoreMouseUntil = React.useRef(0);
  const copied = React.useRef(new Map<string, { title: string; expires: number }>());
  const restoreTimers = React.useRef(new Set<ReturnType<typeof setTimeout>>());
  const handlers = React.useMemo<CopyHints>(() => ({
    enter(target, id, title, delay = 1000) {
      const touch = delay === 700;
      if (touch) ignoreMouseUntil.current = performance.now() + 3000;
      else if (performance.now() < ignoreMouseUntil.current) return;
      clearTimeout(timer.current);
      const saved = copied.current.get(id);
      const next = { target, id, touch, title: saved && saved.expires > performance.now() ? saved.title : title };
      active.current = next;
      timer.current = setTimeout(() => { if (active.current?.target === target) { setHint(active.current); setOpen(true); } }, delay);
    },
    leave(delay = 0) { clearTimeout(timer.current); timer.current = setTimeout(() => { active.current = null; setOpen(false); }, delay); },
    copied(target, id, title) {
      if (copied.current.size > 2048) copied.current.clear();
      const expires = performance.now() + 4000;
      copied.current.set(id, { title, expires });
      if (active.current?.target === target) { const next = { ...active.current, title }; active.current = next; setHint(next); }
      const original = target.dataset.copyLabel ?? '';
      target.setAttribute('aria-label', title);
      const restore = setTimeout(() => {
        restoreTimers.current.delete(restore);
        if (copied.current.get(id)?.expires !== expires) return;
        copied.current.delete(id);
        target.setAttribute('aria-label', original);
        if (active.current?.target === target) { const next = { ...active.current, title: original }; active.current = next; setHint(next); }
      }, 4000);
      restoreTimers.current.add(restore);
    },
  }), []);
  React.useEffect(() => () => { clearTimeout(timer.current); for (const restore of restoreTimers.current) clearTimeout(restore); }, []);
  return <CopyHintContext.Provider value={handlers}>{children}{typeof document === 'undefined' ? null : createPortal(<Tooltip
    open={open} onClose={() => handlers.leave()} title={hint?.title ?? ''} placement="top" disableInteractive disableFocusListener disableHoverListener disableTouchListener
    slotProps={{ popper: { anchorEl: hint?.target ?? null }, tooltip: { sx: hint?.touch ? touchTooltipStyles : undefined } }}
  ><span style={{ display: 'none' }} /></Tooltip>, document.body)}</CopyHintContext.Provider>;
}

export const copyButtonStyles = (theme: Theme, queryLog: boolean) => ({
  ...theme.typography.button as CSSObject,
  borderRadius: '12px', transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], { duration: theme.transitions.duration.short }),
  '&:hover': { textDecoration: 'none' },
  backgroundColor: 'transparent', border: 'none', color: 'inherit', cursor: 'copy', fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit',
  margin: queryLog ? '-0.25rem 0' : '-0.25rem', textAlign: 'inherit', textTransform: 'inherit', ...singleLineCopySx, padding: queryLog ? 0 : '0 4px',
});

export const touchTooltipStyles = (theme: Theme) => ({
  padding: '8px 16px', fontSize: theme.typography.pxToRem(14), lineHeight: '1.14286em', fontWeight: theme.typography.fontWeightRegular,
  '.MuiTooltip-popper[data-popper-placement*="top"] &': { marginBottom: '24px' },
  '.MuiTooltip-popper[data-popper-placement*="bottom"] &': { marginTop: '24px' },
});

export function SharedCopyButton<TData extends MRT_RowData>({ cell, table, children, className }: { cell: MRT_Cell<TData>; table: MRT_TableInstance<TData>; children: React.ReactNode; className: string }): React.JSX.Element {
  const hints = React.useContext(CopyHintContext);
  const touchOnly = useTableTouchOnly();
  const label = table.options.localization.clickToCopy;
  // Keep MUI's original long-press behavior on touch-only devices.
  if (touchOnly ?? window.matchMedia('(hover: none)').matches) return <MRT_CopyButton cell={cell} table={table}>{children}</MRT_CopyButton>;
  return <ButtonBase type="button" focusRipple className={`MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeSmall MuiButton-textSizeSmall MuiButton-colorPrimary ${className}`} aria-label={label} data-copy-label={label}
    onMouseEnter={event => hints?.enter(event.currentTarget, cell.id, label)} onMouseLeave={() => hints?.leave()}
    onFocus={event => { if (event.currentTarget.matches(':focus-visible')) hints?.enter(event.currentTarget, cell.id, label); }} onBlur={() => hints?.leave()}
    onTouchStart={event => hints?.enter(event.currentTarget, cell.id, label, 700)} onTouchEnd={() => hints?.leave(1500)}
    onClick={event => { event.stopPropagation(); navigator.clipboard.writeText(String(cell.getValue())); hints?.copied(event.currentTarget, cell.id, table.options.localization.copiedToClipboard); }}
  >{children}</ButtonBase>;
}
