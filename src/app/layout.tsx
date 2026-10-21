import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { SkipLink } from '@/components/ui/SkipLink';
import './globals.css';

export const metadata: Metadata = {
  title: {
    template: '%s | Momently',
    default: 'Momently | Elegant Event Planning Studio',
  },
  description:
    'AI-assisted celebration and milestone event planning studio with deterministic budget and contingency controls.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6B2D5C',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SkipLink />
        <LiveRegionProvider>
          <AppShell>{children}</AppShell>
        </LiveRegionProvider>
      </body>
    </html>
  );
}
