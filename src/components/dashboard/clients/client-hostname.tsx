'use client';

import * as React from 'react';
import Tooltip from '@mui/material/Tooltip';
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
  return <Tooltip title={title}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%' }}>
    {ready && <ClientDeviceIcon icon={getClientName(icons, client.mac)} customColor={getClientName(iconColors, client.mac)} activity={activity} />}
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{custom || client.hostname || '—'}</span>
    {activity === 'unknown' && <span aria-label={status} style={{ color: 'var(--mui-palette-text-secondary)', fontSize: 12, flexShrink: 0 }}>?</span>}
  </span></Tooltip>;
}
