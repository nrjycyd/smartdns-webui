'use client';

import * as React from 'react';
import type { ServerError } from '@/lib/backend/server';

export interface QueryLogViewProps {
  search: string;
  entry: number;
  checkSessionError?: (error: ServerError) => Promise<void>;
}

// Register the route's already-loaded component without importing its heavy
// implementation into the persistent shell.
export const QueryLogViewContext = React.createContext<((view: React.ComponentType<QueryLogViewProps>) => void) | null>(null);
