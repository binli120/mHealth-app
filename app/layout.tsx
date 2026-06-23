/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { Suspense } from 'react'
import { ConsentedAnalytics } from '@/components/analytics/consented-analytics'
import { GrowthScripts } from '@/components/analytics/growth-scripts'
import { ConditionalChatWidget } from '@/components/chat/conditional-chat-widget'
import { ReduxProvider } from '@/components/providers/redux-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { CookieConsentBanner } from '@/components/privacy/cookie-consent-banner'
import { GlossaryProvider } from '@/lib/glossary/GlossaryContext'
import { SiteFooter } from '@/components/layout/site-footer'
import {
  COOKIE_CONSENT_COOKIE,
  hasAnalyticsCookieConsent,
  isCookieConsentValue,
} from '@/lib/privacy/cookie-consent'
import './globals.css'

function getMetadataBase() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()

  try {
    return new URL(appUrl || 'https://healthcompass.cloud')
  } catch {
    return new URL('https://healthcompass.cloud')
  }
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: 'HealthCompass MA - Apply for Health Coverage',
    template: '%s | HealthCompass MA',
  },
  description: 'Navigate MassHealth and other MA benefits with HealthCompass MA. Check eligibility, apply, and manage your coverage online.',
  applicationName: 'HealthCompass MA',
  keywords: [
    'MassHealth',
    'Massachusetts health coverage',
    'benefits eligibility',
    'SNAP Massachusetts',
    'health insurance application',
    'benefit navigation',
  ],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'HealthCompass MA',
    title: 'HealthCompass MA - Apply for Health Coverage',
    description: 'Check eligibility across MassHealth and other Massachusetts benefits, apply with guided steps, and manage coverage in one place.',
    images: [
      {
        url: '/brand/healthcompass-ma-logo.png',
        alt: 'HealthCompass MA',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HealthCompass MA - Apply for Health Coverage',
    description: 'Check eligibility across MassHealth and other Massachusetts benefits, apply with guided steps, and manage coverage in one place.',
    images: ['/brand/healthcompass-ma-logo.png'],
  },
  icons: {
    icon: '/favicon.svg?v=2',
    shortcut: '/favicon.svg?v=2',
    apple: '/apple-icon.png',
  },
}

// Must be async so we can read the per-request x-nonce header injected by
// middleware.  Next.js App Router reads this header internally and applies the
// nonce to the inline <script> tags it generates for RSC/hydration, replacing
// the old 'unsafe-inline' fallback.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // The nonce is set by middleware on every request.  It is undefined when
  // the page is rendered without middleware (e.g. static export or unit tests).
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const consentCookie = (await cookies()).get(COOKIE_CONSENT_COOKIE)?.value
  const cookieConsent = isCookieConsentValue(consentCookie) ? consentCookie : null
  const hasAnalyticsConsent = hasAnalyticsCookieConsent(cookieConsent)

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Expose the nonce in a <meta> tag so client-side code (e.g. a future
          trusted third-party SDK that creates <script> elements dynamically)
          can read it via document.querySelector('meta[name=csp-nonce]').content.
          The nonce value itself is NOT secret — it only needs to be
          per-request and unpredictable at render time.
        */}
        {nonce && <meta name="csp-nonce" content={nonce} />}
        {hasAnalyticsConsent && <GrowthScripts nonce={nonce} />}
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
          <ReduxProvider>
            <GlossaryProvider>
              {children}
            </GlossaryProvider>
            <ConditionalChatWidget />
            <Suspense fallback={null}>
              {hasAnalyticsConsent && <ConsentedAnalytics />}
            </Suspense>
          </ReduxProvider>
          <SiteFooter />
          <footer className="fixed bottom-1 right-2 text-[10px] text-muted-foreground/40 select-none pointer-events-none">
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </footer>
          <CookieConsentBanner initialConsent={cookieConsent} />
        </ThemeProvider>
      </body>
    </html>
  )
}
