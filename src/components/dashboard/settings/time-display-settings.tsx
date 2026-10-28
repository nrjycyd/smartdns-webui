'use client';

import * as React from 'react';
import { Alert, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useTimeDisplay } from '../layout/time-display-provider';

const zones = ['Asia/Shanghai', 'UTC', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Tokyo', 'Asia/Singapore', 'Asia/Kolkata', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney'];

export function TimeDisplaySettings(): React.JSX.Element {
  const { t } = useTranslation();
  const { timeZone, statisticsTimeZone, ready, storageError, save, formatTime } = useTimeDisplay();
  return <Stack spacing={3} sx={{ maxWidth: 640 }}>
    <Stack spacing={1}>
      <Typography variant="h6">{t('Time display')}</Typography>
    </Stack>
    {storageError && <Alert severity="error">{t('Could not read or save time settings. Check browser storage permissions.')}</Alert>}
    <TextField select label={t('Display timezone')} value={timeZone} disabled={!ready}
      onChange={(event) => { save({ timeZone: event.target.value, statisticsTimeZone }); }}>
      {[...new Set([...zones, timeZone])].map(zone => <MenuItem key={zone} value={zone}>{zone === 'Asia/Shanghai' ? `${t('Beijing time')} · ${zone}` : zone}</MenuItem>)}
    </TextField>
    <Typography variant="body2">{t('Example')}: {formatTime(Date.UTC(2026, 9, 27, 12, 34, 56))} · {timeZone}</Typography>
    <TextField select label={t('Statistics source timezone')} value={statisticsTimeZone} disabled={!ready}
      helperText={t('Match the SmartDNS server timezone.')}
      onChange={(event) => { save({ timeZone, statisticsTimeZone: event.target.value }); }}>
      {[...new Set([...zones, statisticsTimeZone])].map(zone => <MenuItem key={zone} value={zone}>{zone}</MenuItem>)}
    </TextField>
    <Typography variant="body2" color="text.secondary">{t('Time settings are saved in this browser.')}</Typography>
  </Stack>;
}
