import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '../components/Navbar'
import { SolanaProviderWrapper } from '../components/SolanaProviderWrapper'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  title: 'Amanat Protocol — DAO мониторинг государственных контрактов Алматы',
  description: 'Прозрачный мониторинг строительных контрактов через децентрализованное управление гражданами Алматы',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body className={`${inter.className} bg-gray-50 text-gray-900`}>
        <SolanaProviderWrapper>
          <Navbar />
          {children}
        </SolanaProviderWrapper>
      </body>
    </html>
  )
}
