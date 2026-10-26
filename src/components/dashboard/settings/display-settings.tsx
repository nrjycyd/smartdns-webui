'use client';

import * as React from 'react';
import { Alert, Divider, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { useTableDensity, type TableDensity } from '@/components/dashboard/layout/table-density-provider';
import { useTableWidth, type TableWidthMode } from '@/components/dashboard/layout/table-width-provider';

export function DisplaySettings(): React.JSX.Element {
  const { t } = useTranslation();
  const { density, ready, storageError, saveDensity } = useTableDensity();
  const widths = useTableWidth();

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
      <Divider />
      <Stack spacing={1}>
        <Typography variant="h6">{t('Column widths')}</Typography>
        <Typography variant="body2" color="text.secondary">{t('Automatically size visible columns using the available space and current page content across Query Log, Clients, and Upstream Servers.')}</Typography>
      </Stack>
      {widths.storageError && <Alert severity="error">{t('Could not read or save column width settings. Check browser storage permissions.')}</Alert>}
      <ToggleButtonGroup exclusive fullWidth value={widths.mode} disabled={!widths.ready} aria-label={t('Column widths')} onChange={(_event, next: TableWidthMode | null) => { if (next) widths.saveMode(next); }}>
        <ToggleButton value="auto">{t('Auto fit')}</ToggleButton>
        <ToggleButton value="manual">{t('Manual widths')}</ToggleButton>
      </ToggleButtonGroup>
      <Typography variant="body2" color="text.secondary">{t('Auto fit follows window size and visible columns. Narrow screens keep horizontal scrolling. Switch to manual to restore your saved widths and drag column edges.')}</Typography>
      <Typography variant="body2" color="text.secondary">{t('Cells stay on one line. Auto fit temporarily hides Reply Code when space is tight and restores it when space returns. Your saved column visibility stays unchanged.')}</Typography>
    </Stack>
  );
}
