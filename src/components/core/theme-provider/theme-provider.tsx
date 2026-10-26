'use client';

import * as React from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider as MuiThemeProvider, useColorScheme } from '@mui/material/styles';
import '@/components/core/i18n';

import { createTheme } from '@/styles/theme/create-theme';
import { nevada } from '@/styles/theme/colors';

export interface ThemeProviderProps {
  children: React.ReactNode;
}

function BrowserThemeColor(): React.JSX.Element {
  const { colorScheme } = useColorScheme();

  // Use the active MUI scheme so manual overrides and system changes both
  // match the page header. React places this metadata in the document head.
  return <meta name="theme-color" content={colorScheme === 'dark' ? nevada[900] : nevada[50]} />;
}

export function ThemeProvider({ children }: ThemeProviderProps): React.JSX.Element {
  const theme = React.useMemo(() => createTheme(), []);

  return (
    <MuiThemeProvider
      theme={theme}
      defaultMode="system"
      modeStorageKey="user-color-scheme"
      colorSchemeStorageKey="smartdns-color-scheme"
      disableTransitionOnChange
    >
      <BrowserThemeColor />
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
