import { getSiteURL } from '@/lib/get-site-url';
import { LogLevel } from '@/lib/logger';

export interface Config {
  site: { name: string; description: string; themeColor: string; url: string };
  logLevel: keyof typeof LogLevel;
}

export const config: Config = {
  site: { name: 'SmartDNS', description: '', themeColor: '#f8f9fa', url: getSiteURL() },
  logLevel: (process.env.NEXT_PUBLIC_LOG_LEVEL as keyof typeof LogLevel) ?? LogLevel.ALL,
};
