'use client';

import * as React from 'react';
import Tooltip from '@mui/material/Tooltip';
import { useTranslation } from 'react-i18next';
import type { ClientList } from '@/lib/backend/server';
import { getClientName } from './client-names';
import { useClientNames } from './client-names-provider';

export function ClientHostname({ client }: { client: ClientList }): React.JSX.Element {
  const { names } = useClientNames();
  const { t } = useTranslation();
  const custom = getClientName(names, client.mac);
  return <Tooltip title={custom ? `${custom} · ${t('Server hostname: {{name}}', { name: client.hostname || '—' })}` : client.hostname || ''}><span>{custom || client.hostname || '—'}</span></Tooltip>;
}
