import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Briefing - Your Personal News Intelligence",
  description: "AI-powered personalized news briefings tailored to your interests",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
