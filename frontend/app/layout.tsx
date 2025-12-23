import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "InnoSynth.ai - From Search to Synthesis",
  description: "Transform your organization's knowledge chaos into competitive advantage",
  keywords: ["enterprise search", "knowledge synthesis", "AI", "B2B SaaS"],
  authors: [{ name: "InnoSynth.ai" }],
  openGraph: {
    title: "InnoSynth.ai - From Search to Synthesis",
    description: "Transform your organization's knowledge chaos into competitive advantage",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        {/* Inline script to set light theme as default */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Force light theme and clear any old dark preference
                  localStorage.setItem('innosynth-theme', 'light');
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-gray-50 antialiased transition-colors duration-300">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
