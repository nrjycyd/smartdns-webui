'use client';

import * as React from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { exportBackup, MAX_BACKUP_BYTES, parseBackup, restoreBackup, type SettingsBackup } from './backup-data';

const validColor = (color: string) => CSS.supports('color', color);

export function BackupSettings(): React.JSX.Element {
  const { t } = useTranslation();
  const input = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState<{ name: string; backup: SettingsBackup } | null>(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  function download() {
    setError('');
    try {
      const source = exportBackup(localStorage, validColor);
      const url = URL.createObjectURL(new Blob([source], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `smartdns-webui-settings-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => { URL.revokeObjectURL(url); }, 1000);
    } catch { setError(t('Could not export settings. Check browser storage and saved settings.')); }
  }

  async function select(file: File | undefined) {
    setPending(null); setError('');
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('File too large');
      const backup = parseBackup(await file.text(), validColor);
      setPending({ name: file.name, backup });
    } catch { setError(t('Choose a valid WebUI backup or group appearance JSON file under 1 MB.')); }
    finally { setBusy(false); }
  }

  function apply() {
    if (!pending) return;
    setBusy(true); setError('');
    try {
      restoreBackup(localStorage, pending.backup, validColor);
      window.location.reload();
    } catch (error_) {
      setError(t(error_ instanceof Error && error_.message === 'rollback-failed'
        ? 'Import failed and some settings could not be restored. Check browser storage before retrying.'
        : 'Could not import settings. Your existing settings were preserved.'));
      setBusy(false);
    }
  }

  return <Stack spacing={3} sx={{ maxWidth: 640 }}>
    <Typography variant="h6">{t('Backup')}</Typography>
    <Typography variant="body2" color="text.secondary">{t('Back up client names, icons, group appearance, table preferences, time, language and theme.')}</Typography>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      <Button variant="contained" disabled={busy} onClick={download}>{t('Export settings')}</Button>
      <Button variant="outlined" disabled={busy} onClick={() => { input.current?.click(); }}>{t('Import settings')}</Button>
    </Stack>
    <input ref={input} type="file" accept=".json,application/json" hidden aria-label={t('Import settings')} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void select(file); }} />
    {error && <Alert severity="error">{error}</Alert>}
    {pending && <Stack spacing={2}>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{pending.name}</Typography>
      <Alert severity="info">{t('Validated {{count}} settings. Import replaces the settings in this file and reloads the page.', { count: Object.keys(pending.backup.settings).length })}</Alert>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" disabled={busy} onClick={apply}>{t('Confirm import')}</Button>
        <Button disabled={busy} onClick={() => { setPending(null); setError(''); }}>{t('Cancel')}</Button>
      </Stack>
    </Stack>}
  </Stack>;
}
