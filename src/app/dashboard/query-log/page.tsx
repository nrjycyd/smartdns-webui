"use client";

import * as React from 'react';

import { config } from '@/config';
import { QueryLogTable } from '@/components/dashboard/query-log/query-log-table';
import { QueryLogViewContext } from '@/components/dashboard/query-log/query-log-view';
import { useTranslation } from 'react-i18next';

export default function Page(): React.JSX.Element | null {
  const { t} = useTranslation();
  const register = React.useContext(QueryLogViewContext);
  React.useLayoutEffect(() => { register?.(QueryLogTable); }, [register]);

  React.useEffect(() => {
    document.title = `${t('Query Log')} | ${t('Dashboard')} | ${config.site.name}`;
  }, [t]);

  return null;
}
