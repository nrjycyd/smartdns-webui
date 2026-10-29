'use client';

import * as React from 'react';
import { keyframes } from '@emotion/react';
import Box from '@mui/material/Box';
import { observePingOverflow } from './ping-overflow-observer';

const scroll = keyframes({
  '0%, 20%': { transform: 'translateX(0)' },
  '80%, 100%': { transform: 'translateX(calc(-1 * var(--ping-overflow)))' },
});

export function ScrollingPing({ value }: { value: string }): React.JSX.Element {
  const container = React.useRef<HTMLSpanElement>(null);
  const text = React.useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = React.useState(0);
  React.useEffect(() => {
    if (container.current && text.current) return observePingOverflow(container.current, text.current, setOverflow);
  }, [value]);
  return <Box component="span" ref={container} data-query-ping data-overflow={overflow > 0 || undefined}
    style={{ '--ping-overflow': `${overflow}px`, '--ping-duration': `${Math.max(3, overflow / 20)}s` } as React.CSSProperties}
    sx={{
      display: 'block', width: '100%', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textAlign: overflow > 0 ? 'left' : 'center',
      '& > span': { display: 'inline-block', whiteSpace: 'nowrap' },
      ...(overflow > 0 ? {
        '&:hover > span, .MuiButton-root:focus-visible & > span': { animation: `${scroll} var(--ping-duration) ease-in-out infinite alternate` },
        '@media (prefers-reduced-motion: reduce), (hover: none)': { '&&': { overflowX: 'auto', scrollbarWidth: 'none' }, '&::-webkit-scrollbar': { display: 'none' }, '& > span': { animation: 'none !important' } },
      } : {}),
    }}><span ref={text} data-query-ping-text>{value}</span></Box>;
}
