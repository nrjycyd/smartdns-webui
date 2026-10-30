"use client";

import * as React from 'react';
import Box from '@mui/material/Box';
import { useTheme, type SxProps } from '@mui/material/styles';
import { smartdnsServer } from '@/lib/backend/server';
import type { HourlyQueryCountResponse } from '@/lib/backend/server';
import { useUser } from '@/hooks/use-user';
import { CardLoading } from './card-loading';
import { startStatisticsPolling } from './statistics-polling';
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
  const theme = useTheme();
  const myChartRef = React.useRef<Chart<'line'> | null>(null);
  const [isRangeReady, setIsRangeReady] = React.useState(false);
  const [selectedRange, setSelectedRange] = React.useState<{ start: number, end: number } | null>(null);

  React.useEffect(() => {
    setTitle("Hourly Query Count");
    setTitleAction(
      <IconButton
        onClick={(): void => {
          const queryCountList = queryCount.hourly_query_count;
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
    );
  }, [setTitle, setTitleAction, selectedRange, router, queryCount, statisticsTimeZone]);

  const handleClick = (event: ChartEvent, _elements: ActiveElement[], chart: Chart): void => {
    const xScale = chart.scales['x'];
    const x = xScale.getValueForPixel(event.x ?? 0) ?? 0;

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

  return (<Box
    sx={{
      height: '200px',
    }}>
    <Line
      ref={myChartRef}
      data={{
        labels: queryCount.hourly_query_count.map((data) => {
          return formatTime(statisticsTime(data.hour, statisticsTimeZone).valueOf(), 'HH:mm');
        }),
        datasets: [
          {
            label: t("Query Count"),
            data: queryCount.hourly_query_count.map((data) => data.query_count),
            fill: false,
            borderColor: theme.palette.primary.main,
            tension: 0.1,
          }
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
            display: false
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
            displayColors: false,
            callbacks: {
              title: (items) => {
                if (items.length === 0) return '';
                const bucket = queryCount.hourly_query_count[items[0].dataIndex];
                return bucket ? `${formatTime(statisticsTime(bucket.hour, statisticsTimeZone).valueOf())} · ${timeZone}` : '';
              },
            },
          },
        },
        maintainAspectRatio: false,
        onClick: handleClick,
      }}
    />
  </Box>);
}

// Updating the card title/action must not restart an unchanged chart's update
// animation or recreate all bucket labels. Local chart state still updates it.
const MemoizedHourlyQueryCountTable = React.memo(HourlyQueryCountTable);

export function HourlyQueryCountCard(sx: SxProps): React.JSX.Element {
  const { checkSessionError } = useUser();
  const [queryCount, setQueryCount] = React.useState<HourlyQueryCountResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const { t } = useTranslation();
  const [title, setTitle] = React.useState<string>("");
  const [titleAction, setTitleAction] = React.useState<React.ReactNode | null>(null);
  React.useEffect(() => {
    return startStatisticsPolling(async (signal) => {
      const data = await smartdnsServer.GetHourlyQueryCount(signal);
      if (signal.aborted) return true;
      if (data.error) {
        await checkSessionError?.(data.error);
        if (!signal.aborted) setErrorMsg(smartdnsServer.getErrorMessage(data.error));
        return false;
      }

      if (data.data === null || data.data === undefined) {
        return true;
      }

      setQueryCount(data.data);
      setLoading(false);
      setErrorMsg(null);
      return true;
    });
  }, [checkSessionError]);

  return (<Box>
    <CardLoading title={t(title)}
      titleAction={titleAction}
      isLoading={loading}
      errorMsg={errorMsg}>
      {queryCount ? <MemoizedHourlyQueryCountTable queryCount={queryCount} sx={sx} setTitle={setTitle} setTitleAction={setTitleAction} /> : null}
    </CardLoading>
  </Box>);
}
