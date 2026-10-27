'use client';

import * as React from 'react';
import { AuthorError, smartdnsServer } from '@/lib/backend/server';
import { useUser } from '@/hooks/use-user';
import { useGroupAppearance } from '../query-log/group-label';
import { createGroupCountClient } from './group-trend-data';

interface TrendContextValue {
  client: ReturnType<typeof createGroupCountClient>;
  groups: string[];
  ready: boolean;
}
const GroupTrendContext = React.createContext<TrendContextValue | undefined>(undefined);

export function GroupTrendProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { groups: appearances, knownGroups, ready: appearancesReady } = useGroupAppearance();
  const { checkSessionError } = useUser();
  const client = React.useMemo(() => createGroupCountClient(async (query, signal) => {
    const result = await smartdnsServer.GetQueryLogs(query, signal);
    if (result.error) {
      if (result.error instanceof AuthorError) await checkSessionError?.(result.error);
      throw result.error;
    }
    if (!result.data || !Number.isSafeInteger(result.data.total_count) || result.data.total_count < 0) throw new Error('Invalid group count response');
    return result.data.total_count;
  }), [checkSessionError]);
  const groups = React.useMemo(() => [...new Set([...Object.keys(appearances), ...knownGroups])].toSorted(), [appearances, knownGroups]);
  const value = React.useMemo(() => ({ client, groups, ready: appearancesReady }), [client, groups, appearancesReady]);
  return <GroupTrendContext.Provider value={value}>{children}</GroupTrendContext.Provider>;
}

export function useGroupTrendSettings(): TrendContextValue {
  const value = React.useContext(GroupTrendContext);
  if (!value) throw new Error('Missing group trend provider');
  return value;
}
