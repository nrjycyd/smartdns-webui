"use client";

import * as React from 'react';
import type { SxProps } from '@mui/material/styles';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import { smartdnsServer } from '@/lib/backend/server';
import type { ServerError, TopDomains } from '@/lib/backend/server';
import { useUser } from '@/hooks/use-user';
import { CardLoading } from './card-loading';
import { paths } from '@/paths';
import { Link, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { RankingTable } from './ranking-table';

export interface TopDomainsProps {
  domains: TopDomains[];
  sx?: SxProps;
}

function TopDomainsTable({ domains }: TopDomainsProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <RankingTable label={t('Domain')} counts={domains.map((domain) => domain.query_count)}>
          {domains.map((domain) => {
            const encodedDomain = encodeURIComponent(domain.domain);
            let url = `${paths.dashboard.queryLog}?domain=${encodedDomain}&total_count=${domain.query_count}`;
            
            if (domain.timestamp_start !== undefined && domain.timestamp_start !== null) {
              url += `&timestamp_after=${domain.timestamp_start}`;
            }

            if (domain.timestamp_end !== undefined && domain.timestamp_end !== null) {
              url += `&timestamp_before=${domain.timestamp_end}`;
            }

            return (
              <TableRow key={domain.domain}>
                <TableCell>
                  <Tooltip title={domain.domain}><Link href={url} sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{domain.domain}</Link></Tooltip>
                </TableCell>
                <TableCell>{domain.query_count}</TableCell>
              </TableRow>
            );
          })}
    </RankingTable>
  );
}

export function TopDomainsCard({ sx }: { sx?: SxProps }): React.JSX.Element {
  const { checkSessionError } = useUser();
  const [domains, setDomains] = React.useState<TopDomains[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const { t } = useTranslation();

  React.useEffect(() => {
    const fetchData = async (): Promise<void> => {
      const data = await smartdnsServer.GetTopDomains();
      if (data.error) {
        await checkSessionError?.(data.error);
        setErrorMsg(smartdnsServer.getErrorMessage(data.error));
        return;
      }

      if (data.data === null) {
        return;
      }

      setDomains(data.data || []);
      setLoading(false);
    };

    fetchData().catch(async (error: unknown) => {
      await checkSessionError?.(error as ServerError);
    });
  }, [checkSessionError]);

  return (
      <CardLoading title={t("Top Domains")} isLoading={loading} errorMsg={errorMsg} sx={sx}>
        <TopDomainsTable domains={domains} />
      </CardLoading>
  )
}
