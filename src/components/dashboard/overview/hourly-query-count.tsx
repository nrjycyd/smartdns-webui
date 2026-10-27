"use client";

import * as React from 'react';
import Box from '@mui/material/Box';
import { useColorScheme, type SxProps } from '@mui/material/styles';
import { smartdnsServer } from '@/lib/backend/server';
import type { HourlyQueryCountResponse } from '@/lib/backend/server';
import { useUser } from '@/hooks/use-user';
import { CardLoading } from './card-loading';
import { type ActiveElement, Chart, type ChartEvent, registerables } from 'chart.js';
import { useTranslation } from 'react-i18next';
import { FindInPageOutlined } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { Line } from 'react-chartjs-2';
import annotationPlugin from 'chartjs-plugin-annotation';
import { paths } from '@/paths';
import { useRouter } from 'next/navigation';
import { statisticsTime } from '@/lib/display-time';
import { useTimeDisplay } from '../layout/time-display-provider';
import { useGroupAppearance } from '../query-log/group-label';
import { GroupTrendControls } from './group-trend-controls';
import { useGroupTrends } from './use-group-trends';
import { groupTrendColor } from './group-trend-colors';
import { groupTrendLegendLabels, toggleGroupTrendLegend } from './group-trend-legend';

Chart.register(...registerables);
Chart.register(annotationPlugin);

export interface HourlyQueryCountProps {
  queryCount: HourlyQueryCountResponse;
  setTitle: (title: string) => void;
  setTitleAction: (action: React.ReactNode) => void;
  sx?: SxProps;
}

