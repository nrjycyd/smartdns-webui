"use client";

import * as React from 'react';

import '@/styles/global.css';

import { UserProvider } from '@/contexts/user-context';
import { LocalizationProvider } from '@/components/core/localization-provider';
import { ThemeProvider } from '@/components/core/theme-provider/theme-provider';
import { PwaProvider } from '@/components/core/pwa-provider';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps): React.JSX.Element {
  return (
    <html lang="en">
      <head>
        <title>SmartDNS</title>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon-v2.png" />
        <meta name="application-name" content="SmartDNS" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="SmartDNS" />
      </head>
      <body>
        <LocalizationProvider>
          <UserProvider>
            <ThemeProvider><PwaProvider>{children}</PwaProvider></ThemeProvider>
          </UserProvider>
        </LocalizationProvider>
      </body>
    </html>
  );
}
