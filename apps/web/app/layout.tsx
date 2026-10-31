import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Nav } from '@/components/nav';
import { safeGet } from '@/lib/api';
import type { Board, ReplayStatus } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Refrain · KOL calls become evidence before they become trades',
  description:
    'Refrain watches public Telegram market voices, tests agreement against fixed rules, and records paper positions or rejections through Chainlink CRE.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f3f5f5',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [replay, board] = await Promise.all([
    safeGet<ReplayStatus>('/api/replay/status'),
    safeGet<Board>('/api/board'),
  ]);
  return (
    <html lang="en">
      <body>
        <div className="micro-noise pointer-events-none fixed inset-0 z-[3] opacity-[0.025]" aria-hidden="true" />
        <Nav mode={replay?.mode ?? 'replay'} channels={board?.channelsMonitored ?? 0} />
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
