import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Mono, DM_Sans } from "next/font/google";
import "./globals.css";
import "./elan-theme.css";
import Providers from "@/components/providers/Providers";
import { Analytics } from "@vercel/analytics/next";
import { UmamiScript } from "@/components/providers/UmamiScript";

const vercelAnalyticsEnabled = process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED === "true";

const displayFont = Bricolage_Grotesque({
  variable: "--font-elan-display",
  subsets: ["latin"],
});

const sansFont = DM_Sans({
  variable: "--font-elan-sans",
  subsets: ["latin"],
});

const monoFont = DM_Mono({
  variable: "--font-elan-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Ping | Plateforme d'exécution commerciale",
  description: "La plateforme d'exécution commerciale qui transforme l'activité en résultats.",
  // The square mark, not the wordmark: /brand/ping-logo-blue.png is 300x86 and
  // becomes an unreadable smear at 16px. app/favicon.ico carries per-size
  // artwork (bigger petals below 48px); the SVG is used wherever it is supported.
  icons: {
    icon: [
      { url: "/brand/ping-icon.svg", type: "image/svg+xml" },
      { url: "/brand/ping-icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/brand/ping-icon-180.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${displayFont.variable} ${sansFont.variable} ${monoFont.variable} elan-app antialiased`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
        {vercelAnalyticsEnabled ? <Analytics /> : null}
        <UmamiScript />
      </body>
    </html>
  );
}
