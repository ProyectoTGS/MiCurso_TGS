import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { PwaRegister } from '@/components/pwa-register';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://mi-curso-agenda-5b.fliasaint.chatgpt.site'),
  title: 'Mi Curso',
  description: 'Pruebas y trabajos prácticos de tu curso, en un solo lugar.',
  applicationName: 'Mi Curso',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mi Curso',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  openGraph: {
    title: 'Mi Curso',
    description: 'Pruebas y trabajos prácticos de tu curso.',
    type: 'website',
    url: 'https://mi-curso-agenda-5b.fliasaint.chatgpt.site',
    images: [
      {
        url: 'https://mi-curso-agenda-5b.fliasaint.chatgpt.site/og.png',
        width: 1734,
        height: 907,
        alt: 'Mi Curso',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mi Curso',
    description: 'Pruebas y trabajos prácticos de tu curso.',
    images: ['https://mi-curso-agenda-5b.fliasaint.chatgpt.site/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
