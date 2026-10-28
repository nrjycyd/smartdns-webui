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
      <Typography variant="body2" color="text.secondary">{t('Applied immediately and saved in this browser.')}</Typography>
      <Divider />
      <Stack spacing={1}>
        <Typography variant="h6">{t('Column widths')}</Typography>
      </Stack>
      {widths.storageError && <Alert severity="error">{t('Could not read or save column width settings. Check browser storage permissions.')}</Alert>}
      <ToggleButtonGroup exclusive fullWidth value={widths.mode} disabled={!widths.ready} aria-label={t('Column widths')} onChange={(_event, next: TableWidthMode | null) => { if (next) widths.saveMode(next); }}>
        <ToggleButton value="auto">{t('Auto fit')}</ToggleButton>
        <ToggleButton value="manual">{t('Manual widths')}</ToggleButton>
      </ToggleButtonGroup>
      <Typography variant="body2" color="text.secondary">{t('Auto fit adjusts to content and window size. In manual mode, drag column edges to resize.')}</Typography>
    </Stack>
  );
}
