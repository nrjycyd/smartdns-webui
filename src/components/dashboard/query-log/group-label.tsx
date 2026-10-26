'use client';

import * as React from 'react';
import { Icon } from '@iconify/react';
import Box from '@mui/material/Box';
import { useColorScheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { EMPTY_GROUP_APPEARANCES, getGroupAppearance, parseGroupAppearances, type GroupAppearances } from './group-appearance';
import groupIcons from './group-icons.json';

interface GroupAppearanceContextValue {
  groups: GroupAppearances;
  refresh: () => void;
}

const GroupAppearanceContext = React.createContext<GroupAppearanceContextValue>({ groups: EMPTY_GROUP_APPEARANCES, refresh: () => {} });

export function GroupAppearanceProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { data: groups = EMPTY_GROUP_APPEARANCES, refetch } = useQuery({
    queryKey: ['group-colors'],
    queryFn: async ({ signal }) => {
      try {
        const response = await fetch('/group-colors.json', { cache: 'no-store', signal });
        if (!response.ok) return EMPTY_GROUP_APPEARANCES;
        return parseGroupAppearances(await response.text());
      } catch (error) {
        if (signal.aborted) throw error;
        return EMPTY_GROUP_APPEARANCES;
      }
    },
    staleTime: Infinity,
  });
  const value = React.useMemo(() => ({ groups, refresh: () => { void refetch(); } }), [groups, refetch]);
  return <GroupAppearanceContext.Provider value={value}>{children}</GroupAppearanceContext.Provider>;
}

export function useGroupAppearance(): GroupAppearanceContextValue {
  return React.useContext(GroupAppearanceContext);
}

export function GroupLabel({ group }: { group: string | null | undefined }): React.JSX.Element {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { groups } = useGroupAppearance();
  const name = group || 'default';
  const label = name === 'default' ? t('Default') : name;
  const appearance = getGroupAppearance(groups, name);
  if (!appearance) return <span>{label}</span>;

  const icon = appearance.icon && Object.hasOwn(groupIcons, appearance.icon)
    ? groupIcons[appearance.icon as keyof typeof groupIcons]
    : appearance.icon;

  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }} style={{ color: appearance.color, colorScheme: colorScheme === 'dark' ? 'dark' : 'light' }}>
      {icon && <Icon icon={icon} width={18} height={18} style={{ color: appearance.iconColor, flexShrink: 0 }} aria-hidden="true" />}
      <span>{label}</span>
    </Box>
  );
}
