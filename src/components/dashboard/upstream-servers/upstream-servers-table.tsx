"use client"

import * as React from 'react';
import { useMemo, useState } from 'react';
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
  const [data, setData] = useState<UpStreamServers[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
  const [errorMsg, setErrorMsg] = useState("");
  const [tableLocales, setTableLocales] = useState(MRT_Localization_EN);

  const fetchData = React.useCallback(async (): Promise<void> => {
    setIsLoading(true);
    const ret = await smartdnsServer.GetUpstreamServers();
    if (ret.error) {
      await checkSessionError?.(ret.error);
      setErrorMsg(smartdnsServer.getErrorMessage(ret.error));
      setIsError(true);
      setIsLoading(false);
      return;
    }

    if (ret.data === null || ret.data === undefined) {
      setIsError(true);
      setErrorMsg(t('No data returned.'));
      setIsLoading(false);
      return;
    }

    const translatedData = ret.data.map((item: UpStreamServers) => ({
      ...item,
      security: t(item.security),
      status: t(item.status),
    }));

    setData(translatedData);
    setIsError(false);
    setIsLoading(false);
  }, [checkSessionError, t]);

  React.useEffect(() => {
    fetchData().catch((_error: unknown) => {
      // NOOP
    });
  }, [fetchData]);

  React.useEffect(() => {
    if (i18n.language === null || i18n.language === undefined) {
      return;
    }

    if (i18n.language === 'zh-CN') {
      setTableLocales(MRT_Localization_ZH_HANS);
    } else {
      setTableLocales(MRT_Localization_EN);
    }
  }, [i18n.language]);


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
        <IconButton onClick={async () => fetchData()}>
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
      showProgressBars: isLoading,
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
