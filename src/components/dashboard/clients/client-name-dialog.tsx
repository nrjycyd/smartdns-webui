'use client';

import * as React from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ClientList } from '@/lib/backend/server';
import { getClientName, isValidClientName, isValidClientIcon, normalizeMac } from './client-names';
import { useClientNames } from './client-names-provider';
import { CLIENT_ICON_PRESETS, DEFAULT_CLIENT_ICON } from './client-icon-presets';
import { ClientDeviceIcon } from './client-device-icon';

export function ClientNameDialog({ client, onClose }: { client: ClientList; onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation();
  const { names, icons, ready, storageError, saveAppearance } = useClientNames();
  const mac = normalizeMac(client.mac);
  const current = getClientName(names, mac);
  const [name, setName] = React.useState(current || '');
  const [icon, setIcon] = React.useState(getClientName(icons, mac) ?? DEFAULT_CLIENT_ICON);
  const validIcon = isValidClientIcon(icon.trim());

  function save() {
    const selected = icon.trim();
    if (mac && validIcon && saveAppearance(mac, name, selected === DEFAULT_CLIENT_ICON ? undefined : selected)) onClose();
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="client-name-title">
      <DialogTitle id="client-name-title">{t('Custom hostname')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <DialogContentText>{t('Names are UI labels saved in this browser. Devices with the same MAC share the name. Leave blank to use the server hostname.')}</DialogContentText>
          <Typography variant="body2" color="text.secondary">{t('Device icons are also saved by MAC in this browser.')}</Typography>
          <Typography variant="body2">{t('Client IP')}: {client.client_ip}</Typography>
          <Typography variant="body2">{t('Mac Address')}: {mac || '—'}</Typography>
          <Typography variant="body2">{t('Server hostname: {{name}}', { name: client.hostname || '—' })}</Typography>
          {!mac && <Alert severity="info">{t('A valid MAC address is required to set a custom hostname.')}</Alert>}
          {storageError && <Alert severity="error">{t('Could not read or save custom hostnames. Check browser storage permissions and stored data.')}</Alert>}
          <TextField
            autoFocus fullWidth label={t('Custom hostname')} value={name} disabled={!mac || !ready}
            onChange={(event) => { setName(event.target.value); }} error={!isValidClientName(name)}
            helperText={t('Use up to 64 characters without line breaks or control characters.')}
            slotProps={{ htmlInput: { maxLength: 64 } }}
          />
          <Typography variant="subtitle2">{t('Device icon')}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1 }}>
            {CLIENT_ICON_PRESETS.map((preset) => <Button key={preset.id} variant={icon === preset.id ? 'outlined' : 'text'} aria-pressed={icon === preset.id} disabled={!mac || !ready} onClick={() => { setIcon(preset.id); }} sx={{ minWidth: 0, minHeight: 64, flexDirection: 'column', gap: 0.75, textTransform: 'none', color: 'text.primary', fontSize: 12 }}>
              <ClientDeviceIcon icon={preset.id} />{t(preset.label)}
            </Button>)}
            <Button variant={icon === '' ? 'outlined' : 'text'} aria-pressed={icon === ''} disabled={!mac || !ready} onClick={() => { setIcon(''); }} sx={{ minWidth: 0, textTransform: 'none' }}>{t('No icon')}</Button>
          </Box>
          <TextField
            fullWidth label={t('Iconify icon name')} value={icon} disabled={!mac || !ready}
            onChange={(event) => { setIcon(event.target.value); }} error={!validIcon}
            helperText={validIcon ? t('Built-in icons work locally. Other icons require access to the Iconify API.') : t('Enter an icon name such as mdi:devices.')}
            slotProps={{ htmlInput: { maxLength: 128 } }}
          />
          <Stack spacing={1}>
            <Typography variant="subtitle2">{t('Live preview')}</Typography>
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {(['active', 'inactive'] as const).map((activity) => <Stack key={activity} spacing={0.75}>
                <Typography variant="caption" color="text.secondary">{t(activity === 'active' ? 'Recently active' : 'No recent DNS queries')}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, overflowWrap: 'anywhere' }}>
                  {validIcon && <ClientDeviceIcon icon={icon.trim()} activity={activity} />}<span>{name.trim() || client.hostname || '—'}</span>
                </Box>
              </Stack>)}
            </Stack>
            <Typography variant="caption" color="text.secondary">{t('Activity is based on DNS queries within 5 minutes, not device connectivity.')}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button disabled={!mac || !ready || !name} onClick={() => { setName(''); }}>{t('Restore server hostname')}</Button>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button variant="contained" disabled={!mac || !ready || !isValidClientName(name) || !validIcon} onClick={save}>{t('Save changes')}</Button>
      </DialogActions>
    </Dialog>
  );
}
