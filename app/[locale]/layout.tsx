import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import Navbar from '@/components/Navbar'
import { SolanaProviderWrapper } from '@/components/SolanaProviderWrapper'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export async function generateMetadata({params: {locale}}: {params: {locale: string}}): Promise<Metadata> {
  const t = await getTranslations({locale, namespace: 'metadata'})
  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function LocaleLayout({
  children,
  params: {locale},
}: {
  children: React.ReactNode
  params: {locale: string}
}) {
  if (!routing.locales.includes(locale as any)) {
    notFound()
  }

  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className={`${inter.className} bg-gray-950 text-white`}>
        <NextIntlClientProvider messages={messages}>
          <SolanaProviderWrapper>
            <Navbar />
            {children}
          </SolanaProviderWrapper>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
