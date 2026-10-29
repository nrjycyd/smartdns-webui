'use client';

import * as React from 'react';
import Tooltip from '@mui/material/Tooltip';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useClientIdentity, useBatchClientIdentity } from '@/components/dashboard/clients/client-identity-provider';
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
  const identity = useBatchClientIdentity(ip);
  return identity ? <IdentityCell ip={ip} identity={identity} /> : <ExactIdentityCell ip={ip} />;
}

function ExactIdentityCell({ ip }: { ip: string }): React.JSX.Element {
  const identity = useClientIdentity(ip, true);
  return <IdentityCell ip={ip} identity={identity} />;
}

function IdentityCell({ ip, identity }: { ip: string; identity: ReturnType<typeof useClientIdentity> }): React.JSX.Element {
  const { name, tooltip, icon, customColor, lastQueryTimestamp, observedAt, lookupAvailable } = identity;
  const { now } = useClientActivityClock();
  const { formatTime } = useTimeDisplay();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const activity = getClientActivity(lastQueryTimestamp ?? 0, now, lookupAvailable, observedAt);
  const status = t(activity === 'active' ? 'Recently active' : activity === 'inactive' ? 'No recent DNS queries' : 'Activity unknown');
  const lastQuery = lastQueryTimestamp && Number.isFinite(lastQueryTimestamp) && lastQueryTimestamp > 0 ? formatTime(lastQueryTimestamp) : '—';
  const title = `${tooltip} · ${status} · ${t('Current last query')}: ${lastQuery}`;
  return (
    <Tooltip title={title}>
      <button
        data-query-client
        type="button" aria-label={`${t('Copy')}: ${tooltip}`}
        className="table-copy-button MuiButton-root query-client-button"
        onClick={async (event) => {
          event.stopPropagation();
          try {
            await copyClientDetails(tooltip);
            enqueueSnackbar(t('Client details copied'), { variant: 'success' });
          } catch {
            enqueueSnackbar(t('Failed to copy client details'), { variant: 'error' });
          }
        }}
      ><ClientDeviceIcon icon={icon} customColor={customColor} activity={activity} /><span data-query-client-text className="query-client-text">{name || formatQueryClientAddress(ip)}</span>{activity === 'unknown' && <span data-query-client-unknown aria-label={status} className="query-client-unknown">?</span>}</button>
    </Tooltip>
  );
}

export const QueryClientIdentityCell = React.memo(QueryClientIdentityCellContent);
