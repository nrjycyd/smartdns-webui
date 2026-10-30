'use client';

import * as React from 'react';
import { SharedTableTooltip as Tooltip } from '../layout/shared-table-tooltip';
import Box from '@mui/material/Box';
import { useTranslation } from 'react-i18next';
import type { ClientList } from '@/lib/backend/server';
import { getClientName } from './client-names';
import { useClientNames } from './client-names-provider';
import { ClientDeviceIcon } from './client-device-icon';
import { getClientActivity } from './client-activity';
import { useClientActivityClock } from './client-activity-provider';
import { useTimeDisplay } from '../layout/time-display-provider';

export function ClientHostname({ client }: { client: ClientList }): React.JSX.Element {
  const { names, icons, iconColors, ready } = useClientNames();
  const { now, available, observedAt } = useClientActivityClock();
  const { formatTime } = useTimeDisplay();
  const { t } = useTranslation();
  const custom = getClientName(names, client.mac);
  const activity = getClientActivity(client.last_query_timestamp, now, available, observedAt);
  const status = t(activity === 'active' ? 'Recently active' : activity === 'inactive' ? 'No recent DNS queries' : 'Activity unknown');
  const lastQuery = Number.isFinite(client.last_query_timestamp) && client.last_query_timestamp > 0 ? formatTime(client.last_query_timestamp) : '—';
  const title = [custom || client.hostname || '—', custom ? t('Server hostname: {{name}}', { name: client.hostname || '—' }) : '', status, `${t('Last Query Time')}: ${lastQuery}`].filter(Boolean).join(' · ');
  const name = custom || client.hostname || '—';
  const icon = getClientName(icons, client.mac);
  const customColor = getClientName(iconColors, client.mac);
  return React.useMemo(() => <Tooltip title={title}><Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minWidth: 0, maxWidth: '100%' }}>
    {ready && <ClientDeviceIcon icon={icon} customColor={customColor} activity={activity} />}
    <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Box>
    {activity === 'unknown' && <Box component="span" aria-label={status} sx={{ color: 'text.secondary', fontSize: 12 }}>?</Box>}
  </Box></Tooltip>, [title, ready, icon, customColor, activity, name, status]);
}
