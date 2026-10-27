'use client';

import * as React from 'react';
import { IconButton } from '@mui/material';
import { RefreshOutlined, StopCircleOutlined } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useGroupTrendSettings } from './group-trend-provider';
import type { useGroupTrends } from './use-group-trends';

export function GroupTrendControls({ trend }: { trend: Pick<ReturnType<typeof useGroupTrends>, 'loading' | 'failed' | 'enabled' | 'refresh' | 'stop'> }): React.JSX.Element {
  const { t } = useTranslation();
  const { groups, ready } = useGroupTrendSettings();
  const label = t(trend.loading ? 'Stop loading' : trend.enabled ? 'Refresh group trends' : 'Load daily group trends');
  return <IconButton disabled={!ready || groups.length === 0}
    color={trend.failed > 0 ? 'warning' : 'default'} aria-label={label}
    title={trend.failed > 0 ? t('Some group counts could not be loaded. Missing points are gaps, not zero.') : label}
    onClick={trend.loading ? trend.stop : trend.refresh}>
    {trend.loading ? <StopCircleOutlined /> : <RefreshOutlined />}
  </IconButton>;
}
