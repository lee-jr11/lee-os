import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { RegisterWorker } from './register-worker';
import './globals.css';
export const metadata: Metadata = { title: 'LeeOS | Foundation', description: 'Lee’s automation workshop', appleWebApp: { capable: true, title: 'LeeOS' } };
export const viewport: Viewport = { themeColor: '#102d29' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}<RegisterWorker /></body></html>;
}
