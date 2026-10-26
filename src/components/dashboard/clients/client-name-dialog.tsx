'use client';

import * as React from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ClientList } from '@/lib/backend/server';
import { getClientName, isValidClientName, normalizeMac } from './client-names';
import { useClientNames } from './client-names-provider';

export function ClientNameDialog({ client, onClose }: { client: ClientList; onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation();
  const { names, ready, storageError, saveName } = useClientNames();
  const mac = normalizeMac(client.mac);
  const current = getClientName(names, mac);
  const [name, setName] = React.useState(current || '');

  function save(value: string) {
    if (mac && saveName(mac, value)) onClose();
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="client-name-title">
      <DialogTitle id="client-name-title">{t('Custom hostname')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <DialogContentText>{t('Names are UI labels saved in this browser. Devices with the same MAC share the name. Leave blank to use the server hostname.')}</DialogContentText>
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
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button disabled={!mac || !ready || !current} onClick={() => { save(''); }}>{t('Restore server hostname')}</Button>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button variant="contained" disabled={!mac || !ready || !isValidClientName(name)} onClick={() => { save(name); }}>{t('Save changes')}</Button>
      </DialogActions>
    </Dialog>
  );
}
