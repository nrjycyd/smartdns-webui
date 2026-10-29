'use client';

import * as React from 'react';
import { Icon } from '@iconify/react';
import { BundledIcon } from '@/components/common/bundled-icon';
import { useColorScheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { EMPTY_GROUP_APPEARANCES, getGroupAppearance, GROUP_APPEARANCE_STORAGE_KEY, isGroupIconName, mergeGroupAppearances, parseGroupAppearances, parseGroupOverrides, serializeGroupOverrides, type GroupAppearances } from './group-appearance';
import groupIcons from './group-icons.json';

interface GroupAppearanceContextValue {
  groups: GroupAppearances;
  defaults: GroupAppearances;
  overrides: GroupAppearances;
  knownGroups: string[];
  ready: boolean;
  storageError: boolean;
  save: (groups: GroupAppearances) => boolean;
  registerGroups: (names: (string | null | undefined)[]) => void;
  refresh: () => void;
}

const GroupAppearanceContext = React.createContext<GroupAppearanceContextValue>({ groups: EMPTY_GROUP_APPEARANCES, defaults: EMPTY_GROUP_APPEARANCES, overrides: EMPTY_GROUP_APPEARANCES, knownGroups: [], ready: false, storageError: false, save: () => false, registerGroups: () => {}, refresh: () => {} });

export function GroupAppearanceProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [overrides, setOverrides] = React.useState<GroupAppearances>(EMPTY_GROUP_APPEARANCES);
  const [knownGroups, setKnownGroups] = React.useState<string[]>([]);
  const [hydrated, setHydrated] = React.useState(false);
  const [storageError, setStorageError] = React.useState(false);
  const { data: defaults = EMPTY_GROUP_APPEARANCES, isPending, refetch } = useQuery({
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
  React.useEffect(() => {
    function readLocal() {
      try {
        const stored = window.localStorage.getItem(GROUP_APPEARANCE_STORAGE_KEY);
        setOverrides(stored ? parseGroupOverrides(stored) : EMPTY_GROUP_APPEARANCES);
        setStorageError(false);
      } catch {
        setOverrides(EMPTY_GROUP_APPEARANCES);
        setStorageError(true);
      }
      setHydrated(true);
    }
    readLocal();
    const onStorage = (event: StorageEvent) => {
      if (event.key === GROUP_APPEARANCE_STORAGE_KEY || event.key === null) readLocal();
    };
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('storage', onStorage); };
  }, []);
  const save = React.useCallback((next: GroupAppearances) => {
    try {
      const serialized = serializeGroupOverrides(next);
      const normalized = parseGroupOverrides(serialized);
      window.localStorage.setItem(GROUP_APPEARANCE_STORAGE_KEY, serializeGroupOverrides(normalized));
      setOverrides(normalized);
      setStorageError(false);
      return true;
    } catch {
      setStorageError(true);
      return false;
    }
  }, []);
  const registerGroups = React.useCallback((names: (string | null | undefined)[]) => {
    setKnownGroups((previous) => {
      const next = new Set(previous);
      for (const name of names) next.add(name || 'default');
      return next.size === previous.length ? previous : [...next].toSorted();
    });
  }, []);
  const groups = React.useMemo(() => mergeGroupAppearances(defaults, overrides), [defaults, overrides]);
  const value = React.useMemo(() => ({ groups, defaults, overrides, knownGroups, ready: hydrated && !isPending, storageError, save, registerGroups, refresh: () => { void refetch(); } }), [groups, defaults, overrides, knownGroups, hydrated, isPending, storageError, save, registerGroups, refetch]);
  return <GroupAppearanceContext.Provider value={value}>{children}</GroupAppearanceContext.Provider>;
}

export function useGroupAppearance(): GroupAppearanceContextValue {
  return React.useContext(GroupAppearanceContext);
}

export function GroupLabel({ group, groups: previewGroups, scheme }: { group: string | null | undefined; groups?: GroupAppearances; scheme?: 'light' | 'dark' }): React.JSX.Element {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { groups } = useGroupAppearance();
  const name = group || 'default';
  const label = name === 'default' ? t('Default') : name;
  const appearance = getGroupAppearance(previewGroups ?? groups, name);
  if (!appearance) return <span>{label}</span>;

  const iconName = appearance.icon && isGroupIconName(appearance.icon) ? appearance.icon : undefined;
  const icon = iconName && Object.hasOwn(groupIcons, iconName)
    ? groupIcons[iconName as keyof typeof groupIcons]
    : iconName;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: appearance.color, colorScheme: scheme ?? (colorScheme === 'dark' ? 'dark' : 'light') }}>
      {icon && (typeof icon === 'object' ? <BundledIcon icon={icon} style={{ color: appearance.iconColor }} /> : <Icon icon={icon} width={18} height={18} style={{ color: appearance.iconColor, flexShrink: 0 }} aria-hidden="true" />)}
      <span>{label}</span>
    </span>
  );
}
