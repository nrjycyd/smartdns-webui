'use client';

import * as React from 'react';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useClientIdentity } from '@/components/dashboard/clients/client-identity-provider';
import { singleLineCopySx } from '@/components/dashboard/layout/column-widths';
import { formatQueryClientAddress } from './client-address';

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
  const { name, tooltip } = useClientIdentity(ip);
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  return (
    <Tooltip title={tooltip}>
      <Button
        type="button" size="small" variant="text" aria-label={`${t('Copy')}: ${tooltip}`}
        sx={{ ...singleLineCopySx, padding: 0, margin: '-0.25rem 0', fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit', color: 'inherit', textTransform: 'none', textAlign: 'left' }}
        onClick={async (event) => {
          event.stopPropagation();
          try {
            await copyClientDetails(tooltip);
            enqueueSnackbar(t('Client details copied'), { variant: 'success' });
          } catch {
            enqueueSnackbar(t('Failed to copy client details'), { variant: 'error' });
          }
        }}
      ><span>{name || formatQueryClientAddress(ip)}</span></Button>
    </Tooltip>
  );
}
