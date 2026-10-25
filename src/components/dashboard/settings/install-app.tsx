'use client';

import * as React from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { usePwa } from '@/components/core/pwa-provider';

export function InstallApp(): React.JSX.Element {
  const { t } = useTranslation();
  const { canInstall, installed, secure, pending, error, install } = usePwa();

  return (
    <Stack spacing={2} sx={{ maxWidth: 'sm' }}>
      <Typography variant="h6">{t('Install SmartDNS')}</Typography>
      <Typography>{t('Install SmartDNS as an app to open it from your home screen or desktop.')}</Typography>
      {installed ? <Alert severity="success">{t('SmartDNS is running as an installed app.')}</Alert> : (
        <>
          {secure ? null : <Alert severity="warning">{t('Installation requires HTTPS with a trusted certificate, or localhost. A LAN HTTP address is not supported.')}</Alert>}
          <Button variant="contained" disabled={!secure || !canInstall || pending} onClick={install} sx={{ alignSelf: 'flex-start' }}>
            {t('Install app')}
          </Button>
          {secure && !canInstall ? <Alert severity="info">{t('If installation is available, use your browser menu to install this app. On iPhone or iPad, open in Safari, tap Share, then Add to Home Screen.')}</Alert> : null}
        </>
      )}
      {error ? <Alert severity="error">{t('Could not open the installation prompt. Try installing from your browser menu.')}</Alert> : null}
      <Typography variant="body2" color="text.secondary">{t('Management features require a connection to the SmartDNS server.')}</Typography>
    </Stack>
  );
}
