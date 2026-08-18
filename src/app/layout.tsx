import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/providers/AuthProvider';
import { SocketProvider } from '@/providers/SocketProvider';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'ConnectUs — Watch Movies Together',
    template: '%s · ConnectUs',
  },
  description:
    'Stream movies in perfect sync with friends. Real-time chat, reactions, and video calls — all in one place.',
  keywords: ['movies', 'watch party', 'streaming', 'sync', 'video chat', 'social'],
  icons: { icon: '/icon.svg' },
  openGraph: {
    title: 'ConnectUs — Watch Movies Together',
    description: 'Stream movies in perfect sync with friends.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: 'var(--bg)',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[var(--bg)] antialiased`}
      >
        <AuthProvider>
          <SocketProvider>{children}</SocketProvider>
        </AuthProvider>
        <Toaster theme="dark" position="top-center" richColors />
      </body>
    </html>
  );
}
