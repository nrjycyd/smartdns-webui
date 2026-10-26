'use client';

import * as React from 'react';
import { Box, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useTranslation } from 'react-i18next';

export function RankingTable({ label, counts, children }: { label: string; counts: number[]; children: React.ReactNode }): React.JSX.Element {
  const { t } = useTranslation();
  const digits = Math.max(6, ...counts.map((count) => String(count).length));

  return (
    <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
      <Table aria-label={label} sx={{
        width: '100%', tableLayout: 'fixed',
        '& .MuiTableCell-root': { height: 56, boxSizing: 'border-box', py: 2, whiteSpace: 'nowrap' },
        '& .MuiTableCell-root:first-of-type': { overflow: 'hidden' },
        '& .MuiTableCell-root:last-of-type': { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
      }}>
        <colgroup><col /><col style={{ width: `calc(${digits}ch + 32px)` }} /></colgroup>
        <TableHead><TableRow><TableCell>{label}</TableCell><TableCell>{t('Count')}</TableCell></TableRow></TableHead>
        <TableBody>{children}</TableBody>
      </Table>
    </Box>
  );
}
