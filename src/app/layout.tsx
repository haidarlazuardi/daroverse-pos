import type { Metadata, Viewport } from 'next';
import './globals.css';
import SWRegister from '@/components/SWRegister';

export const metadata: Metadata = {
  title: 'Daroverse POS',
  description: 'Production-ready F&B Point of Sale System',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Daroverse POS',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#16a34a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
