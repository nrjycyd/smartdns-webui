"use client"

import * as React from 'react';
import { useMemo, useState } from 'react';
import { readColumnVisibility, readColumnSizing, saveTablePreference, readTablePagination, getPageCursorParams, type PageCursor } from '@/components/dashboard/layout/table-preferences';
import { useSearchParams } from 'next/navigation';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnFilterFnsState as MRTColumnFilterFnsState,
  type MRT_ColumnDef as MRTColumnDef,
  type MRT_ColumnFiltersState as MRTColumnFiltersState,
  type MRT_PaginationState as MRTPaginationState,
  type MRT_SortingState as MRTSortingState,
  MRT_ActionMenuItem as MRTActionMenuItem,
  type MRT_Row as MRTRow,
  type MRT_Cell as MRTCell,
  type MRT_TableInstance as MRTTableInstance,
} from 'material-react-table';
import { Card, IconButton, Tooltip } from '@mui/material';
import { createTheme, useColorScheme } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import { DateTime, filterTimestamp } from '@/lib/display-time';
import { useTimeDisplay } from '../layout/time-display-provider';
import {
  QueryClient,
  QueryClientProvider,
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { type ClientList, type QueryClientsParams, smartdnsServer } from '@/lib/backend/server';
import { useUser } from '@/hooks/use-user';
import { useTableDensityPreview } from '@/components/dashboard/layout/table-density-provider';
import { useTranslation } from 'react-i18next';
import { MRT_Localization_EN } from 'material-react-table/locales/en';
import { MRT_Localization_ZH_HANS } from 'material-react-table/locales/zh-Hans';
import { Delete, Domain, EditOutlined } from '@mui/icons-material';
import { type SnackbarOrigin, SnackbarProvider, useSnackbar } from 'notistack';
import { ClientHostname } from './client-hostname';
import { ClientNameDialog } from './client-name-dialog';
import { getClientName } from './client-names';
import { useClientNames } from './client-names-provider';
import { useRefreshClientIdentities } from './client-identity-provider';
import { useAdaptiveColumns } from '@/components/dashboard/layout/use-adaptive-columns';


interface UserApiResponse {
  data: ClientList[];
  meta: {
    totalRowCount: number;
  };
};

const FILTER_COLUMNS = new Set(['id', 'client_ip', 'mac', 'hostname']);

function TableClients(): React.JSX.Element {
  const { timeZone, formatTime } = useTimeDisplay();
  const { names: clientNames } = useClientNames();
  const [editingClient, setEditingClient] = useState<ClientList | null>(null);
  const [density, previewDensity] = useTableDensityPreview();
  const { t, i18n } = useTranslation();
  const search = useSearchParams().toString();
  const queryClient = useQueryClient();
  const refreshClientIdentities = useRefreshClientIdentities();

  const COLUMN_VISIBILITY_KEY = 'clients-table-column-visibility';
  const COLUMN_SIZING_KEY = 'clients-table-column-sizing';
  const PAGINATION_KEY = 'clients-table-pagination';

  const [columnVisibility, setColumnVisibility] = React.useState(() => readColumnVisibility(COLUMN_VISIBILITY_KEY));
  const [columnSizing, setColumnSizing] = React.useState(() => readColumnSizing(COLUMN_SIZING_KEY));

  const columns = useMemo<MRTColumnDef<ClientList>[]>(
    () => [
      {
        accessorKey: 'id',
        header: t('ID'),
        size: 110,
        enableColumnActions: false,
        columnFilterModeOptions: ['equals'],
      },
      {
        accessorKey: 'client_ip',
        header: t('Client IP'),
        Cell: ({ cell }) => <Tooltip title={cell.getValue<string>()} arrow placement="top"><span>{cell.getValue<string>()}</span></Tooltip>,
        size: 360,
        enableColumnActions: false,
        columnFilterModeOptions: ['contains', 'equals'],
      },
      {
        accessorKey: 'mac',
        header: t('Mac Address'),
        size: 240,
        enableColumnActions: false,
        columnFilterModeOptions: ['equals'],
      },
      {
        accessorKey: 'hostname',
        header: t('Host Name'),
        Cell: ({ row }) => <ClientHostname client={row.original} />,
        muiFilterTextFieldProps: { placeholder: t('Filter server hostname') },
        size: 250,
        enableColumnActions: false,
        columnFilterModeOptions: ['equals'],
      },
      {
        accessorKey: 'last_query_timestamp',
        header: t('Last Query Time'),
        filterVariant: 'datetime-range',
        Cell: ({ cell }) => {
          const timestamp = cell.getValue<string>();
          const localTime = formatTime(timestamp);
          return <span>{localTime}</span>;
        },
        columnFilterModeOptions: ['equals'],
        enableColumnActions: false,
        size: 120,
      },
    ],
    [t, formatTime],
  );

  const { checkSessionError } = useUser();
  const [columnFilters, setColumnFilters] = useState<MRTColumnFiltersState>(
    [],
  );
  const [columnFilterFns, setColumnFilterFns] =
    useState<MRTColumnFilterFnsState>(
      () => Object.fromEntries(
        columns.map(({ accessorKey }) => {
          return [accessorKey, 'equals'];
        })
      ) as MRTColumnFilterFnsState
    );
  const [shouldFetchData, setShouldFetchData] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [errorMsg, setErrorMsg] = useState("Error loading data");
  const [sorting, setSorting] = useState<MRTSortingState>([]);
  const pageCursor = React.useRef<PageCursor | null>(null);
  const [pagination, setPagination] = useState<MRTPaginationState>(() => ({ ...readTablePagination(PAGINATION_KEY), pageIndex: 0 }));
  const [totalRowCount, setTotalRowCount] = useState(0);
  const totalCountFromParams = React.useRef(false);
  const [tableLocales, setTableLocales] = useState(MRT_Localization_EN);
  const { enqueueSnackbar } = useSnackbar();
  const [isActionAlignRight] = React.useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth >= 1200);

  React.useEffect(() => {
    const searchParams = new URLSearchParams(search);
    const filters: MRTColumnFiltersState = [];
    const timestamp: (DateTime | undefined)[] = [undefined, undefined];

    for (const [key, value] of searchParams.entries()) {
      if (key === 'timestamp_after' || key === 'timestamp_before') {
        const parsed = DateTime.fromMillis(Number(value), { zone: 'UTC' });
        if (parsed.isValid) timestamp[key === 'timestamp_after' ? 0 : 1] = parsed;
        continue;
      }
      if (key === 'last_query_timestamp') continue;
      if (!FILTER_COLUMNS.has(key)) {
        continue;
      }

      filters.push({ id: key, value });
    }

    if (timestamp.some(Boolean)) filters.push({ id: 'last_query_timestamp', value: timestamp });

    pageCursor.current = null;
    setColumnFilters(filters);
    setPagination((previous) => ({ ...previous, pageIndex: 0 }));
    setShouldFetchData(true);
  }, [search]);

  const {
    data: { data = [], meta } = {},
    isError,
    isRefetching,
    isLoading,
    refetch,
  } = useQuery<UserApiResponse>({
    enabled: shouldFetchData,
    queryKey: [
      'table-data',
      columnFilterFns,
      columnFilters,
      globalFilter,
      pagination.pageIndex,
      pagination.pageSize,
      sorting,
    ],
    queryFn: async ({ signal }) => {
      const scope = JSON.stringify([columnFilterFns, columnFilters, globalFilter, sorting]);
      const currentPageNumber = pagination.pageIndex + 1;
      const queryParam: QueryClientsParams = {
        'page_num': currentPageNumber,
        'page_size': pagination.pageSize,
      };

      if (totalCountFromParams.current) {
        totalCountFromParams.current = false;
        queryParam['total_count'] = totalRowCount;
      }

      Object.assign(queryParam, getPageCursorParams(pageCursor.current, currentPageNumber, pagination.pageSize, scope));

      for (const filter of columnFilters) {
        if (filter.id === null || filter.id === undefined || filter.value === null || filter.value === undefined) {
          continue;
        }

        if (filter.id === 'last_query_timestamp') {
          const timerange = filter.value;
          if (Array.isArray(timerange) && timerange.length === 2) {
            if (timerange[0]) {
              queryParam['timestamp_after'] = filterTimestamp(timerange[0]);
            }

            if (timerange[1]) {
              queryParam['timestamp_before'] = filterTimestamp(timerange[1]);
            }
          }
          continue;
        }

        const filterId = filter.id as keyof QueryClientsParams;
        queryParam[filterId] = filter.value as string;
      }

      const data = await smartdnsServer.GetClients(queryParam);
      if (data.error) {
        await checkSessionError?.(data.error);
        setErrorMsg(smartdnsServer.getErrorMessage(data.error));
        throw new Error(errorMsg);
      }

      if (data.data === null || data.data === undefined) {
        setErrorMsg('Error loading data');
        throw new Error(errorMsg);
      }

      const totalCount = data.data.total_count;
      if (!signal.aborted) {
        pageCursor.current = data.data.client_list.length > 0 ? {
          firstID: data.data.client_list[0].id,
          lastID: data.data.client_list.at(-1)!.id,
          pageNumber: currentPageNumber,
          pageSize: pagination.pageSize,
          scope,
          totalCount,
        } : null;
        setTotalRowCount(totalCount);
      }
      const resp: UserApiResponse = {
        data: data.data.client_list,
        meta: {
          totalRowCount: totalCount,
        },
      };

      return resp;
    },
    placeholderData: keepPreviousData,
  });

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

  const handleRowClientMacVendor = React.useCallback(async (_row: MRTRow<ClientList>) => {
    const msg = t('Not implemented yet.');

    enqueueSnackbar(msg, { style: { whiteSpace: 'pre-line' } });
  }, [t, enqueueSnackbar]);

  const handleRowDelete = React.useCallback(async (row: MRTRow<ClientList>) => {
    const id = row.original.id;
    const clientIP = row.original.client_ip;
    const ret = await smartdnsServer.DeleteClientById(id);
    if (ret.error) {
      enqueueSnackbar(`${t('Error')}: ${t(smartdnsServer.getErrorMessage(ret.error))}, id: ${id}`, { variant: 'error' });
      return;
    }

    enqueueSnackbar(t('Delete client {{id}} {{client_ip}} successfully.', { id, client_ip: clientIP }), { variant: 'success' });
    pageCursor.current = null;
    totalCountFromParams.current = false;
    refreshClientIdentities();
    await queryClient.invalidateQueries({ queryKey: ['table-data'] });
  }, [t, enqueueSnackbar, queryClient, refreshClientIdentities]);

  const renderRowMenuItem = (closeMenu: () => void, row: MRTRow<ClientList>, table: MRTTableInstance<ClientList>): React.ReactNode[] => (
    [
      <MRTActionMenuItem
        icon={<EditOutlined />}
        key="custom_hostname"
        label={t('Custom hostname')}
        onClick={(event) => { event.preventDefault(); closeMenu(); setEditingClient(row.original); }}
        table={table}
      />,
      <MRTActionMenuItem
        icon={<Domain />}
        key="mac_vendor"
        label={t('Mac Vendor')}
        onClick={async (e) => { e.preventDefault(); closeMenu(); await handleRowClientMacVendor(row); }}
        table={table}
      />,
      <MRTActionMenuItem
        icon={<Delete />}
        key="delete"
        label={t('Delete')}
        onClick={async (e) => { e.preventDefault(); closeMenu(); await handleRowDelete(row); }}
        table={table}
      />,
    ]
  );

  const renderCellMenuItem = (closeMenu: () => void, _cell: MRTCell<ClientList>, row: MRTRow<ClientList>, table: MRTTableInstance<ClientList>): React.ReactNode[] => (
    [
      renderRowMenuItem(closeMenu, row, table),
    ]
  );

  const { colorScheme } = useColorScheme();
  const tableTheme = React.useMemo(
    () => createTheme({ palette: { mode: colorScheme === 'dark' ? 'dark' : 'light' } }),
    [colorScheme],
  );
  const baseBackgroundColor = tableTheme.palette.background.paper;

  const widthText = React.useCallback((row: ClientList, id: string) => {
    if (id === 'hostname') return getClientName(clientNames, row.mac) || row.hostname || '—';
    if (id === 'last_query_timestamp') return formatTime(row.last_query_timestamp);
    return String(row[id as keyof ClientList] ?? '');
  }, [clientNames, formatTime]);
  const widths = useAdaptiveColumns({ layout: 'clients', columns, data, visibility: columnVisibility, density, manualSizing: columnSizing, text: widthText, actions: true });

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
    enableSorting: false,
    enableColumnOrdering: true,
    enableRowActions: true,
    enableCellActions: true,
    enableClickToCopy: window.isSecureContext,
    enableGlobalFilter: false,
    columnFilterDisplayMode: 'popover',
    enableColumnFilterModes: true,
    enableColumnPinning: true,
    enableColumnDragging: false,
    enableKeyboardShortcuts: false,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    muiFilterDateTimePickerProps: {
      ampm: false,
      timezone: timeZone,
      format: 'yyyy-MM-dd HH:mm',
    },
    muiPaginationProps: {
      disabled: isRefetching,
    },
    muiToolbarAlertBannerProps: isError
      ? {
        color: 'error',
        children: errorMsg,
      }
      : undefined,
    onColumnFilterFnsChange: (updater) => {
      pageCursor.current = null;
      totalCountFromParams.current = false;
      setColumnFilterFns(updater);
      setPagination((previous) => ({ ...previous, pageIndex: 0 }));
    },
    onColumnFiltersChange: (filters) => {
      pageCursor.current = null;
      totalCountFromParams.current = false;
      setColumnFilters(filters);
      setPagination((previous) => ({ ...previous, pageIndex: 0 }));
    },
    onGlobalFilterChange: (filters: React.SetStateAction<string>) => {
      setGlobalFilter(filters);
    },
    onPaginationChange: (updaterOrValue) => {
      const newPagination =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(pagination)
          : updaterOrValue;
      if (newPagination.pageSize !== pagination.pageSize) pageCursor.current = null;
      setPagination(newPagination);
      saveTablePreference(PAGINATION_KEY, newPagination);
    },
    onSortingChange: setSorting,
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
    renderTopToolbarCustomActions: () => (
      <Tooltip arrow title={t("Refresh Data")}>
        <span>
          <IconButton
            aria-label={t('Refresh Data')}
            disabled={isRefetching}
            onClick={() => {
              pageCursor.current = null;
              refreshClientIdentities();
              refetch().catch((_error: unknown) => {
                // NOOP
              });
            }
            }>
            <RefreshIcon />
          </IconButton>
        </span>
      </Tooltip>
    ),
    renderRowActionMenuItems: ({ closeMenu, row, table }) => {
      return [
        renderRowMenuItem(closeMenu, row, table),
      ];
    },
    renderCellActionMenuItems: ({ closeMenu, cell, row, table, internalMenuItems }) => {
      return [
        renderCellMenuItem(closeMenu, cell, row, table),
        ...internalMenuItems,
      ];
    },
    muiLinearProgressProps: {
      color: 'primary',
      variant: 'determinate',
      value: isRefetching ? 50 : 100,
    },
    rowCount: meta?.totalRowCount ?? 0,
    initialState: {
      columnVisibility,
      columnSizing,
      columnPinning: {
        right: isActionAlignRight ? ['mrt-row-actions'] : [],
      },
    },
    state: {
      density,
      columnFilters,
      columnFilterFns,
      globalFilter,
      isLoading,
      pagination,
      columnVisibility: widths.columnVisibility,
      columnSizing: widths.columnSizing,
      showAlertBanner: isError,
      showProgressBars: isRefetching,
      showSkeletons: isLoading,
      sorting,
    },
    mrtTheme: (_theme) => ({
      baseBackgroundColor,
    }),
  });

  return (<><MaterialReactTable table={table} />{editingClient && <ClientNameDialog key={editingClient.id} client={editingClient} onClose={() => { setEditingClient(null); }} />}</>);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      gcTime: 0,
      retry: false,
    },
  },
});


export function ClientsTable(): React.JSX.Element {

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
    <QueryClientProvider client={queryClient}>
      <SnackbarProvider
        anchorOrigin={state}
        maxSnack={5} autoHideDuration={6000}>
        <Card>
          <React.Suspense fallback={null}><TableClients /></React.Suspense>
        </Card>
      </SnackbarProvider>
    </QueryClientProvider>
  );
}