function HourlyQueryCountTable({ queryCount, setTitle, setTitleAction }: HourlyQueryCountProps): React.JSX.Element {
  const { timeZone, statisticsTimeZone, formatTime } = useTimeDisplay();
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { groups: appearances } = useGroupAppearance();
  const series = React.useMemo(() => queryCount.hourly_query_count.slice(0, 24), [queryCount.hourly_query_count]);
  const buckets = React.useMemo(() => series.map(bucket => {
    const start = statisticsTime(bucket.hour, statisticsTimeZone).valueOf();
    return { start, end: Math.min(start + 3600000, queryCount.query_timestamp) };
  }), [series, statisticsTimeZone, queryCount.query_timestamp]);
  const trend = useGroupTrends(buckets, true, statisticsTimeZone);
  const { loading: groupsLoading, failed: groupFailures, enabled: groupsEnabled, refresh: refreshGroups, stop: stopGroups } = trend;
  const colors = React.useMemo(() => trend.groups.map(group => groupTrendColor(group, appearances, colorScheme === 'dark')), [trend.groups, appearances, colorScheme]);
  const myChartRef = React.useRef<Chart<'line'> | null>(null);
  const [isRangeReady, setIsRangeReady] = React.useState(false);
  const [selectedRange, setSelectedRange] = React.useState<{ start: number, end: number } | null>(null);

  React.useEffect(() => {
    setTitle("Hourly Query Count");
    setTitleAction(
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <GroupTrendControls trend={{ loading: groupsLoading, failed: groupFailures, enabled: groupsEnabled, refresh: refreshGroups, stop: stopGroups }} />
      <IconButton aria-label={t('Query Log')} title={t('Query Log')}
        onClick={(): void => {
          const queryCountList = series;
          const queryTimestamp = queryCount.query_timestamp;

          let start = selectedRange?.start ?? -1;
          let end = selectedRange?.end ?? -1;

          let includeNextRange = false;
          if (start > end) {
            [start, end] = [end, start];
          }


          if (start === -1) {
            start = 0;
          }

          if (end === -1) {
            end = queryCountList.length - 1;
            includeNextRange = true;
          }

          if (queryCountList.length === 0) {
            return;
          }
          
          const endDate = queryCountList[start].hour;
          const startDate = queryCountList[end].hour;

          const startTimestamp = statisticsTime(startDate, statisticsTimeZone).valueOf();
          let endTimestamp = statisticsTime(endDate, statisticsTimeZone).valueOf();

          let totalCount = 0;
          for (let i = end; i > start; i--) {
            totalCount += queryCountList[i].query_count;
          }

          if (startTimestamp === endTimestamp || includeNextRange) {
            totalCount += queryCountList[start].query_count;
            includeNextRange = true;
          }

          if (includeNextRange) {
            endTimestamp += 3600000;
          }

          if (endTimestamp > queryTimestamp) {
            endTimestamp = queryTimestamp;
          }

          const url = `${paths.dashboard.queryLog}?timestamp_before=${endTimestamp}&timestamp_after=${startTimestamp}&total_count=${totalCount}`;
          router.push(url);
        }}
      >
        <FindInPageOutlined />
      </IconButton>
      </Box>
    );
  }, [setTitle, setTitleAction, selectedRange, router, queryCount, statisticsTimeZone, series, t, groupsLoading, groupFailures, groupsEnabled, refreshGroups, stopGroups]);

  const handleClick = (event: ChartEvent, _elements: ActiveElement[], chart: Chart): void => {
    const area = chart.chartArea;
    if (event.x === null || event.y === null || event.x < area.left || event.x > area.right || event.y < area.top || event.y > area.bottom) return;
    const xScale = chart.scales['x'];
    const x = Math.max(0, Math.min(series.length - 1, Math.round(xScale.getValueForPixel(event.x) ?? 0)));

    if (isRangeReady) {
      setSelectedRange(null);
      setIsRangeReady(false);
      return;
    }

    if (selectedRange === null) {
      setSelectedRange({ start: x, end: x });
      return;
    }

    setSelectedRange({ start: selectedRange.start, end: x });
    setIsRangeReady(true);
  };

  return (<><Box
    sx={{
      height: '260px',
    }}>
    <Line
      ref={myChartRef}
      data={{
        labels: series.map((data) => {
          return formatTime(statisticsTime(data.hour, statisticsTimeZone).valueOf(), 'HH:mm');
        }),
        datasets: [
          {
            label: t('Total'),
            data: series.map((data) => data.query_count),
            fill: false,
            borderColor: colorScheme === 'dark' ? '#aab4c0' : '#6b7280',
            borderDash: [5, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.1,
          },
          ...trend.groups.map((group, index) => ({
            label: group,
            data: buckets.map(bucket => trend.counts[group]?.[bucket.start] ?? null),
            borderColor: colors[index],
            backgroundColor: colors[index],
            borderWidth: 2,
            pointRadius: 1.5,
            pointHoverRadius: 4,
            tension: 0.1,
            fill: false,
            spanGaps: false,
          })),
        ],
      }}
      options={{
        animation: {
          duration: 400,
        },
        scales: {
          x: {
            reverse: true,
            ticks: {},
          }
        },
        layout: {
          padding: {
            right: 15,
          },
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            onClick: toggleGroupTrendLegend,
            labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 24, font: { size: 11 }, generateLabels: groupTrendLegendLabels },
          },
          annotation: {
            annotations: {
              box1: {
                type: 'box',
                display: selectedRange !== null,
                xMin: selectedRange?.start ?? 0,
                xMax: selectedRange?.end ?? 0,
                backgroundColor: 'rgba(30, 30, 30, 0.25)'
              }
            },
          },
          tooltip: {
            displayColors: true,
            callbacks: {
              title: (items) => {
                if (items.length === 0) return '';
                const bucket = series[items[0].dataIndex];
                return bucket ? `${formatTime(statisticsTime(bucket.hour, statisticsTimeZone).valueOf())} · ${timeZone}` : '';
              },
            },
          },
        },
        maintainAspectRatio: false,
        onClick: handleClick,
      }}
    />
  </Box></>);
}

export function HourlyQueryCountCard(sx: SxProps): React.JSX.Element {
  const { checkSessionError } = useUser();
  const [queryCount, setQueryCount] = React.useState<HourlyQueryCountResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const { t } = useTranslation();
  const [title, setTitle] = React.useState<string>("");
  const [titleAction, setTitleAction] = React.useState<React.ReactNode | null>(null);
  const isMounted = React.useRef(true);

  React.useEffect(() => {
    const fetchData = async (): Promise<void> => {
      if (!isMounted.current) {
        return;
      }

      const data = await smartdnsServer.GetHourlyQueryCount();
      if (data.error) {
        await checkSessionError?.(data.error);
        setErrorMsg(smartdnsServer.getErrorMessage(data.error));
        setTimeout(fetchData, 3000);
        return;
      }

      if (data.data === null || data.data === undefined) {
        return;
      }

      setQueryCount(data.data);
      setLoading(false);
      setErrorMsg(null);
    };

    void fetchData();
    const fetchTimer = setInterval(fetchData, 60000);

    return (): void => {
      clearInterval(fetchTimer);
      isMounted.current = false;
    };
  }, [checkSessionError]);

  return (<Box>
    <CardLoading title={t(title)}
      titleAction={titleAction}
      isLoading={loading}
      errorMsg={errorMsg}>
      {queryCount ? <HourlyQueryCountTable queryCount={queryCount} sx={sx} setTitle={setTitle} setTitleAction={setTitleAction} /> : null}
    </CardLoading>
  </Box>);
}
