'use client';

import * as React from 'react';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { LocalizationProvider as Provider } from '@mui/x-date-pickers/LocalizationProvider';

export interface LocalizationProviderProps {
  children: React.ReactNode;
}

export function LocalizationProvider({ children }: LocalizationProviderProps): React.JSX.Element {
  return <Provider dateAdapter={AdapterLuxon}>{children}</Provider>;
}
