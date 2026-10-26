"use client";

import * as React from 'react';
import Box from '@mui/material/Box';
import type { SxProps } from '@mui/material/styles';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import { smartdnsServer } from '@/lib/backend/server';
import type { TopClients } from '@/lib/backend/server';
import { useUser } from '@/hooks/use-user';
import { CardLoading } from './card-loading';
import { paths } from '@/paths';
import { Link, Tooltip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useClientIdentity } from '@/components/dashboard/clients/client-identity-provider';
import { RankingTable } from './ranking-table';

export interface TopClientsProps {
  clients: TopClients[];
  sx?: SxProps;
}

function TopClientLink({ ip, href }: { ip: string; href: string }): React.JSX.Element {
  const { name: custom, tooltip } = useClientIdentity(ip);
  return (
    <Tooltip title={tooltip}>
      <Link href={href} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0, whiteSpace: 'nowrap' }}>
        <Box component="span" sx={{ minWidth: 0, maxWidth: custom ? '55%' : '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{custom || ip}</Box>
        {custom && <Typography component="span" variant="caption" color="text.secondary" sx={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ip}</Typography>}
      </Link>
    </Tooltip>
  );
}

function TopClientsTable({ clients}: TopClientsProps): React.JSX.Element {

  const { t } = useTranslation();

  return (
    <RankingTable label={t('Client')} counts={clients.map((client) => client.query_count)}>
          {clients.map((client) => {
            const encodedClient = encodeURIComponent(client.client_ip);
            let url = `${paths.dashboard.queryLog}?client=${encodedClient}&total_count=${client.query_count}`;
            
            if (client.timestamp_start !== undefined && client.timestamp_start !== null) {
              url += `&timestamp_after=${client.timestamp_start}`;
            }

            if (client.timestamp_end !== undefined && client.timestamp_end !== null) {
              url += `&timestamp_before=${client.timestamp_end}`;
            }
            return (
              <TableRow key={client.client_ip}>
                <TableCell><TopClientLink href={url} ip={client.client_ip} /></TableCell>
                <TableCell>{client.query_count}</TableCell>
              </TableRow>
            );
          })}
    </RankingTable>
  );
}

export function TopClientsCard({ sx }: { sx?: SxProps }): React.JSX.Element {
  const { checkSessionError } = useUser();
  const [clients, setClients] = React.useState<TopClients[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const { t } = useTranslation();

  React.useEffect(() => {
    const fetchData = async (): Promise<void> => {
      const data = await smartdnsServer.GetTopClients();
      if (data.error) {
        await checkSessionError?.(data.error);
        setErrorMsg(smartdnsServer.getErrorMessage(data.error));
        return;
      }

      if (data.data === null || data.data === undefined) {
        return;
      }

      setClients(data.data);
      setLoading(false);
    };

    void fetchData();
  }, [checkSessionError]);

  return (
    <CardLoading title={t("Top Clients")} isLoading={loading} errorMsg={errorMsg} sx={sx}>
      <TopClientsTable clients={clients} />
    </CardLoading>
  );
}
