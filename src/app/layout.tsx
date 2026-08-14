import type { Metadata } from 'next'
import { Almarai, Cairo } from 'next/font/google'
import './globals.css'
import AuthProvider from '@/components/AuthProvider'
import PageTransitionLoader from '@/components/PageTransitionLoader'
import DialogAccessibility from '@/components/DialogAccessibility'

const almarai = Almarai({
  subsets: ['arabic'],
  weight: ['300', '400', '700', '800'],
  variable: '--font-almarai',
})

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-cairo',
})

export const metadata: Metadata = {
  title: 'البيان',
  description: 'مكتبة قصص حديثة وتفاعلية للأطفال مع واجهة سهلة وجميلة',
  icons: {
    icon: '/favicon.jpg',
    apple: '/favicon.jpg',
  },
  openGraph: {
    title: 'البيان',
    description: 'مكتبة قصص حديثة وتفاعلية للأطفال',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" data-scroll-behavior="smooth" suppressHydrationWarning className={`${almarai.variable} ${cairo.variable}`}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="description" content="مكتبة قصص حديثة وتفاعلية للأطفال" />
        <meta name="theme-color" content="#F6F8FC" />
        <link rel="icon" href="/favicon.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/favicon.jpg" />
      </head>
      <body className="font-arabic antialiased bg-cloud text-ink">
        <AuthProvider>
          <PageTransitionLoader />
          <DialogAccessibility />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
