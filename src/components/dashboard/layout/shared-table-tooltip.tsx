'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Tooltip, { type TooltipProps } from '@mui/material/Tooltip';
import { touchTooltipStyles } from './shared-copy-button';
import { useTableTouchOnly } from './table-input-mode';

interface Hint { id: string; anchor: HTMLElement; title: React.ReactNode; arrow?: boolean; placement: TooltipProps['placement']; touch?: boolean }
interface Events { enter: (hint: Hint, delay: number) => void; leave: (delay?: number) => void; retain: () => void; update: (id: string, title: React.ReactNode) => void }
const HintContext = React.createContext<Events | null>(null);

export function SharedTableHints({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [hint, setHint] = React.useState<Hint | null>(null);
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = React.useRef<Hint | null>(null);
  const ignoreMouseUntil = React.useRef(0);
  const events = React.useMemo<Events>(() => ({
    enter(next, delay) { if (next.touch) ignoreMouseUntil.current = performance.now() + 3000; else if (performance.now() < ignoreMouseUntil.current) return; clearTimeout(timer.current); active.current = next; timer.current = setTimeout(() => { setHint(active.current); setOpen(true); }, delay); },
    leave(delay = 100) { clearTimeout(timer.current); timer.current = setTimeout(() => { active.current = null; setOpen(false); }, delay); },
    retain() { clearTimeout(timer.current); },
    update(id, title) { if (active.current?.id === id && active.current.title !== title) { active.current = { ...active.current, title }; setHint(active.current); } },
  }), []);
  React.useEffect(() => () => { clearTimeout(timer.current); }, []);
  return <HintContext.Provider value={events}>{children}{typeof document === 'undefined' ? null : createPortal(
    <Tooltip open={open} onClose={() => events.leave()} title={hint?.title ?? ''} arrow={hint?.arrow} placement={hint?.placement ?? 'bottom'} disableFocusListener disableHoverListener disableTouchListener slotProps={{ popper: { anchorEl: hint?.anchor ?? null, onMouseOver: events.retain, onMouseLeave: () => events.leave() }, tooltip: { sx: hint?.touch ? touchTooltipStyles : undefined } }}><span style={{ display: 'none' }} /></Tooltip>, document.body,
  )}</HintContext.Provider>;
}

export function SharedTableTooltip({ children, title, arrow, placement = 'bottom', ...props }: TooltipProps): React.JSX.Element {
  const events = React.useContext(HintContext);
  const touchOnly = useTableTouchOnly();
  const hintId = React.useId();
  React.useEffect(() => { events?.update(hintId, title); }, [events, hintId, title]);
  if (!events || (touchOnly ?? window.matchMedia('(hover: none)').matches)) return <Tooltip title={title} arrow={arrow} placement={placement} {...props}>{children}</Tooltip>;
  const element = children as React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  const enter = (target: HTMLElement) => { events.enter({ id: hintId, anchor: target, title, arrow, placement }, props.enterDelay ?? 100); };
  return React.cloneElement(element, {
    'aria-label': typeof title === 'string' ? title : undefined,
    onMouseOver: event => { element.props.onMouseOver?.(event); enter(event.currentTarget); },
    onMouseLeave: event => { element.props.onMouseLeave?.(event); events.leave(); },
    onFocus: event => { element.props.onFocus?.(event); if (event.currentTarget.matches(':focus-visible')) enter(event.currentTarget); },
    onBlur: event => { element.props.onBlur?.(event); events.leave(); },
    onTouchStart: event => { element.props.onTouchStart?.(event); events.enter({ id: hintId, anchor: event.currentTarget, title, arrow, placement, touch: true }, props.enterTouchDelay ?? 700); },
    onTouchEnd: event => { element.props.onTouchEnd?.(event); events.leave(props.leaveTouchDelay ?? 1500); },
  });
}
