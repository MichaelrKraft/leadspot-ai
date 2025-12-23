import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "LeadSpot.ai - AI Agent Command Center for CRM",
  description: "Launch autonomous AI agents that create campaigns, build workflows, and manage your CRM",
  keywords: ["CRM", "marketing automation", "AI agents", "Mautic", "autonomous agents"],
  authors: [{ name: "LeadSpot.ai" }],
  openGraph: {
    title: "LeadSpot.ai - AI Agent Command Center for CRM",
    description: "Launch autonomous AI agents that create campaigns, build workflows, and manage your CRM",
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
                  localStorage.setItem('leadspot-theme', 'light');
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
