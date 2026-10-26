'use client';

import * as React from 'react';
import { Alert, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { useTableDensity, type TableDensity } from '@/components/dashboard/layout/table-density-provider';

export function DisplaySettings(): React.JSX.Element {
  const { t } = useTranslation();
  const { density, ready, storageError, saveDensity } = useTableDensity();

  return (
    <Stack spacing={3} sx={{ maxWidth: 600 }}>
      <Stack spacing={1}>
        <Typography variant="h6">{t('Table spacing')}</Typography>
        <Typography variant="body2" color="text.secondary">{t('Adjust row height and cell spacing for Query Log, Clients, and Upstream Servers.')}</Typography>
      </Stack>
      {storageError && <Alert severity="error">{t('Could not read or save table spacing. Check browser storage permissions. Unsaved changes are not applied.')}</Alert>}
      <ToggleButtonGroup
        exclusive fullWidth value={density} disabled={!ready} aria-label={t('Table spacing')}
        onChange={(_event, next: TableDensity | null) => { if (next) saveDensity(next); }}
      >
        <ToggleButton value="compact">{t('Compact')}</ToggleButton>
        <ToggleButton value="comfortable">{t('Comfortable')}</ToggleButton>
        <ToggleButton value="spacious">{t('Spacious')}</ToggleButton>
      </ToggleButtonGroup>
      <Typography variant="body2" color="text.secondary">{t('Changes take effect immediately and are remembered in this browser for this address. Rows per page are unchanged.')}</Typography>
      <Typography variant="body2" color="text.secondary">{t('Use each table spacing button for a temporary preview. Leaving the page or refreshing restores the global setting.')}</Typography>
    </Stack>
  );
}
