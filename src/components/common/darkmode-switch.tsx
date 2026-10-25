"use client";

import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import { useColorScheme } from '@mui/material';
import { LightModeOutlined, DarkModeOutlined, SettingsBrightnessOutlined } from '@mui/icons-material';
import { NoSsr } from '../core/no-ssr';

export function DarkModeSwitch(): React.JSX.Element | null {
  const { mode, setMode } = useColorScheme();

  const handleToggleMode = (): void => {

    let newMode;
    if (mode === 'system') {
      newMode = 'dark';
    } else if (mode === 'dark') {
      newMode = 'light';
    } else {
      newMode = 'system';
    }

    setMode(newMode as 'light' | 'dark' | 'system');
  };

  return (
    <NoSsr>
      <IconButton sx={{ ml: 1 }} onClick={handleToggleMode}>
        {mode === 'light' && <LightModeOutlined />}
        {mode === 'dark' && <DarkModeOutlined />}
        {mode === 'system' && <SettingsBrightnessOutlined />}
      </IconButton>
    </NoSsr>
  );
}
