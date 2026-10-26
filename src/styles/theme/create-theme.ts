import { createTheme as MuiCreateTheme, type Theme as MuiTheme } from '@mui/material/styles';

import { colorSchemes } from './color-schemes';
import { components } from './components/components';
import { shadows } from './shadows';
import { typography } from './typography';

declare module '@mui/material/styles' {
  interface PaletteRange {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
  }

  interface Palette {
    neutral: PaletteRange;
  }

  interface ToolBarPalette {
    color: string;
    background: string;
    title: {
      color: string;
      background: string;
    };
    navItem: {
      color: string;
      hoverBackground: string;
      activeBackground: string;
      activeColor: string;
      disabledColor: string;
      iconColor: string;
      iconActiveColor: string;
      iconDisabledColor: string;
    };
  }

  interface DashboardPalette {
    color: string;
    chartTotalQueries: string;
    chartBlockedQueries: string;
    chartQueryPerSecond: string;
    chartCacheHitRate: string;
    chartCacheNumber: string;
    chartAverageQueryTime: string;
  }

  interface PaletteOptions {
    neutral?: PaletteRange;
    toolbar?: ToolBarPalette;
    dashboard?: DashboardPalette;
  }

  interface TypeBackground {
    level1: string;
    level2: string;
    level3: string;
  }
}

export function createTheme(): MuiTheme {
  const theme = MuiCreateTheme({
    breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1440 } },
    components,
    colorSchemes,
    cssVariables: {
      colorSchemeSelector: "class"
    },
    shadows,
    shape: { borderRadius: 8 },
    typography,
  });

  return theme;
}
