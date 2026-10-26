import type { CssVarsTheme, Theme as BaseTheme } from '@mui/material/styles';

export type Theme = Omit<BaseTheme, 'palette'> & CssVarsTheme;

export type ColorScheme = 'dark' | 'light';
