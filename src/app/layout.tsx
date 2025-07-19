import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SessionProviderWrapper from '../components/providers/SessionProviderWrapper';
import { ThemeProvider } from '../components/providers/ThemeProvider';
import { I18nProvider } from '../lib/i18n';
import { TtsProvider } from '../components/TtsProvider';
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KnowFlow AI",
  description: "AI-powered document chat and project management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider>
          <ThemeProvider>
            <SessionProviderWrapper>
                <TtsProvider>
                  {children}
                </TtsProvider>
            </SessionProviderWrapper>
          </ThemeProvider>
        </I18nProvider>
        <Toaster />
      </body>
    </html>
  );
}
