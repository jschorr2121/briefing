import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Briefing - Your Personal News Intelligence",
  description: "AI-powered personalized news briefings tailored to your interests. Choose your topics, get daily briefings with real-time news, listen via audio, and stay informed effortlessly.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Briefing",
  },
  openGraph: {
    title: "Briefing - Your Personal News Intelligence",
    description: "AI-powered personalized news briefings tailored to your interests. Choose your topics, get daily briefings, and listen on the go.",
    siteName: "Briefing",
    type: "website",
    locale: "en_US",
    url: "https://briefing-five.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "Briefing - Your Personal News Intelligence",
    description: "AI-powered personalized news briefings tailored to your interests.",
    creator: "@jschorr21",
  },
  keywords: ["news", "AI", "briefing", "personalized news", "daily briefing", "news summary", "AI news"],
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // Extend into safe area for edge-to-edge on iOS
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Briefing',
    url: 'https://briefing-five.vercel.app',
    description: 'AI-powered personalized news briefings tailored to your interests.',
    applicationCategory: 'NewsApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    creator: {
      '@type': 'Person',
      name: 'Jake Schorr',
    },
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <Providers>
          <main className="flex-1">
            {children}
          </main>
          <footer className="border-t border-[var(--border)] py-4 px-6 text-center text-sm text-[var(--muted)]">
            <div className="flex items-center justify-center gap-4">
              <a href="/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy</a>
              <span>·</span>
              <a href="/terms" className="hover:text-[var(--foreground)] transition-colors">Terms</a>
              <span>·</span>
              <a href="/support" className="hover:text-[var(--foreground)] transition-colors">Support</a>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
