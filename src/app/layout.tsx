import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { LanguageProvider } from "@/lib/language-context";
import { AuthProvider } from "@/lib/auth-context";
import { EventsQueueProvider } from "@/lib/events-queue-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProjectLearner } from "@/components/ProjectLearner";
import { ShareButton } from "@/components/ShareButton";
import { ErrorReporter } from "@/components/ErrorReporter";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://explainit-one.vercel.app'),
  title: "ExplainIt - Turn any website into explainer videos & docs",
  description: "Generate professional explainer videos, demo pages, and annotated PDFs from any website or web app automatically.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ExplainIt",
  },
  openGraph: {
    title: "ExplainIt - Explainer Videos & Guides",
    description: "Generate professional explainer videos and PDF guides automatically. Share via WhatsApp.",
    type: "website",
    siteName: "ExplainIt",
    images: [{ url: '/demo/clubgg/screenshots/step_1_ya4leyew.png', width: 400, height: 780 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ExplainIt - Explainer Videos & Guides",
    description: "Generate professional explainer videos and PDF guides automatically.",
    images: ['/demo/clubgg/screenshots/step_1_ya4leyew.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0a0a0f" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body className={`${geistSans.variable} min-h-screen antialiased`}>
        <ErrorBoundary>
          <LanguageProvider storageKey="explainit-lang">
            <AuthProvider>
              <EventsQueueProvider>
                {children}
              </EventsQueueProvider>
            </AuthProvider>
          </LanguageProvider>
        </ErrorBoundary>
        <ProjectLearner />
        <ShareButton />
        <ErrorReporter />
      </body>
    </html>
  );
}
