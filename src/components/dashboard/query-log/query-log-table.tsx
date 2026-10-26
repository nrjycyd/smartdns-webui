"use client"

import * as React from 'react';
import { useMemo, useState } from 'react';
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
import { Box, Card, IconButton, Tooltip, Chip } from '@mui/material';
import { createTheme, useColorScheme } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import dayjs from 'dayjs';
import {
  QueryClient,
  QueryClientProvider,
  keepPreviousData,
  useQuery,
} from '@tanstack/react-query';

import { type DomainList, type QueryLogsParams, smartdnsServer } from '@/lib/backend/server';
import { useUser } from '@/hooks/use-user';
import { useTranslation } from 'react-i18next';
import { MRT_Localization_EN } from 'material-react-table/locales/en';
import { MRT_Localization_ZH_HANS } from 'material-react-table/locales/zh-Hans';
import i18n from '@/components/core/i18n';
import { Delete, Domain } from '@mui/icons-material';
import { type SnackbarOrigin, SnackbarProvider, useSnackbar } from 'notistack';
import { getDomainTypeName, getDomainTypeId } from './domain-type';
import { QueryClientIdentityCell } from './client-identity-cell';
import { useRefreshClientIdentities } from '@/components/dashboard/clients/client-identity-provider';
import { QUERY_CLIENT_ADDRESS_WIDTH_SAMPLES } from './client-address';
import { GroupLabel, useGroupAppearance } from './group-label';
import { useTableDensityPreview } from '@/components/dashboard/layout/table-density-provider';
import { useAdaptiveColumns } from '@/components/dashboard/layout/use-adaptive-columns';
import { singleLineCellSx, singleLineHeaderSx } from '@/components/dashboard/layout/column-widths';


interface UserApiResponse {
  data: DomainList[];
  meta: {
    totalRowCount: number;
  };
};

interface PageCursor {
  pageNumber: number;
  firstID: number;
  lastID: number;
}


