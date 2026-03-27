/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import type { Metadata } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ConditionalChatWidget } from '@/components/chat/conditional-chat-widget'
import { ReduxProvider } from '@/components/providers/redux-provider'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: 'HealthCompass MA - Apply for Health Coverage',
  description: 'Navigate MassHealth and other MA benefits with HealthCompass MA. Check eligibility, apply, and manage your coverage online.',
  icons: {
    icon: '/favicon.svg?v=2',
    shortcut: '/favicon.svg?v=2',
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ReduxProvider>
            {children}
            <ConditionalChatWidget />
            <Analytics />
          </ReduxProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
