'use client';

import * as React from 'react';
import { Icon, loadIcon, type IconifyIcon } from '@iconify/react';
import { BundledIcon } from '@/components/common/bundled-icon';
import { useColorScheme } from '@mui/material/styles';
import { CLIENT_ICON_PRESETS, DEFAULT_CLIENT_ICON } from './client-icon-presets';
import clientIcons from './client-icons.json';
import type { ClientActivity } from './client-activity';
import { isValidClientIconColor } from './client-names';

function ClientDeviceIconContent({ icon = DEFAULT_CLIENT_ICON, activity = 'active', customColor }: { icon?: string; activity?: ClientActivity; customColor?: string }): React.JSX.Element | null {
  const { colorScheme } = useColorScheme();
  const [loaded, setLoaded] = React.useState<{ name: string; data: IconifyIcon } | null>(null);
  const builtin = Object.hasOwn(clientIcons, icon) ? clientIcons[icon as keyof typeof clientIcons] : undefined;
  React.useEffect(() => {
    if (!icon || builtin) return;
    let cancelled = false;
    void loadIcon(icon).then((data) => { if (!cancelled) setLoaded({ name: icon, data }); }).catch(() => { /* Keep the local generic fallback. */ });
    return () => { cancelled = true; };
  }, [icon, builtin]);
  if (!icon) return null;
  const preset = CLIENT_ICON_PRESETS.find((entry) => entry.id === icon) ?? CLIENT_ICON_PRESETS.find((entry) => entry.id === DEFAULT_CLIENT_ICON)!;
  const data = builtin ?? (loaded?.name === icon ? loaded.data : clientIcons[DEFAULT_CLIENT_ICON]);
  const dark = colorScheme === 'dark';
  const activeColor = customColor && isValidClientIconColor(customColor) ? customColor : (dark ? preset.dark : preset.light);
  const color = activity === 'active' ? activeColor : activity === 'inactive' ? (dark ? '#737D8C' : '#929BA7') : (dark ? '#A0A8B5' : '#66717F');
  return <span data-client-device-icon={icon} data-activity={activity} style={{ display: 'inline-flex', width: 18, height: 18, flexShrink: 0, color }}>{builtin || data === clientIcons[DEFAULT_CLIENT_ICON] ? <BundledIcon icon={data} /> : <Icon icon={data} width={18} height={18} aria-hidden="true" />}</span>;
}

export const ClientDeviceIcon = React.memo(ClientDeviceIconContent);
