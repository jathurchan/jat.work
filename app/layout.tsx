import './global.css'
import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import Footer from './components/footer'

const baseUrl = 'https://jat.work';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'Jathurchan Selvakumar | Software Engineer | Distributed Systems & ML',
    template: '%s | Jathurchan Selvakumar',
  },
  description: 'Software Engineer specializing in distributed systems, databases & storage, machine learning for retrieval, and algorithms. Ex-Amazon, AWS, and Withings. Creator of RaftLock — a fault-tolerant distributed lock service in Go implementing the Raft consensus algorithm.',
  openGraph: {
    title: 'Jathurchan Selvakumar | Software Engineer – Distributed Systems & ML',
    description: 'Portfolio of Jathurchan Selvakumar — Software Engineer focused on distributed systems, databases, and ML for retrieval. Ex-Amazon, AWS, and Withings. Built RaftLock and large-scale backend systems with reliability and performance at their core.',
    url: baseUrl,
    siteName: 'Jat.work',
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ')

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={cx(
        'text-black bg-white dark:text-white dark:bg-black',
        GeistSans.variable,
        GeistMono.variable
      )}
    >
      <body className="antialiased max-w-3xl mx-auto px-4 mt-8">
        <main className="flex-auto min-w-0 mt-6 flex flex-col">
          {children}
          <Footer />
          <Analytics />
          <SpeedInsights />
        </main>
      </body>
    </html>
  )
}
