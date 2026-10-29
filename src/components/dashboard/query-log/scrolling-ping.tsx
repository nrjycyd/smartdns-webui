'use client';

import * as React from 'react';
export function ScrollingPing({ value }: { value: string }): React.JSX.Element {
  const container = React.useRef<HTMLSpanElement>(null);
  const text = React.useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = React.useState(0);
  React.useEffect(() => {
    const measure = () => { setOverflow(Math.max(0, (text.current?.scrollWidth ?? 0) - (container.current?.clientWidth ?? 0))); };
    measure();
    const observer = new ResizeObserver(measure);
    if (container.current) observer.observe(container.current);
    if (text.current) observer.observe(text.current);
    return () => { observer.disconnect(); };
  }, [value]);
  return <span className="query-ping" ref={container} data-query-ping data-overflow={overflow > 0 || undefined}
    style={{ '--ping-overflow': `${overflow}px`, '--ping-duration': `${Math.max(3, overflow / 20)}s` } as React.CSSProperties}
    ><span ref={text} data-query-ping-text>{value}</span></span>;
}
