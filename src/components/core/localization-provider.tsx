'use client';

import * as React from 'react';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { moment } from '@/lib/display-time';
import { LocalizationProvider as Provider } from '@mui/x-date-pickers/LocalizationProvider';

export interface LocalizationProviderProps {
  children: React.ReactNode;
}

export function LocalizationProvider({ children }: LocalizationProviderProps): React.JSX.Element {
  return <Provider dateAdapter={AdapterMoment} dateLibInstance={moment}>{children}</Provider>;
}
