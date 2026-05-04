import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'YAMAGUCHI 13 - 山口県13市シルエットカメラ',
  description: '山口県内13市の地形シルエットをカメラ映像にオーバーレイ表示。市の形を意識した撮影体験を提供する地域PR・観光・教育向けWebアプリ。',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'YAMAGUCHI 13 - 山口県13市シルエットカメラ',
    description: '山口県内13市の地形シルエットをカメラ映像にオーバーレイ表示。市の形を意識した撮影体験を提供する地域PR・観光・教育向けWebアプリ。',
    type: 'website',
    locale: 'ja_JP',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'YAMAGUCHI 13 - 山口県13市シルエットカメラ',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YAMAGUCHI 13 - 山口県13市シルエットカメラ',
    description: '山口県内13市の地形シルエットをカメラ映像にオーバーレイ表示。市の形を意識した撮影体験を提供する地域PR・観光・教育向けWebアプリ。',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className="bg-black">
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
