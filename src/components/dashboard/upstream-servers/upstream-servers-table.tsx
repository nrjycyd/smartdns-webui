"use client"

import * as React from 'react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { readColumnVisibility, readColumnSizing, saveTablePreference } from '@/components/dashboard/layout/table-preferences';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef as MRTColumnDef,
} from 'material-react-table';
import { Card, IconButton, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useColorScheme } from '@mui/material/styles';
import { tableBackground } from '../layout/table-background';
import { type UpStreamServers, smartdnsServer } from '@/lib/backend/server';
import { useUser } from '@/hooks/use-user';
import { useTableDensityPreview } from '@/components/dashboard/layout/table-density-provider';
import { OptimizedTableBody } from '@/components/dashboard/layout/optimized-table-body';
import { useAdaptiveColumns } from '@/components/dashboard/layout/use-adaptive-columns';
import { useTranslation } from 'react-i18next';
import { MRT_Localization_EN } from 'material-react-table/locales/en';
import { MRT_Localization_ZH_HANS } from 'material-react-table/locales/zh-Hans';
import { type SnackbarOrigin, SnackbarProvider } from 'notistack';

// DNS 延迟颜色分级：<10ms 深绿，10-20 浅绿，20-50 黄绿，50-100 黄，>100 红
function getLatencyColor(ms: number): string {
  if (ms < 10) return '#1b5e20';
  if (ms < 20) return '#66bb6a';
  if (ms < 50) return '#9ccc65';
  if (ms <= 100) return '#fbc02d';
  return '#d32f2f';
}

