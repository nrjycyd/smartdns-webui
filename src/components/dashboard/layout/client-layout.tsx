"use client";

import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Footer from './footer';

import type { NavItemConfig } from '@/types/nav';
import { MainNav } from '@/components/dashboard/layout/main-nav';
import { SideNav } from '@/components/dashboard/layout/side-nav';
import { useTranslation } from 'react-i18next';
import { QueryLogRetained } from '@/components/dashboard/query-log/query-log-retained';

interface LayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: LayoutProps): React.JSX.Element {
  const [pageTitle, setPageTitle] = React.useState("");
  const { t } = useTranslation();

  function handleActiveItem(item: NavItemConfig): void {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Expected
    React.useEffect(() => {
      if (item.title) {
        setPageTitle(t(item.title));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Expected
    }, [t, item.title]);
  }

  return (
    <Box
      sx={{
        bgcolor: 'var(--mui-palette-background-default)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        minHeight: '100%',
      }}
    >
      <SideNav onActiveItem={handleActiveItem} />
      <Box sx={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column', pl: { lg: 'var(--SideNav-width)' } }}>
        <MainNav pageTitle={pageTitle} />
        <Container maxWidth={false} sx={{ py: '32px' }}>
          <React.Suspense fallback={null}><QueryLogRetained>{children}</QueryLogRetained></React.Suspense>
        </Container>
        <Footer />
      </Box>
    </Box>
  );
}
