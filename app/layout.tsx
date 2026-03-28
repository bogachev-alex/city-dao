import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '../components/Navbar'
import { SolanaProviderWrapper } from '../components/SolanaProviderWrapper'
import { ThemeProvider } from '../components/ThemeProvider'

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
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`
        }} />
      </head>
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white`}>
        <ThemeProvider>
          <SolanaProviderWrapper>
            <Navbar />
            {children}
          </SolanaProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  )
}
