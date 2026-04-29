/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { ConditionalChatWidget } from '@/components/chat/conditional-chat-widget'
import { ReduxProvider } from '@/components/providers/redux-provider'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'HealthCompass MA - Apply for Health Coverage',
  description: 'Navigate MassHealth and other MA benefits with HealthCompass MA. Check eligibility, apply, and manage your coverage online.',
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
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
          <ReduxProvider>
            {children}
            <ConditionalChatWidget />
          </ReduxProvider>
          <footer className="fixed bottom-1 right-2 text-[10px] text-muted-foreground/40 select-none pointer-events-none">
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </footer>
        </ThemeProvider>
      </body>
    </html>
  )
}
