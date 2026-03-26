import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FairLens – EMI Risk Intelligence Platform',
  description: 'AI-powered EMI risk assessment platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