function TableQueryLogs(): React.JSX.Element {
  const [density, previewDensity] = useTableDensityPreview();
  const { t } = useTranslation();
  const { refresh: refreshGroupAppearance, registerGroups } = useGroupAppearance();
  const refreshClientIdentities = useRefreshClientIdentities();

  const columns = useMemo<MRTColumnDef<DomainList>[]>(
    () => [
      {
        accessorKey: 'id',
        header: t('ID'),
        size: 110,
        enableColumnActions: false,
        columnFilterModeOptions: ['equals'],
      },
      {
        accessorKey: 'domain',
        header: t('Domain'),
        size: 360,
        enableColumnActions: false,
        columnFilterModeOptions: ['contains', 'equals'],
        muiTableBodyCellProps: {
          sx: singleLineCellSx,
        },
        Cell: ({ cell, renderedCellValue }) => (
          <Tooltip title={cell.getValue<string>()} arrow placement="top">
            <span>{renderedCellValue}</span>
          </Tooltip>
        ),
      },
      {
        accessorKey: 'domain_type',
        header: t('Type'),
        size: 90,
        enableColumnActions: false,
        columnFilterModeOptions: ['equals'],
        Cell: ({ cell }) => {
          const type = cell.getValue<number>();
          return (
            <Tooltip title={type} arrow placement="top">
              <span>{getDomainTypeName(type)}</span>
            </Tooltip>
          );
        },
      },
      {
        accessorKey: 'client',
        header: t('Client'),
        size: 330,
        enableColumnActions: false,
        enableClickToCopy: false,
        muiFilterTextFieldProps: { placeholder: t('Filter by full client IP') },
        columnFilterModeOptions: ['equals'],
        muiTableBodyCellProps: ({ table }) => ({
          title: '',
          sx: { ...singleLineCellSx, px: table.getState().density === 'compact' ? '0.25rem' : table.getState().density === 'comfortable' ? '0.5rem' : '0.75rem' },
        }),
        muiTableHeadCellProps: ({ table }) => ({
          sx: { ...singleLineHeaderSx, px: table.getState().density === 'compact' ? '0.25rem' : table.getState().density === 'comfortable' ? '0.5rem' : '0.75rem' },
        }),
        Cell: ({ cell }) => <QueryClientIdentityCell ip={cell.getValue<string>()} />,
      },
      {
        accessorKey: 'timestamp',
        header: t('Time'),
        Cell: ({ cell }) => {
          const timestamp = cell.getValue<string>();
          const localTime = new Date(timestamp).toLocaleString();
          return <span>{localTime}</span>;
        },
        filterVariant: 'datetime-range',
        columnFilterModeOptions: ['equals'],
        enableColumnActions: false,
        size: 120,
      },
      {
        accessorKey: 'ping_time',
        header: t('Ping'),
        size: 90,
        enableColumnActions: false,
        Cell: ({ cell }) => {
          const pingTime = cell.getValue<DomainList['ping_time']>();
          if (typeof pingTime !== 'number' || !Number.isFinite(pingTime) || pingTime < 0) {
            return (
              <Tooltip title={t('No latency data available')} arrow placement="top">
                <Box component="span" sx={{ color: 'text.disabled' }} tabIndex={0}>—</Box>
              </Tooltip>
            );
          }
          return <span>{pingTime} ms</span>;
        },
        columnFilterModeOptions: ['equals'],
      },
      {
        accessorKey: 'domain_group',
        header: t('Group'),
        columnFilterModeOptions: ['equals'],
        enableColumnActions: false,
        Cell: ({ cell }) => <GroupLabel group={cell.getValue<string | null | undefined>()} />,
      },
      {
        accessorKey: 'is_blocked',
        header: t('Is Blocked'),
        size: 150,
        filterVariant: 'select',
        enableColumnFilterModes: false,
        filterSelectOptions: [
          { value: '', label: t('All') },
          { value: 'true', label: t('Blocked') },
          { value: 'false', label: t('Allowed') },
        ],
        filterFn: (row, _id, value) => {
          if (value === '') return true;
          return row.original.is_blocked === (value === 'true');
        },
        Cell: ({ cell }) =>
          cell.getValue<boolean>()
            ? <Chip label={t('Blocked')} color="error" size="small" />
            : <Chip label={t('Allowed')} color="success" size="small" variant="outlined" />,
        muiFilterTextFieldProps: {
          sx: {
            '& .MuiInputAdornment-positionEnd': {
              display: 'none',
            },
          },
        },
        enableColumnActions: false,
      },
      {
        accessorKey: 'is_cached',
        header: t('Cache Hit'),
        size: 150,
        enableColumnFilter: false,
        enableColumnFilterModes: false,
        enableColumnActions: false,
        Cell: ({ cell }) => {
          const isCached = cell.getValue<DomainList['is_cached']>();
          if (isCached === true) {
            return <Chip label={t('Yes')} color="success" size="small" />;
          }
          if (isCached === false) {
            return <Chip label={t('No')} size="small" variant="outlined" />;
          }
          return <Chip label={t('Unknown')} size="small" variant="outlined" />;
        },
      },
      {
        accessorKey: 'query_time',
        header: t('Query Time'),
        Cell: ({ cell }) => {
          const queryTime = cell.getValue<number>();
          return <span>{queryTime} ms</span>;
        },
        columnFilterModeOptions: ['equals'],
        enableColumnActions: false,
      },
      {
        accessorKey: 'reply_code',
        header: t('Reply Code'),
        columnFilterModeOptions: ['equals'],
        enableColumnActions: false,
      },
    ],
    [t],
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
  const lastPage = React.useRef(0);
  const pageCursor = React.useRef<PageCursor | null>(null);

  // Load saved pagination settings
  const PAGINATION_KEY = 'querylog-table-pagination';
  const savedPagination = localStorage.getItem(PAGINATION_KEY);
  let jsonParsedPagination: MRTPaginationState = { pageIndex: 0, pageSize: 10 };

  try {
    if (savedPagination) {
      jsonParsedPagination = JSON.parse(savedPagination) as MRTPaginationState;
    }
  } catch {
    localStorage.removeItem(PAGINATION_KEY);
    jsonParsedPagination = { pageIndex: 0, pageSize: 10 };
  }

  const [pagination, setPagination] = useState<MRTPaginationState>({
    pageIndex: 0,
    pageSize: jsonParsedPagination.pageSize,
  });
  const [totalRowCount, setTotalRowCount] = useState(0);
  const totalCountFromParams = React.useRef(false);

  const [tableLocales, setTableLocales] = useState(MRT_Localization_EN);
  const { enqueueSnackbar } = useSnackbar();
  let isActionAlignRight = false;

  if (window.innerWidth >= 1200) {
    isActionAlignRight = true;
  }

  React.useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const filters: MRTColumnFiltersState = [];

    const timestamp: (dayjs.Dayjs | undefined)[] = [undefined, undefined];
    let existTimestamp = false;
    for (const [key, value] of searchParams.entries()) {
      if (key === 'timestamp_after') {
        const v = dayjs(Number(value));
        if (v.isValid()) {
          timestamp[0] = v;
          existTimestamp = true;
        }

        continue;
      }

      if (key === 'timestamp_before') {
        const v = dayjs(Number(value));
        if (v.isValid()) {
          timestamp[1] = v;
          existTimestamp = true;
        }

        continue;
      }

      if (key === 'total_count') {
        totalCountFromParams.current = true;
        setTotalRowCount(Number(value));
        continue;
      }

      if (!columns.some((column) => column.accessorKey === key)) {
        continue;
      }

      filters.push({ id: key, value });
    }

    if (existTimestamp) {
      filters.push({ id: 'timestamp', value: timestamp });
    }

    setColumnFilters(filters);
    if (!shouldFetchData) {
      setShouldFetchData(true);
    }
  }, [shouldFetchData, columns]);

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
    queryFn: async () => {
      const currentPageNumber = pagination.pageIndex + 1;
      const queryParam: QueryLogsParams = {
        'page_num': currentPageNumber,
        'page_size': pagination.pageSize,
      };

      if (totalCountFromParams.current) {
        totalCountFromParams.current = false;
        queryParam['total_count'] = totalRowCount;
      }

      if (pageCursor.current !== null && pageCursor.current !== undefined) {
        if (currentPageNumber > lastPage.current && currentPageNumber === lastPage.current + 1) {
          if (pageCursor.current.lastID >= 0) {
            queryParam['cursor'] = pageCursor.current.lastID;
            queryParam['total_count'] = totalRowCount;
            queryParam['cursor_direction'] = 'next';
          }
        } else if (currentPageNumber < lastPage.current && currentPageNumber === lastPage.current - 1) {
          if (pageCursor.current.firstID >= 0) {
            queryParam['cursor'] = pageCursor.current.firstID;
            queryParam['total_count'] = totalRowCount;
            queryParam['cursor_direction'] = 'prev';
          }
        }
      }

      lastPage.current = currentPageNumber;

      for (const filter of columnFilters) {
        if (filter.id === null || filter.id === undefined || filter.value === null || filter.value === undefined) {
          continue;
        }

        const filterMode = columnFilterFns[filter.id];
        if (filter.id === 'domain' && filterMode === 'contains') {
          queryParam['domain_filter_mode'] = filterMode as string;
        }

        if (filter.id === 'timestamp') {
          const timerange = filter.value as string[];
          if (timerange.length === 2) {
            if (timerange[0]) {
              queryParam['timestamp_after'] = new Date(timerange[0]).getTime();
            }

            if (timerange[1]) {
              queryParam['timestamp_before'] = new Date(timerange[1]).getTime();
            }
          }
        }
        const filterId = filter.id as keyof QueryLogsParams;
        if (filter.id === 'domain_type') {
          const raw = filter.value as string;
          const resolved = /^\d+$/.test(raw)
            ? Number(raw)
            : getDomainTypeId(raw.toUpperCase());
          if (resolved !== undefined) {
            queryParam[filterId] = String(resolved);
          }
        } else {
          queryParam[filterId] = filter.value as string;
        }
      }

      const data = await smartdnsServer.GetQueryLogs(queryParam);
      if (data.error) {
        await checkSessionError?.(data.error);
        setErrorMsg(smartdnsServer.getErrorMessage(data.error));
        throw new Error(errorMsg);
      }

      if (data.data === null || data.data === undefined) {
        setErrorMsg('Error loading data');
        throw new Error(errorMsg);
      }

      let totalCount = 0;
      if (data.data.total_count > 0 && data.data.domain_list.length > 0) {
        const newPageCursor: PageCursor = {
          firstID: data.data.domain_list[0].id,
          lastID: data.data.domain_list.at(-1)!.id,
          pageNumber: currentPageNumber + 1,
        };

        pageCursor.current = newPageCursor;
        totalCount = data.data.total_count;
      }

      setTotalRowCount(totalCount)
      const resp: UserApiResponse = {
        data: data.data.domain_list,
        meta: {
          totalRowCount: totalCount,
        },
      };

      return resp;
    },
    placeholderData: keepPreviousData,
  });

  React.useEffect(() => { registerGroups(data.map((row) => row.domain_group)); }, [data, registerGroups]);

  React.useEffect(() => {
    if (i18n.language === null || i18n.language === undefined) {
      return;
    }

    if (i18n.language === 'zh-CN') {
      setTableLocales(MRT_Localization_ZH_HANS);
    } else {
      setTableLocales(MRT_Localization_EN);
    }
  }, []);

  const handleRowWhois = React.useCallback(async (row: MRTRow<DomainList>) => {
    const domain = row.original.domain;

    const ret = await smartdnsServer.GetWhois(domain);
    if (ret.error) {
      enqueueSnackbar(`Error: ${t(smartdnsServer.getErrorMessage(ret.error))}`);
      return;
    }

    if (ret.data === null || ret.data === undefined) {
      enqueueSnackbar(`Error: ${t('No data returned.')}`);
      return;
    }

    const whoisData = ret.data;
    let msg = "";
    let domainMsg = "";
    if (whoisData.domain.length > 0) {
      domainMsg += `${t('Domain')}: ${whoisData.domain}\n`;
    }

    if (whoisData.organization.length > 0) {
      msg += `${t('Organization')}: ${whoisData.organization}\n`;
    }

    if (whoisData.registrar.length > 0) {
      msg += `${t('Registrar')}: ${whoisData.registrar}\n`;
    }

    if (whoisData.country.length > 0) {
      msg += `${t('Country')}: ${whoisData.country}\n`;
    }

    if (msg.length === 0) {
      msg = t('Whois data not available');
    }

    enqueueSnackbar(domainMsg + msg, { style: { whiteSpace: 'pre-line' } });
  }, [t, enqueueSnackbar]);

  const handleRowDelete = React.useCallback(async (row: MRTRow<DomainList>) => {
    const id = row.original.id;
    const domain = row.original.domain;
    const ret = await smartdnsServer.DeleteQueryLogById(id);
    if (ret.error) {
      enqueueSnackbar(`${t('Error')}: ${t(smartdnsServer.getErrorMessage(ret.error))}, id: ${id}`, { variant: 'error' });
      return;
    }

    enqueueSnackbar(t('Delete query log {{id}} {{domain}} successfully.', { id, domain }), { variant: 'success' });
  }, [t, enqueueSnackbar]);

  const renderRowMenuItem = (closeMenu: () => void, row: MRTRow<DomainList>, table: MRTTableInstance<DomainList>): React.ReactNode[] => (
    [
      <MRTActionMenuItem
        icon={<Domain />}
        key="whois"
        label={t('whois')}
        onClick={async (e) => { e.preventDefault(); closeMenu(); await handleRowWhois(row); }}
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

  const renderCellMenuItem = (closeMenu: () => void, _cell: MRTCell<DomainList>, row: MRTRow<DomainList>, table: MRTTableInstance<DomainList>): React.ReactNode[] => (
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

  const COLUMN_VISIBILITY_KEY = 'querylog-table-column-visibility';
  const COLUMN_SIZING_KEY = 'querylog-table-column-sizing';

  const savedColumnVisibility = localStorage.getItem(COLUMN_VISIBILITY_KEY);
  const savedColumnSizing = localStorage.getItem(COLUMN_SIZING_KEY);

  let jsonParsedColumnVisibility: Record<string, boolean> = {};
  let jsonParsedColumnSizing: Record<string, number> = {};

  try {
    if (savedColumnVisibility) {
      jsonParsedColumnVisibility = JSON.parse(savedColumnVisibility) as Record<string, boolean>;
    }
  } catch {
    localStorage.removeItem(COLUMN_VISIBILITY_KEY);
    jsonParsedColumnVisibility = {};
  }

  try {
    if (savedColumnSizing) {
      jsonParsedColumnSizing = JSON.parse(savedColumnSizing) as Record<string, number>;
    }
  } catch {
    localStorage.removeItem(COLUMN_SIZING_KEY);
    jsonParsedColumnSizing = {};
  }

  const initialColumnVisibility = jsonParsedColumnVisibility || {
    "id": false,
    "is_blocked": false,
    "domain_group": false,
    "query_time": false,
    "reply_code": false,
  };
  const [columnVisibility, setColumnVisibility] = React.useState(initialColumnVisibility);
  const [columnSizing, setColumnSizing] = React.useState(jsonParsedColumnSizing);

  const widthText = React.useCallback((row: DomainList, id: string) => {
    if (id === 'timestamp') return new Date(row.timestamp).toLocaleString();
    if (id === 'domain_type') return getDomainTypeName(row.domain_type);
    if (id === 'domain_group') return row.domain_group || t('Default');
    if (id === 'is_blocked') return t(row.is_blocked ? 'Blocked' : 'Allowed');
    if (id === 'is_cached') return t(row.is_cached === true ? 'Yes' : row.is_cached === false ? 'No' : 'Unknown');
    if (id === 'ping_time') return typeof row.ping_time === 'number' && row.ping_time >= 0 ? `${row.ping_time} ms` : '—';
    if (id === 'query_time') return `${row.query_time} ms`;
    return String(row[id as keyof DomainList] ?? '');
  }, [t]);
  const widthReferences = React.useMemo(() => ({
    id: ['99999999'],
    domain: [],
    domain_type: ['AAAA', 'HTTPS'],
    client: QUERY_CLIENT_ADDRESS_WIDTH_SAMPLES,
    timestamp: [new Date(8888, 10, 28, 11, 59, 59).toLocaleString(), new Date(8888, 10, 28, 23, 59, 59).toLocaleString()],
    ping_time: ['999.9 ms'],
    domain_group: ['DIRECT', 'PROXY', 'REJECT', t('Default')],
    is_blocked: [t('Blocked'), t('Allowed')],
    is_cached: [t('Yes'), t('No'), t('Unknown')],
    query_time: ['9999.9 ms'],
    reply_code: ['4095'],
  }), [t]);
  const widths = useAdaptiveColumns({ layout: 'query-log', columns, data, visibility: columnVisibility, density, manualSizing: columnSizing, text: widthText, referenceText: widthReferences, actions: true, optionalColumn: 'reply_code' });

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
    onColumnFilterFnsChange: setColumnFilterFns,
    onColumnFiltersChange: (filters) => {
      pageCursor.current = null;
      setColumnFilters(filters);
    },
    onGlobalFilterChange: (filters: React.SetStateAction<string>) => {
      pageCursor.current = null;
      setGlobalFilter(filters);
    },
    onPaginationChange: (updaterOrValue) => {
      const newPagination =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(pagination)
          : updaterOrValue;
      setPagination(newPagination);
      localStorage.setItem(PAGINATION_KEY, JSON.stringify(newPagination));
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: (updaterOrValue) => {
        setColumnVisibility((prev) => {
          const newVisibility =
              typeof updaterOrValue === 'function'
                  ? updaterOrValue(prev)
                  : updaterOrValue;
          localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(newVisibility));
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
          localStorage.setItem(COLUMN_SIZING_KEY, JSON.stringify(newSizing));
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
              refreshGroupAppearance();
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
      ]
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
      pagination: {
        pageIndex: 0,
        pageSize: jsonParsedPagination.pageSize,
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

  return (<MaterialReactTable table={table} />);
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


export function QueryLogTable(): React.JSX.Element {

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
          <TableQueryLogs />
        </Card>
      </SnackbarProvider>
    </QueryClientProvider>
  );
}
