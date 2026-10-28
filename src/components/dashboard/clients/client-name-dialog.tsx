'use client';

import * as React from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from '@mui/material/styles';
import type { ClientList } from '@/lib/backend/server';
import { getClientName, isValidClientName, isValidClientIcon, isValidClientIconColor, normalizeMac } from './client-names';
import { useClientNames } from './client-names-provider';
import { CLIENT_ICON_PRESETS, DEFAULT_CLIENT_ICON } from './client-icon-presets';
import { ClientDeviceIcon } from './client-device-icon';

export function ClientNameDialog({ client, onClose }: { client: ClientList; onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { names, icons, iconColors, ready, storageError, saveAppearance } = useClientNames();
  const mac = normalizeMac(client.mac);
  const current = getClientName(names, mac);
  const [name, setName] = React.useState(current || '');
  const [icon, setIcon] = React.useState(getClientName(icons, mac) ?? DEFAULT_CLIENT_ICON);
  const [customMode, setCustomMode] = React.useState(icon !== '' && !CLIENT_ICON_PRESETS.some((preset) => preset.id === icon));
  const [color, setColor] = React.useState(getClientName(iconColors, mac) ?? '');
  const validIcon = isValidClientIcon(icon.trim()) && (!customMode || Boolean(icon.trim()));
  const validColor = color === '' || isValidClientIconColor(color.trim());
  const disabled = !mac || !ready;
  const preset = CLIENT_ICON_PRESETS.find((entry) => entry.id === icon) ?? CLIENT_ICON_PRESETS.find((entry) => entry.id === DEFAULT_CLIENT_ICON)!;
  const presetColor = colorScheme === 'dark' ? preset.dark : preset.light;

  function save() {
    const selected = icon.trim();
    if (mac && validIcon && validColor && saveAppearance(mac, name, selected === DEFAULT_CLIENT_ICON ? undefined : selected, color.trim() || undefined)) onClose();
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="client-name-title">
      <DialogTitle id="client-name-title">{t('Custom hostname')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <DialogContentText>{t('Saved in this browser and shared by MAC. Leave the name blank to use the server hostname.')}</DialogContentText>
          <Typography variant="body2">{t('Client IP')}: {client.client_ip}</Typography>
          <Typography variant="body2">{t('Mac Address')}: {mac || '—'}</Typography>
          <Typography variant="body2">{t('Server hostname: {{name}}', { name: client.hostname || '—' })}</Typography>
          {!mac && <Alert severity="info">{t('A valid MAC address is required to set a custom hostname.')}</Alert>}
          {storageError && <Alert severity="error">{t('Could not read or save custom hostnames. Check browser storage permissions and stored data.')}</Alert>}
          <TextField
            autoFocus fullWidth label={t('Custom hostname')} value={name} disabled={!mac || !ready}
            onChange={(event) => { setName(event.target.value); }} error={!isValidClientName(name)}
            helperText={t('Up to 64 characters.')}
            slotProps={{ htmlInput: { maxLength: 64 } }}
          />
          <TextField select fullWidth label={t('Device icon')} value={customMode ? 'custom' : icon} disabled={disabled}
            onChange={(event) => { const selected = event.target.value; setCustomMode(selected === 'custom'); setIcon(selected === 'custom' ? '' : selected); }}
            slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: 320 } } } } } }}>
            <MenuItem value=""><Typography>{t('No icon')}</Typography></MenuItem>
            {CLIENT_ICON_PRESETS.map((preset) => <MenuItem key={preset.id} value={preset.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><ClientDeviceIcon icon={preset.id} />{t(preset.label)}</Box>
            </MenuItem>)}
            <MenuItem value="custom">{t('Custom Iconify icon')}</MenuItem>
          </TextField>
          {customMode && <TextField
            fullWidth label={t('Iconify icon name')} value={icon} disabled={!mac || !ready}
            onChange={(event) => { setIcon(event.target.value); }} error={!validIcon}
            helperText={validIcon ? t('Custom icons require internet access.') : t('Enter an icon name such as mdi:devices.')}
            slotProps={{ htmlInput: { maxLength: 128 } }}
          />}
          <Stack spacing={0.75}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Box component="input" type="color" aria-label={t('Choose icon color')} value={validColor && color.trim() ? color.trim() : presetColor} disabled={disabled || !icon.trim()}
                onChange={(event) => { setColor(event.target.value.toUpperCase()); }}
                sx={{ width: 48, height: 56, flexShrink: 0, p: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }} />
              <TextField fullWidth label={t('Icon color')} placeholder={t('Default color')} value={color} disabled={disabled || !icon.trim()}
                onChange={(event) => { setColor(event.target.value); }} error={!validColor}
                slotProps={{ htmlInput: { maxLength: 7, spellCheck: false } }} />
              <Button disabled={disabled || !color} onClick={() => { setColor(''); }} sx={{ flexShrink: 0, mt: 1 }}>{t('Reset color')}</Button>
            </Stack>
            {!validColor && <Typography variant="caption" color="error">{t('Enter a color such as #3B7B91.')}</Typography>}
          </Stack>
          <Stack spacing={1}>
            <Typography variant="subtitle2">{t('Live preview')}</Typography>
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {(['active', 'inactive'] as const).map((activity) => <Stack key={activity} spacing={0.75}>
                <Typography variant="caption" color="text.secondary">{t(activity === 'active' ? 'Recently active' : 'No recent DNS queries')}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, overflowWrap: 'anywhere' }}>
                  {validIcon && <ClientDeviceIcon icon={icon.trim()} customColor={color.trim()} activity={activity} />}<span>{name.trim() || client.hostname || '—'}</span>
                </Box>
              </Stack>)}
            </Stack>
            <Typography variant="caption" color="text.secondary">{t('Active: DNS queries within 5 minutes.')}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button disabled={!mac || !ready || !name} onClick={() => { setName(''); }}>{t('Restore server hostname')}</Button>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button variant="contained" disabled={disabled || !isValidClientName(name) || !validIcon || !validColor} onClick={save}>{t('Save changes')}</Button>
      </DialogActions>
    </Dialog>
  );
}
