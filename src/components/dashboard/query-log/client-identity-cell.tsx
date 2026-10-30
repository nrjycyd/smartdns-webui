'use client';

import * as React from 'react';
import Button from '@mui/material/Button';
import { SharedTableTooltip as Tooltip } from '../layout/shared-table-tooltip';
import Box from '@mui/material/Box';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useQueryLogClientIdentity } from '@/components/dashboard/clients/client-identity-provider';
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

function QueryClientIdentityCellContent({ ip }: { ip: string }): React.JSX.Element {
  const { name, tooltip, icon, customColor, lastQueryTimestamp, observedAt, lookupPending, lookupAvailable } = useQueryLogClientIdentity(ip);
  const { now } = useClientActivityClock();
  const { formatTime } = useTimeDisplay();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const activity = getClientActivity(lastQueryTimestamp ?? 0, now, lookupAvailable, observedAt);
  const status = t(activity === 'active' ? 'Recently active' : activity === 'inactive' ? 'No recent DNS queries' : 'Activity unknown');
  const lastQuery = lastQueryTimestamp && Number.isFinite(lastQueryTimestamp) && lastQueryTimestamp > 0 ? formatTime(lastQueryTimestamp) : '—';
  const title = `${tooltip} · ${status} · ${t('Current last query')}: ${lastQuery}`;
  // Cache the presentation without adding a component layer to every row.
  // Clock and lookup changes above still recompute every freshness decision.
  return React.useMemo(() => (
    <Tooltip title={title}>
      <Button
        data-query-client
        data-query-client-pending={lookupPending ? true : undefined}
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
      ><ClientDeviceIcon icon={icon} customColor={customColor} activity={activity} /><Box component="span" data-query-client-text sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || formatQueryClientAddress(ip)}</Box>{activity === 'unknown' && <Box component="span" data-query-client-unknown aria-label={status} sx={{ flexShrink: 0, color: 'text.secondary', fontSize: 12 }}>?</Box>}</Button>
    </Tooltip>
  ), [ip, name, tooltip, icon, customColor, activity, lookupPending, title, status, t, enqueueSnackbar]);
}

export const QueryClientIdentityCell = React.memo(QueryClientIdentityCellContent);
