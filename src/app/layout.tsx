import type { Metadata } from "next";
import localFont from "next/font/local";
import { LanguageProvider } from "@/lib/language-context";
import { AuthProvider } from "@/lib/auth-context";
import { EventsQueueProvider } from "@/lib/events-queue-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProjectLearner } from "@/components/ProjectLearner";
import { ShareButton } from "@/components/ShareButton";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "ExplainIt - Turn any website into explainer videos & docs",
  description: "Generate professional explainer videos, demo pages, and annotated PDFs from any website or web app automatically.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="auto" suppressHydrationWarning>
      <body className={`${geistSans.variable} min-h-screen antialiased`}>
        <ErrorBoundary>
          <LanguageProvider>
            <AuthProvider>
              <EventsQueueProvider>
                {children}
              </EventsQueueProvider>
            </AuthProvider>
          </LanguageProvider>
        </ErrorBoundary>
        <ProjectLearner />
        <ShareButton />
      </body>
    </html>
  );
}