function TableUpstreamServers(): React.JSX.Element {
  const [density, previewDensity] = useTableDensityPreview();
  const { t, i18n } = useTranslation();

  const COLUMN_VISIBILITY_KEY = 'upstream-servers-table-column-visibility';
  const COLUMN_SIZING_KEY = 'upstream-servers-table-column-sizing';

  const [columnVisibility, setColumnVisibility] = React.useState(() => readColumnVisibility(COLUMN_VISIBILITY_KEY));
  const [columnSizing, setColumnSizing] = React.useState(() => readColumnSizing(COLUMN_SIZING_KEY));

  const columns = useMemo<MRTColumnDef<UpStreamServers>[]>(
    () => [
      {
        accessorKey: 'host',
        header: t('Host'),
        size: 250,
        enableSorting: false,
      },
      {
        accessorKey: 'ip',
        header: t('IP'),
        enableSorting: false,
        size: 330,
      },
      {
        accessorKey: 'port',
        header: t('Port'),
        size: 80,
        enableSorting: false,
      },
      {
        accessorKey: 'server_type',
        header: t('Type'),
        size: 100,
      },
      {
        accessorKey: 'security',
        header: t('Security'),
        size: 148,
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        size: 110,
      },
      {
        accessorKey: 'query_success_rate',
        header: t('Success Rate'),
        enableSorting: true,
        size: 160,
        Cell: ({ cell }) => {
          const rate = cell.getValue<number>();
          return <span>{rate} %</span>;
        },
      },
      {
        accessorKey: 'avg_time',
        header: t('Avg Time'),
        enableSorting: true,
        size: 140,
        Cell: ({ cell }) => {
          const avgTime = cell.getValue<number>();
          if (avgTime < 0) {
            return <span>N/A</span>;
          }
          return <span style={{ color: getLatencyColor(avgTime), fontWeight: 600 }}>{avgTime} ms</span>;
        },
      },
      {
        accessorKey: 'total_query_count',
        header: t('Total Query Count'),
        enableSorting: true,
        size: 200,
      },
      {
        accessorKey: 'total_query_success',
        header: t('Total Success Number'),
        enableSorting: true,
        size: 220,
      },
    ],
    [t],
  );

  const { checkSessionError } = useUser();
  const { data: rawData, error, isError, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['upstream-servers'],
    gcTime: 60_000,
    queryFn: async ({ signal }) => {
      const ret = await smartdnsServer.GetUpstreamServers(signal);
      signal.throwIfAborted();
      if (ret.error) {
        await checkSessionError?.(ret.error);
        throw new Error(smartdnsServer.getErrorMessage(ret.error));
      }
      if (ret.data === null || ret.data === undefined) throw new Error(t('No data returned.'));
      return ret.data;
    },
  });
  const data = useMemo(() => (rawData ?? []).map((item) => ({
    ...item, security: t(item.security), status: t(item.status),
  })), [rawData, t]);
  const errorMsg = error?.message ?? '';
  const tableLocales = i18n.language === 'zh-CN' ? MRT_Localization_ZH_HANS : MRT_Localization_EN;

  const { colorScheme } = useColorScheme();
  const baseBackgroundColor = tableBackground(colorScheme);

  const widthText = React.useCallback((row: UpStreamServers, id: string) => {
    if (id === 'query_success_rate') return `${row.query_success_rate} %`;
    if (id === 'avg_time') return row.avg_time >= 0 ? `${row.avg_time} ms` : 'N/A';
    return String(row[id as keyof UpStreamServers] ?? '');
  }, []);
  const widths = useAdaptiveColumns({ layout: 'upstream-servers', columns, data, visibility: columnVisibility, density, manualSizing: columnSizing, text: widthText, filtering: false, sorting: true, columnActions: false });

  const table = useMaterialReactTable({
    onDensityChange: previewDensity,
    columns,
    data,
    localization: { ...tableLocales, toggleDensity: t('Preview table spacing (this page only)') },
    enableColumnResizing: !widths.automatic,
    layoutMode: 'grid-no-grow',
    muiTableContainerProps: { ref: widths.containerRef },
    muiTableBodyCellProps: ({ row, cell }) => ({ sx: widths.cellSx, title: widthText(row.original, cell.column.id) }),
    muiCopyButtonProps: { sx: widths.copySx },
    muiTableHeadCellProps: { sx: widths.headerSx },
    muiTableBodyProps: ({ table }) => ({ children: isLoading || data.length > 0 ? <OptimizedTableBody table={table} layout="upstream-servers" /> : undefined }),
    enableColumnOrdering: false,
    enableColumnActions: false,
    enableColumnFilters: false,
    enableSorting: true,
    enableClickToCopy: window.isSecureContext,
    enableGlobalFilter: true,
    enableColumnFilterModes: false,
    enableColumnPinning: true,
    enableColumnDragging: false,
    enableKeyboardShortcuts: false,
    enablePagination: false,
    enableGlobalFilterRankedResults: false,
    muiToolbarAlertBannerProps: errorMsg.length > 0
      ? {
        color: 'error',
        children: errorMsg,
      }
      : undefined,
    renderTopToolbarCustomActions: () => (
      <Tooltip arrow title={t("Refresh Data")}>
        <IconButton onClick={async () => { await refetch(); }}>
          <RefreshIcon />
        </IconButton>
      </Tooltip>
    ),
    onColumnVisibilityChange: (updaterOrValue) => {
        setColumnVisibility((prev) => {
          const newVisibility =
              typeof updaterOrValue === 'function'
                  ? updaterOrValue(prev)
                  : updaterOrValue;
          saveTablePreference(COLUMN_VISIBILITY_KEY, newVisibility);
          return newVisibility;
        });
    },
    onColumnSizingChange: (updaterOrValue) => {
      if (widths.automatic) return;
      setColumnSizing((prev) => {
          const newSizing =
            typeof updaterOrValue === 'function'
              ? updaterOrValue(prev)
              : updaterOrValue;
          saveTablePreference(COLUMN_SIZING_KEY, newSizing);
          return newSizing;
        });
    },
    initialState: {
      sorting: [{ id: 'avg_time', desc: false }],
      showGlobalFilter: true,
      columnVisibility,
      columnSizing,
    },
    state: {
      density,
      showAlertBanner: isError,
      showProgressBars: isFetching,
      showSkeletons: isLoading,
      columnVisibility: widths.columnVisibility,
      columnSizing: widths.columnSizing,
    },
    mrtTheme: (_theme) => ({
      baseBackgroundColor,
    }),
  });

  return (<MaterialReactTable table={table} />);
};

export function UpstreamServersTable(): React.JSX.Element {

  const [state, setState] = React.useState<SnackbarOrigin>({
    vertical: 'top',
    horizontal: 'left',
  });

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 600px)');
    const handleMediaQueryChange = (event: MediaQueryListEvent): void => {
      if (event.matches) {
        setState({ vertical: 'top', horizontal: 'left' });
      } else {
        setState({ vertical: 'bottom', horizontal: 'left' });
      }
    };

    if (mediaQuery.matches) {
      setState({ vertical: 'top', horizontal: 'left' });
    } else {
      setState({ vertical: 'bottom', horizontal: 'left' });
    }

    mediaQuery.addEventListener('change', handleMediaQueryChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaQueryChange);
    };
  }, [setState]);

  return (
    <SnackbarProvider
      anchorOrigin={state}
      maxSnack={5} autoHideDuration={6000}>
      <Card>
        <TableUpstreamServers />
      </Card>
    </SnackbarProvider>
  );
}
