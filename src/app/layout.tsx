import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { auth } from '@/lib/auth';
import { SessionProvider } from '@/lib/session-context';
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
  title: {
    default: 'KeishinCloud — 経審P点シミュレーション',
    template: '%s | KeishinCloud',
  },
  description:
    '建設業の経営事項審査（経審）P点をブラウザで即試算。登録不要・無料で使えるクラウド型経審シミュレーター。',
  keywords: [
    '経審',
    '経営事項審査',
    'P点',
    'シミュレーション',
    '建設業',
    '入札',
    '評点',
    'X1',
    'X2',
    'Y点',
    'Z点',
    'W点',
    '経審ソフト',
    '経審クラウド',
  ],
  openGraph: {
    title: 'KeishinCloud — 経審P点シミュレーション',
    description:
      '建設業の経審P点をブラウザで即試算。登録不要・無料。',
    type: 'website',
    locale: 'ja_JP',
    siteName: 'KeishinCloud',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KeishinCloud — 経審P点シミュレーション',
    description:
      '建設業の経審P点をブラウザで即試算。登録不要・無料。',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth().catch(() => null);

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="canonical" href="https://keishin.cloud" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
