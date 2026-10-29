'use client';

import * as React from 'react';
import { buildIcon, Icon, type IconifyIcon } from '@iconify/react';

// Only packaged icon objects reach this component. Custom icon names still use Iconify.
export const BundledIcon = React.memo(function BundledIcon({ icon, style }: { icon: IconifyIcon; style?: React.CSSProperties }) {
  const svg = React.useMemo(() => buildIcon(icon, { width: 18, height: 18 }), [icon]);
  if (/\bid\s*=/.test(icon.body)) return <Icon icon={icon} width={18} height={18} style={style} aria-hidden="true" />;
  return <svg {...svg.attributes} width={18} height={18} aria-hidden="true" focusable="false" style={{ display: 'inline-block', flexShrink: 0, ...style }} dangerouslySetInnerHTML={{ __html: svg.body }} />;
});
