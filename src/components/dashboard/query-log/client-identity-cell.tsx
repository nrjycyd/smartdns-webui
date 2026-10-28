'use client';

import * as React from 'react';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useClientIdentity } from '@/components/dashboard/clients/client-identity-provider';
import { singleLineCopySx } from '@/components/dashboard/layout/column-widths';
import { formatQueryClientAddress } from './client-address';
import { ClientDeviceIcon } from '@/components/dashboard/clients/client-device-icon';
import { getClientActivity } from '@/components/dashboard/clients/client-activity';
import { useClientActivityClock } from '@/components/dashboard/clients/client-activity-provider';
import { useTimeDisplay } from '@/components/dashboard/layout/time-display-provider';

async function copyClientDetails(text: string): Promise<void> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const focused = document.activeElement;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.append(textarea);
  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    if (!document.execCommand('copy')) throw new Error('Copy failed');
  } finally {
    textarea.remove();
    if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
  }
}

export function QueryClientIdentityCell({ ip }: { ip: string }): React.JSX.Element {
  const { name, tooltip, icon, lastQueryTimestamp, lookupAvailable } = useClientIdentity(ip, true);
  const { now } = useClientActivityClock();
  const { formatTime } = useTimeDisplay();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const activity = getClientActivity(lastQueryTimestamp ?? 0, now, lookupAvailable);
  const status = t(activity === 'active' ? 'Recently active' : activity === 'inactive' ? 'No recent DNS queries' : 'Activity unknown');
  const lastQuery = lastQueryTimestamp && Number.isFinite(lastQueryTimestamp) && lastQueryTimestamp > 0 ? formatTime(lastQueryTimestamp) : '—';
  const title = `${tooltip} · ${status} · ${t('Last Query Time')}: ${lastQuery} · ${t('Device activity reflects the current client record, not the time of this log entry.')}`;
  return (
    <Tooltip title={title}>
      <Button
        data-query-client
        type="button" size="small" variant="text" aria-label={`${t('Copy')}: ${tooltip}`}
        sx={{ ...singleLineCopySx, padding: 0, margin: '-0.25rem 0', gap: 0.75, fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit', color: 'inherit', textTransform: 'none', textAlign: 'left' }}
        onClick={async (event) => {
          event.stopPropagation();
          try {
            await copyClientDetails(tooltip);
            enqueueSnackbar(t('Client details copied'), { variant: 'success' });
          } catch {
            enqueueSnackbar(t('Failed to copy client details'), { variant: 'error' });
          }
        }}
      ><ClientDeviceIcon icon={icon} activity={activity} /><Box component="span" data-query-client-text sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || formatQueryClientAddress(ip)}</Box>{activity === 'unknown' && <Box component="span" data-query-client-unknown aria-label={status} sx={{ flexShrink: 0, color: 'text.secondary', fontSize: 12 }}>?</Box>}</Button>
    </Tooltip>
  );
}
